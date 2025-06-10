// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
//  REST-endepunkt som kobler Adresse → Matrikkel → Bygning → Solkart → Enova
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/ban-ts-comment */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import NodeCache from "node-cache";
import fetch from "node-fetch";
import proj4 from "proj4";

import {
  MatrikkelClient,
  MatrikkelContext,
  MatrikkelehetsøkModel,
} from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient } from "../../src/clients/StoreClient.ts";

// ──────────────────────── Lokale typer ────────────────────────────────
interface SolarTakflate {
  tak_id: number;
  bygg_id: number | null;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
}
interface SolarResponse {
  takflater: SolarTakflate[];
  takAreal_m2: number | null;
  sol_kwh_m2_yr: number | null;
  sol_kwh_bygg_tot: number | null;
  category: string | null;
  reference: number;
}
interface EnovaEnergiattest {
  energiytelse?: {
    energikarakter?: string | null;
    oppvarmingskarakter?: string | null;
  };
}

// ──────────────────────── SRID-definisjoner ───────────────────────────
proj4.defs("EPSG:25833", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

const toPbeCrs = (e33: number, n33: number): [number, number] =>
  proj4("EPSG:25833", "EPSG:32632", [e33, n33]) as [number, number];

// ──────────────────────── Miljøvariabler ──────────────────────────────
const {
  MATRIKKEL_API_BASE_URL_TEST:
    MATRIKKEL_BASE = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1",
  MATRIKKEL_USERNAME_TEST: MATRIKKEL_USER,
  MATRIKKEL_PASSWORD: MATRIKKEL_PASS,
  MATRIKKEL_SNAPSHOT_VERSION = "9999-01-01T00:00:00+01:00",

  ENOVA_API_KEY,
  SOLAR_SERVICE_URL = "http://localhost:4003",
  PORT = "4002",
} = process.env as Record<string, string>;

if (!MATRIKKEL_USER || !MATRIKKEL_PASS) {
  throw new Error("Mangler Matrikkel-bruker/passord i .env");
}

// ──────────────────────── Klient-instanser ────────────────────────────
const matrikkelClient = new MatrikkelClient(
  MATRIKKEL_BASE,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);
const bygningClient = new BygningClient(
  MATRIKKEL_BASE,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);
const storeClient = new StoreClient(
  MATRIKKEL_BASE,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);

// ──────────────────────── Cache & helpers ─────────────────────────────
const cache = new NodeCache({ stdTTL: 3_600, checkperiod: 600 });

const ctx = (): MatrikkelContext => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "bis",
  snapshotVersion: MATRIKKEL_SNAPSHOT_VERSION,
});

async function lookupAdresse(adresse: string) {
  const cached = cache.get<any>(`adr:${adresse}`);
  if (cached) return cached;

  const r = await fetch(
    `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(
      adresse
    )}&treffPerSide=1&fuzzy=true`
  );
  const data: any = await r.json();
  if (!data.adresser?.length)
    throw new Error("Adresse ikke funnet i Kartverket");
  const a = data.adresser[0];
  const res = {
    kommunenummer: Number(a.kommunenummer ?? a.kommunekode),
    gnr: Number(a.matrikkelnummer?.gaardsnummer ?? a.gardsnummer),
    bnr: Number(a.matrikkelnummer?.bruksnummer ?? a.bruksnummer),
    snr: a.matrikkelnummer?.seksjonsnummer
      ? Number(a.matrikkelnummer.seksjonsnummer)
      : undefined,
  } as const;
  cache.set(`adr:${adresse}`, res);
  return res;
}

function composeMatrikkelNummer(
  kommune: number,
  gnr: number,
  bnr: number,
  snr?: number
) {
  const k = String(kommune).padStart(4, "0");
  const g = String(gnr).padStart(5, "0");
  const b = String(bnr).padStart(4, "0");
  const s = snr != null ? String(snr) : "0";
  return `${k}-${g}/${b}/0/${s}`;
}

// ──────────────────────── Express-app ─────────────────────────────────
const app = express();
app.use(cors());

// ---------- HOVEDROUTE -------------------------------------------------
app.get(
  "/lookup",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adresse = String(req.query.adresse ?? "").trim();
      if (!adresse) {
        res.status(400).json({ error: "adresse mangler" });
        return;
      }

      // 1) Adresse → grunn­nummer
      const { kommunenummer, gnr, bnr, snr } = await lookupAdresse(adresse);

      // 2) Matrikkelenhets-ID
      const søk: MatrikkelehetsøkModel = {
        kommunenummer,
        status: "AKTIV",
        gardsnummer: gnr,
        bruksnummer: bnr,
      };
      const [matrikkelenhetsId] = await matrikkelClient.findMatrikkelenheter(
        søk,
        ctx()
      );
      if (!matrikkelenhetsId) {
        res.status(404).json({ error: "Ingen matrikkelenhet funnet" });
        return;
      }

      // 3) Byggliste
      const byggListe = await bygningClient.findByggForMatrikkelenhet(
        matrikkelenhetsId,
        ctx()
      );
      if (!byggListe.length) {
        res.status(404).json({ error: "Matrikkelenheten har ingen bygg" });
        return;
      }
      const byggId = byggListe[0].byggId;

      // 4) StoreService
      const byggInfo = await storeClient.getBygg(byggId, ctx());

      // 5) Koordinat → PBE XY
      let pbeXY: [number, number] | null = null;
      if (byggInfo.koordinat) {
        pbeXY = toPbeCrs(byggInfo.koordinat.øst, byggInfo.koordinat.nord);
      }

      // 6) Solar-service
      let solar: SolarResponse | null = null;
      try {
        solar = (await fetch(
          `${SOLAR_SERVICE_URL}/solinnstraling?bygg_id=${byggId}`
        ).then((r) => r.json())) as SolarResponse;
      } catch {
        if (pbeXY) {
          const [x, y] = pbeXY;
          const [lon, lat] = proj4("EPSG:32632", "EPSG:4326", [x, y]);
          solar = (await fetch(
            `${SOLAR_SERVICE_URL}/solinnstraling?lat=${lat}&lon=${lon}`
          ).then((r) => r.json())) as SolarResponse;
        }
      }

      // 7) Enova energiattest
      let energiattest: EnovaEnergiattest | null = null;
      if (ENOVA_API_KEY) {
        try {
          const matNr = composeMatrikkelNummer(kommunenummer, gnr, bnr, snr);
          energiattest = (await fetch(
            `https://www.enova.no/api/energiattest/${matNr}?key=${ENOVA_API_KEY}`
          ).then((r) => (r.ok ? r.json() : null))) as EnovaEnergiattest | null;
        } catch {
          // ignorer feil
        }
      }

      res.json({
        adresse,
        kommunenummer,
        gnr,
        bnr,
        snr: snr ?? null,
        matrikkelenhetsId,
        byggId,
        bygg: byggInfo,
        solar,
        energiattest,
      });
    } catch (err) {
      next(err as Error);
    }
  }
);

// ---------- Error-middleware -----------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error("[bis]", err);
  res.status(500).json({ error: err?.message ?? String(err) });
});

// ---------- Start server ---------------------------------------------
app.listen(Number(PORT), () =>
  console.log(`building-info-service ▶ http://localhost:${PORT}`)
);

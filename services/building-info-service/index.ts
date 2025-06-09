/* eslint-disable @typescript-eslint/ban-ts-comment */
// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
//  ▸ Mottar en adresse‑streng ("Kapellveien 156C, 0493 Oslo")
//  ▸ AdresseServiceWS   → gnr / bnr / (snr)
//  ▸ MatrikkelenhetWS   → matrikkelenhets‑ID
//  ▸ BygningServiceWS   → bygg‑liste & punkt (EPSG:25832)
//  ▸ Konverterer punkt → EPSG:32632, henter BYGG_ID via PBE‑Identify
//  ▸ PBE bygg‑ID eller (lat,lon) sendes til solar‑service
//  ▸ Energiattest hentes fra Enova‑API
//  ▸ Returnerer samlet JSON til frontend (DebugDataTable)
// ---------------------------------------------------------------------------

import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
// @ts-ignore – proj4 mangler offisielle typer
import proj4 from "proj4";

import { MatrikkelClient } from "../../src/clients/MatrikkelClient.js";
import { BygningClient } from "../../src/clients/BygningClient.js";
import { StoreClient, ByggInfo } from "../../src/clients/StoreClient.js";

/* ─────────── Typer ───────────────────────────────────────────────────── */
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

/* ─────────── SRID-defs ──────────────────────────────────────────────── */
proj4.defs("EPSG:25832", "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

/* ─────────── Miljøvariabler ──────────────────────────────────────────── */
const {
  MATRIKKEL_API_BASE_URL_TEST:
    MATRIKKEL_BASE = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1",
  MATRIKKEL_USERNAME_TEST: MATRIKKEL_USER,
  MATRIKKEL_PASSWORD: MATRIKKEL_PASS,
  MATRIKKEL_SNAPSHOT_VERSION = "9999-01-01T00:00:00+01:00",

  ENOVA_API_KEY,

  PBE_MAP_BASE_URL = "https://pbe.oslo.kommune.no/arcgis/rest/services/solkart_2024/MapServer",
  PBE_IDENTIFY_TOLERANCE = "2",

  SOLAR_BASE,
  BUILDINGS_PORT,
} = process.env;

if (!MATRIKKEL_USER || !MATRIKKEL_PASS) {
  throw new Error("Matrikkel-credentials mangler i .env");
}

/* ─────────── Instanser ──────────────────────────────────────────────── */
const matrikkelClient = new MatrikkelClient(
  MATRIKKEL_BASE!,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);
const bygningClient = new BygningClient(
  MATRIKKEL_BASE!,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);
const storeClient = new StoreClient(
  MATRIKKEL_BASE!,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);

const cache = new NodeCache({ stdTTL: 86_400, checkperiod: 600 });
const SOLAR_URL = (SOLAR_BASE ?? "http://localhost:4003") + "/solinnstraling";
const ENOVA_URL =
  "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest";

/* ─────────── Helpers ─────────────────────────────────────────────────── */
/** Konverter Matrikkel‑koordinat (EPSG:25832) → EPSG:32632 (PBE) */
const toPbeCrs = (e32: number, n32: number): [number, number] =>
  proj4("EPSG:25832", "EPSG:32632", [e32, n32]) as [number, number];

/** Oppretter Matrikkel‑kontekst med EPSG:25832 */
const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25832,
  systemVersion: "trunk",
  klientIdentifikasjon: "proxy",
  snapshotVersion: MATRIKKEL_SNAPSHOT_VERSION,
});

/**  Fetch Enova‑energimerke  */
const pad5 = (v: string | number) => String(v).padStart(5, "0");
const pad4 = (v: string | number) => String(v).padStart(4, "0");
async function fetchEnergiattest(
  kommunenummer: string,
  gnr: number,
  bnr: number,
  snr?: string | null
): Promise<EnovaEnergiattest | null> {
  const qs = new URLSearchParams({
    Kommunenummer: kommunenummer,
    Gardsnummer: pad5(gnr),
    Bruksnummer: pad4(bnr),
  });
  if (snr) qs.set("Seksjonsnummer", pad4(snr));

  const response = await fetch(`${ENOVA_URL}?${qs}`, {
    headers: { "Ocp-Apim-Subscription-Key": ENOVA_API_KEY ?? "" },
  });
  if (!response.ok) return null;
  const arr = (await response.json()) as EnovaEnergiattest[];
  return arr?.[0] ?? null;
}

/**  PBE Identify – finn BYGG_ID ut fra punkt i EPSG:32632 */
async function fetchPbeByggId(
  øst32632: number,
  nord32632: number,
  mapBase: string = PBE_MAP_BASE_URL,
  tol: string = PBE_IDENTIFY_TOLERANCE
): Promise<number | null> {
  const params = new URLSearchParams({
    f: "json",
    tolerance: tol,
    geometryType: "esriGeometryPoint",
    geometry: `${øst32632},${nord32632}`,
    sr: "32632",
    mapExtent: `${øst32632 - 5},${nord32632 - 5},${øst32632 + 5},${
      nord32632 + 5
    }`,
    layers: "all:2", // layer 2 = BYGG_ID
    imageDisplay: "800,600,96",
    returnGeometry: "false",
  });

  const response = await fetch(`${mapBase}/identify?${params.toString()}`);
  if (!response.ok) return null;
  const json = (await response.json()) as any;
  const idFieldVal = json?.results?.[0]?.attributes?.BYGG_ID;
  const idNum = Number(idFieldVal);
  return Number.isFinite(idNum) && idNum > 0 ? idNum : null;
}

/* ─────────── Express‑endpoint ───────────────────────────────────────── */
const app = express();
app.use(cors());

app.get("/lookup", async (req: Request, res: Response) => {
  const adresse = String(req.query.adresse ?? "").trim();
  if (!adresse) return res.status(400).json({ error: "Mangler adresse" });

  if (cache.has(adresse)) return res.json(cache.get(adresse));

  try {
    /* 1) AdresseService → gnr/bnr/(snr) */
    const bruksenheter =
      await matrikkelClient.findBruksenheterForVegadresseIKommune(
        { adresse },
        ctx()
      );
    const first = bruksenheter[0];
    if (!first)
      return res.status(404).json({ error: "Fant ingen bruksenheter" });

    const { kommunenummer, gardsnummer, bruksnummer, seksjonsnummer } = first;

    /* 2) Matrikkelenhet‑ID */
    const [matrikkelenhetsId] = await matrikkelClient.findMatrikkelenheter(
      {
        kommunenummer,
        status: "ALLE",
        gardsnummer,
        bruksnummer,
      },
      ctx()
    );
    if (!matrikkelenhetsId)
      throw new Error("Ingen matrikkelenhet funnet (gnr/bnr feil?)");

    /* 3) Bygg‑liste og punkt */
    const byggListe = await bygningClient.findByggForMatrikkelenhet(
      matrikkelenhetsId,
      ctx()
    );
    if (!byggListe.length)
      throw new Error("Ingen bygg funnet i matrikkelenheten");

    let øst32632: number | null = null;
    let nord32632: number | null = null;
    let braSum = 0;
    let byggår: number | null = null;
    let isProtected = false;

    for (const { byggId } of byggListe) {
      const info = (await storeClient.getBygg(byggId, ctx())) as ByggInfo & {
        representasjonspunkt?: { øst: number; nord: number };
        harKulturminne?: boolean;
      };
      if (info.harKulturminne) isProtected = true;

      if (!øst32632) {
        const p = info.representasjonspunkt; // EPSG:25832
        if (p) {
          [øst32632, nord32632] = toPbeCrs(p.øst, p.nord);
        }
      }

      if (typeof info.bra_m2 === "number") braSum += info.bra_m2;
      if (!byggår && typeof info.byggeår === "number") byggår = info.byggeår;
    }

    /* 4) PBE BYGG_ID */
    const pbeByggId =
      øst32632 && nord32632 ? await fetchPbeByggId(øst32632, nord32632) : null;

    /* 5) Energiattest */
    const energi = await fetchEnergiattest(
      kommunenummer,
      gardsnummer,
      bruksnummer,
      seksjonsnummer
    );

    /* 6) Solar‑service */
    let solarQ = "";
    if (pbeByggId) solarQ = `bygg_id=${pbeByggId}`;
    else if (øst32632 && nord32632) {
      const [lon, lat] = proj4("EPSG:32632", "EPSG:4326", [
        øst32632,
        nord32632,
      ]) as [number, number];
      solarQ = `lat=${lat}&lon=${lon}`;
    } else {
      throw new Error("Manglet både BYGG_ID og koordinat");
    }

    const solarRes = (await (
      await fetch(`${SOLAR_URL}?${solarQ}`)
    ).json()) as unknown as SolarResponse;

    const takAreal = solarRes.takflater.reduce((s, t) => s + t.area_m2, 0);

    /* 7) Compose response */
    const result = {
      adresse,
      kommunenummer,
      gnr: gardsnummer,
      bnr: bruksnummer,
      snr: seksjonsnummer ?? null,
      matrikkelenhetsId,
      pbeByggId,
      byggår,
      bra_m2: braSum || null,
      isProtected,
      energikarakter: energi?.energiytelse?.energikarakter ?? null,
      oppvarmingskarakter: energi?.energiytelse?.oppvarmingskarakter ?? null,
      takAreal_m2: takAreal || null,
      sol_kwh_m2_yr: solarRes.sol_kwh_m2_yr,
      sol_kwh_bygg_tot: solarRes.sol_kwh_bygg_tot,
      solKategori: solarRes.category,
      takflater: solarRes.takflater,
    };

    cache.set(adresse, result);
    res.json(result);
  } catch (err: any) {
    console.error("[BIS]", err);
    res.status(500).json({ error: err.message ?? "Ukjent feil" });
  }
});

/* ─────────── Start server ────────────────────────────────────────────── */
const PORT = Number(BUILDINGS_PORT) || 4002;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`[BIS] ▶ lytter på http://localhost:${PORT}`)
);

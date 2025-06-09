/* eslint-disable @typescript-eslint/ban-ts-comment */
// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
//  • Henter matrikkeldata → presist bygningspunkt (EPSG:25832)
//  • Konverterer til EPSG:32632, finner BYGG_ID via PBE-Identify
//  • Faller tilbake til polygon eller lat/lon mot solar-service
//  • Tar inn Enova-energimerke og returnerer samlet JSON til frontend
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
interface KartverketHit {
  kommunenummer: string;
  gnr: string;
  bnr: string;
  snr: string | null;
}
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
const pad5 = (v: string | number) => String(v).padStart(5, "0");
const pad4 = (v: string | number) => String(v).padStart(4, "0");
/** Hent første tallsekvens i en streng – ellers returner null. */
const onlyDigits = (s: string | null | undefined): string | null => {
  const m = String(s ?? "").match(/\d+/);
  return m ? m[0] : null;
};
/** Konverterer Matrikkel‐punkt (EPSG:25832) → PBE (EPSG:32632) */
const toPbeCrs = (e32: number, n32: number): [number, number] =>
  proj4("EPSG:25832", "EPSG:32632", [e32, n32]) as [number, number];

/** Oppretter Matrikkel‐kontekst med EPSG:25832 */
const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25832,
  systemVersion: "trunk",
  klientIdentifikasjon: "proxy",
  snapshotVersion: MATRIKKEL_SNAPSHOT_VERSION,
});

/* ─────────── Eksterne kall ──────────────────────────────────────────── */
/** 1) Adressestreng → Kartverket (via Nominatim‐demo) */
async function lookupKartverket(adresse: string): Promise<KartverketHit> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=" +
    encodeURIComponent(adresse);
  const hit = (await (await fetch(url)).json()) as any[]; // cast for å unngå ‘unknown’
  const house = hit?.[0]?.address ?? {};
  return {
    kommunenummer: house?.municipality_code ?? "0301",
    gnr: pad5(house?.road_number ?? "1"),
    bnr: pad4(house?.house_number ?? "1"),
    snr: null,
  };
}

/** 2) PBE Identify – finn BYGG_ID ut fra punkt i EPSG:32632 */
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
  const json = (await response.json()) as any; // uspesifisert JSON‐objekt
  const idFieldVal = json?.results?.[0]?.attributes?.BYGG_ID;
  const idNum = Number(idFieldVal);
  return Number.isFinite(idNum) && idNum > 0 ? idNum : null;
}

/** 3) Hent Enova‐energimerke (forenklet) */
async function fetchEnergiattest(
  kommunenummer: string,
  gnrNum: number,
  bnrNum: number,
  snr?: string | null
): Promise<EnovaEnergiattest | null> {
  const qs = new URLSearchParams({
    Kommunenummer: kommunenummer,
    Gardsnummer: pad5(gnrNum),
    Bruksnummer: pad4(bnrNum),
  });
  if (snr) qs.set("Seksjonsnummer", pad4(snr));

  const response = await fetch(`${ENOVA_URL}?${qs}`, {
    headers: { "Ocp-Apim-Subscription-Key": ENOVA_API_KEY ?? "" },
  });
  if (!response.ok) return null;
  const arr = (await response.json()) as EnovaEnergiattest[];
  return arr?.[0] ?? null;
}

/* ─────────── Express‐endpoint ───────────────────────────────────────── */
const app = express();
app.use(cors());

app.get("/lookup", async (req: Request, res: Response) => {
  const adresse = String(req.query.adresse ?? "").trim();
  if (!adresse) {
    res.status(400).json({ error: "Mangler adresse‐parameter" });
    return;
  }

  if (cache.has(adresse)) {
    res.json(cache.get(adresse));
    return;
  }

  try {
    /* 1) Kartverket (Nominatim‐demo) */
    const { kommunenummer, gnr, bnr, snr } = await lookupKartverket(adresse);

    /* 1b) Fjern alt som ikke er sifre – kun tall til Matrikkelen */
    const gnrDigits = onlyDigits(gnr);
    const bnrDigits = onlyDigits(bnr);
    if (!gnrDigits || !bnrDigits) {
      res
        .status(400)
        .json({ error: "Ugyldig gnr/bnr i adressen – kun tall tillatt" });
      return;
    }
    // Vi beholder digit-strengene kun for validering; konverterer til number når de skal sendes videre:
    const gnrNum = Number(gnrDigits);
    const bnrNum = Number(bnrDigits);

    /* 2) Hent matrikkelenhets‐ID – gardsnummer/bruksnummer som NUMBERS */
     const [matrikkelenhetsId] = await matrikkelClient.findMatrikkelenheter(
         {
           kommunenummer,
           status: "BESTAENDE",
           gardsnummer: pad5(gnrNum),  // NÅ: string → korrekt
           bruksnummer: pad4(bnrNum),  // NÅ: string → korrekt
         },
      +   ctx()
      + );
    if (!matrikkelenhetsId) throw new Error("Ingen matrikkelenhet funnet");

    /* 3) Hent liste av bygg for matrikkelenheten */
    const byggListe = await bygningClient.findByggForMatrikkelenhet(
      matrikkelenhetsId,
      ctx()
    );
    if (!byggListe.length)
      throw new Error("Ingen bygg funnet i matrikkelenhet");

    let rp: { øst: number; nord: number } | null = null;
    let braSum = 0;
    let byggår: number | null = null;
    let isProtected = false;

    /* 3a) Hent ByggInfo én om gangen */
    for (const { byggId } of byggListe) {
      const info = (await storeClient.getBygg(byggId, ctx())) as ByggInfo & {
        representasjonspunkt?:
          | { øst: number; nord: number }
          | { x: number; y: number };
        harKulturminne?: boolean;
      };

      if (info.harKulturminne) isProtected = true;

      const p: any = info.representasjonspunkt ?? (info as any).koordinat;
      const øst25832 = p?.øst ?? p?.x;
      const nord25832 = p?.nord ?? p?.y;
      if (
        !rp &&
        typeof øst25832 === "number" &&
        typeof nord25832 === "number"
      ) {
        const [øst32632, nord32632] = toPbeCrs(øst25832, nord25832);
        rp = { øst: øst32632, nord: nord32632 };
      }

      if (typeof info.bra_m2 === "number") braSum += info.bra_m2;
      if (!byggår && typeof info.byggeår === "number") byggår = info.byggeår;
    }

    /* 4) Hent BYGG_ID fra PBE via identify‐kall */
    const pbeByggId = rp ? await fetchPbeByggId(rp.øst, rp.nord) : null;

    /* 5) Polygon‐fallback – kun hvis vi ikke fikk pbeByggId */
    let polygonWKT: string | null = null;
    if (!pbeByggId) {
      try {
         polygonWKT = await matrikkelClient.getBuildingPolygonWKT(
             {
               kommunenummer,
               gardsnummer: pad5(gnrNum),  // string → korrekt
               bruksnummer: pad4(bnrNum),  // string → korrekt
             },
             ctx()
           );
      } catch {
        // ignore: vi kan likevel bruke punkt‐fallback
      }
    }

    /* 6) Hent Enova‐energimerke – her sender vi numre */
    const energi = await fetchEnergiattest(kommunenummer, gnrNum, bnrNum, snr);

    /* 7) Kall mot solar‐service */
    let solarQ = "";
    if (pbeByggId) {
      solarQ = `bygg_id=${pbeByggId}`;
    } else if (polygonWKT) {
      solarQ = `polygon=${encodeURIComponent(polygonWKT)}`;
    } else if (rp) {
      const [lon, lat] = proj4("EPSG:32632", "EPSG:4326", [
        rp.øst,
        rp.nord,
      ]) as [number, number];
      solarQ = `lat=${lat}&lon=${lon}`;
    } else {
      throw new Error("Manglet BYGG_ID, polygon og bygg‐punkt");
    }

    const solarRes = (await (
      await fetch(`${SOLAR_URL}?${solarQ}`)
    ).json()) as unknown as SolarResponse;

    const takAreal = solarRes.takflater.reduce((sum, t) => sum + t.area_m2, 0);

    /* 8) Bygg og returner JSON‐svar */
    const result = {
      kommunenummer,
      gnr: gnrDigits, // vi kan vise dem som rene digit-strenger tilbake
      bnr: bnrDigits,
      snr,
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

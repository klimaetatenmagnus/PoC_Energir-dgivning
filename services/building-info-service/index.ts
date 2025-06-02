// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
// Henter bygningsdata for én adresse og returnerer også et _diag-objekt.
//   • Kartverket   → gnr / bnr / snr / bruksenhetnr
//   • Matrikkel    → matrikkelenhetsID
//   • Bygg (Store) → byggeår / BRA / antBruksenheter
//   • Enova        → energimerke (fallback BRA/byggår)
//   • PBE Solkart  → solinnstråling & potensial
//   • Kulturminne  → historiske bygg-sjekk
// ---------------------------------------------------------------------------

console.log("[BIS] starting file …");
process.on("beforeExit", () => console.log("[BIS] beforeExit"));
process.on("exit", () => console.log("[BIS] exit"));

import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – proj4 har ingen typings
import proj4 from "proj4";

import {
  MatrikkelClient,
  MatrikkelenhetMeta,
} from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient } from "../../src/clients/StoreClient.ts";

// ──────────────── instanser & konstanter ──────────────────────
const BASE =
  process.env.MATRIKKEL_API_BASE_URL_TEST?.trim() ||
  "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1";

const {
  MATRIKKEL_USERNAME_TEST: USER,
  MATRIKKEL_PASSWORD: PASS,
  ENOVA_API_KEY,
  SOLAR_BASE, // f.eks. "http://localhost:4003"
} = process.env;

if (!USER || !PASS) {
  throw new Error("Matrikkel-credentials mangler i miljøvariabler");
}

const storeClient = new StoreClient(BASE, USER, PASS);
const bygningClient = new BygningClient(BASE, USER, PASS);
const matrikkelClient = new MatrikkelClient(BASE, USER, PASS);

const cache = new NodeCache({ stdTTL: 86_400, checkperiod: 600 });

proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");

const PROT_WFS_URL =
  "https://ws.geonorge.no/kulturminne/fkb_historiske_bygninger";
const PROT_TYPENAME = "hbf_histbygning";
const ENOVA_API_URL =
  "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest";
const SOLAR_URL = (SOLAR_BASE ?? "http://localhost:4003") + "/solinnstraling";

// ──────────────── hjelpemetoder ───────────────────────────────
const pad5 = (v: string | number) => String(v).padStart(5, "0");
const pad4 = (v: string | number) => String(v).padStart(4, "0");
const pad4str = (v?: string | null) =>
  v ? String(v).padStart(4, "0").toUpperCase() : undefined;

const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "proxy",
  snapshotVersion: "9999-01-01T00:00:00+01:00",
});

// ───────── Kartverket (adresse → gnr/bnr/…) ───────────────────
async function lookupKartverket(adresse: string) {
  const r = await fetch(
    "https://ws.geonorge.no/adresser/v1/sok?sok=" +
      encodeURIComponent(adresse) +
      "&treffPerSide=1&fuzzy=true",
    { headers: { "User-Agent": "Energiverktøy/1.0" } }
  );
  const j: any = await r.json();
  if (!j.adresser?.length) throw new Error("Kartverket fant ikke adresse");
  const a = j.adresser[0];

  return {
    kommunenummer: a.kommunenummer ?? a.kommunekode ?? null,
    gnr: a.matrikkelnummer?.gaardsnummer ?? a.gardsnummer ?? null,
    bnr: a.matrikkelnummer?.bruksnummer ?? a.bruksnummer ?? null,
    snr:
      a.matrikkelnummer?.seksjonsnummer ??
      (a.undernummer ? String(a.undernummer).padStart(2, "0") : null),
    bruksenhetnr:
      a.matrikkelnummer?.bruksenhetsnummer ??
      (Array.isArray(a.bruksenhetsnummer) && a.bruksenhetsnummer.length
        ? a.bruksenhetsnummer[0]
        : null),
  };
}

/* ---------- ENOVA ---------- */
interface EnergiPayload {
  kommunenummer: string;
  gnr: string | number;
  bnr: string | number;
  snr?: string | null;
  bruksenhetnr?: string | null;
}

async function fetchEnergiattest(
  input: EnergiPayload
): Promise<{ httpStatus: number; data: any | null }> {
  const { kommunenummer, gnr, bnr, snr, bruksenhetnr } = input;

  if (!kommunenummer || !gnr || !bnr || !ENOVA_API_KEY)
    return { httpStatus: 0, data: null };

  const payload: Record<string, string> = {
    kommunenummer,
    gardsnummer: pad5(gnr),
    bruksnummer: pad4(bnr),
  };
  if (snr) payload.seksjonsnummer = pad4str(snr)!;
  if (bruksenhetnr) payload.bruksenhetnummer = pad4str(bruksenhetnr)!;

  if (process.env.LOG_SOAP) console.log("[Enova] payload →", payload);

  const r = await fetch(ENOVA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Energiverktøy/1.0",
      "x-api-key": ENOVA_API_KEY!,
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) return { httpStatus: r.status, data: await r.text() };

  const list: any = await r.json();
  return {
    httpStatus: 200,
    data: Array.isArray(list) && list[0] ? list[0] : null,
  };
}

/* ---------- Geokoding ---------- */
async function geocode(adresse: string) {
  const r = await fetch(
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
      encodeURIComponent(adresse) +
      "&limit=1",
    { headers: { "User-Agent": "Energiverktøy/1.0" } }
  );
  const j: any = await r.json();
  if (!j[0]) throw new Error("Adresse ikke funnet i Nominatim");
  return { lat: +j[0].lat, lon: +j[0].lon };
}

/* ---------- Typer fra solar-service ---------- */
interface SolarResponse {
  reference: number;
  takflater: {
    tak_id: number;
    area_m2: number;
    irr_kwh_m2_yr: number;
    kWh_tot: number;
  }[];
  takAreal_m2: number | null;
  sol_kwh_m2_yr: number | null;
  sol_kwh_bygg_tot: number | null;
  category: string | null;
}

/* =======================================================================
   Express-oppsett
   ======================================================================= */
const app = express();
app.use(cors());

const lookupHandler: RequestHandler = async (req: Request, res: Response) => {
  const adresse = req.query.adresse;
  if (typeof adresse !== "string") {
    res.status(400).json({ error: "Mangler adresse" });
    return;
  }

  const cacheKey = `build:${adresse}`;
  if (cache.has(cacheKey)) {
    res.json(cache.get(cacheKey));
    return;
  }

  const diag: Record<string, any> = {};

  try {
    /* ── 1) Kartverket ───────────────────────────────────────── */
    const { kommunenummer, gnr, bnr, snr, bruksenhetnr } =
      await lookupKartverket(adresse);
    diag.kartverket = { ok: true };

    if (!gnr || !bnr) {
      res
        .status(404)
        .json({ error: "Adressen mangler entydig gnr/bnr i Kartverket." });
      return;
    }

    /* ── 2) Matrikkel-enhet ─────────────────────────────────── */
    let matrikkelenhetsId: number | null = null;
    try {
      const ids = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer,
          status: "BESTAENDE",
          gardsnummer: gnr,
          bruksnummer: bnr,
        },
        ctx()
      );
      if (ids?.length) {
        matrikkelenhetsId = ids[0];
        diag.matrikkel = { ok: true, id: matrikkelenhetsId };
      } else {
        diag.matrikkel = { ok: false, error: "Ingen matrikkelenhet funnet" };
      }
    } catch (e: any) {
      diag.matrikkel = { ok: false, error: e.message };
    }

    /* ── 3) Bygg-bobler ─────────────────────────────────────── */
    let byggår: number | null = null;
    let bra_m2: number | null = null;
    let bruksenheter: number | null = null;
    let byggIds: number[] = [];

    diag.bygg = {
      ok: false,
      byggCount: 0,
      felter: {} as Record<string, boolean>,
    };

    if (matrikkelenhetsId !== null) {
      try {
        const byggListe = await bygningClient.findByggForMatrikkelenhet(
          matrikkelenhetsId,
          ctx()
        );
        byggIds = byggListe.map((b) => b.byggId);
        diag.bygg.byggCount = byggIds.length;

        for (const id of byggIds) {
          try {
            const info = await storeClient.getBygg(id, ctx());
            if (!byggår && info.byggeår) {
              byggår = info.byggeår;
              diag.bygg.felter.byggeår = true;
            }
            if (!bra_m2 && info.bruksareal) {
              bra_m2 = info.bruksareal;
              diag.bygg.felter.bruksareal = true;
            }
            if (!bruksenheter && info.antBruksenheter) {
              bruksenheter = info.antBruksenheter;
              diag.bygg.felter.bruksenheter = true;
            }
            if (byggår && bra_m2 && bruksenheter) break;
          } catch {
            /* ignorér 500 for enkelt-ID */
          }
        }
        diag.bygg.ok =
          byggår !== null || bra_m2 !== null || bruksenheter !== null;
      } catch (e: any) {
        diag.bygg.error = e.message;
      }
    } else {
      diag.bygg.error = "Ingen matrikkelenhetsId – hopper over bygg-sjekk";
    }

    /* ── 4) Enova  ──────────────────────────────────────────── */
    let energi: any = null;
    let enovaStatus = 0;
    diag.enova = { ok: false as boolean, httpStatus: null as number | null };

    try {
      const first = await fetchEnergiattest({
        kommunenummer,
        gnr,
        bnr,
        snr,
        bruksenhetnr,
      });
      energi = first.data;
      enovaStatus = first.httpStatus;
      diag.enova = { ok: enovaStatus === 200, httpStatus: enovaStatus };

      if (
        enovaStatus === 400 &&
        !snr &&
        !bruksenhetnr &&
        matrikkelenhetsId !== null
      ) {
        const meta: MatrikkelenhetMeta =
          await matrikkelClient.getMatrikkelenhet(matrikkelenhetsId, ctx());

        if (meta.seksjonsnummer || meta.bruksenhetnummer) {
          const retry = await fetchEnergiattest({
            kommunenummer,
            gnr,
            bnr,
            snr: meta.seksjonsnummer ?? undefined,
            bruksenhetnr: meta.bruksenhetnummer ?? undefined,
          });
          if (retry.httpStatus === 200) {
            energi = retry.data;
            enovaStatus = 200;
            diag.enova = { ok: true, httpStatus: 200, retried: true };
          } else {
            diag.enova.httpStatus = retry.httpStatus;
          }
        }
      }

      if (enovaStatus === 200) {
        if (!byggår && energi?.enhet?.bygg?.byggeår)
          byggår = energi.enhet.bygg.byggeår;
        if (!bra_m2 && energi?.enhet?.bruksareal)
          bra_m2 = energi.enhet.bruksareal;
      }
    } catch (e: any) {
      diag.enova.error = e.message;
    }

    /* ── 5) Geokoding  ──────────────────────────────────────── */
    const { lat, lon } = await geocode(adresse);
    diag.geokoding = { ok: true, lat, lon };

    /* ── 6) PBE Solkart  ────────────────────────────────────── */
    let takflater: SolarResponse["takflater"] = [];
    let takAreal_m2: number | null = null;
    let sol_kwh_m2_yr: number | null = null;
    let sol_kwh_bygg_tot: number | null = null;
    let solKategori: string | null = null;

    diag.solar = { ok: false as boolean, reference: null as number | null };

    try {
      const solarFetch = await fetch(`${SOLAR_URL}?lat=${lat}&lon=${lon}`);
      if (!solarFetch.ok)
        throw new Error(`Solar-service returnerte ${solarFetch.status}`);
      const solarRes = (await solarFetch.json()) as SolarResponse;

      takflater = solarRes.takflater;
      takAreal_m2 = solarRes.takflater.reduce((s, t) => s + t.area_m2, 0);
      sol_kwh_bygg_tot = solarRes.sol_kwh_bygg_tot;
      sol_kwh_m2_yr = solarRes.sol_kwh_m2_yr;
      solKategori = solarRes.category;

      diag.solar = { ok: true, reference: solarRes.reference };
    } catch (e: any) {
      diag.solar.error = e.message;
    }

    /* ── 7) Kulturminne-sjekk  ─────────────────────────────── */
    let isProtected = false;
    try {
      const bbox = `${lon - 0.001},${lat - 0.001},${lon + 0.001},${
        lat + 0.001
      }`;
      const xml = await (
        await fetch(
          `${PROT_WFS_URL}?service=WFS&version=1.1.0&request=GetFeature&typeName=${PROT_TYPENAME}&SRSNAME=EPSG:4326&BBOX=${bbox}`
        )
      ).text();
      isProtected = /<gml:featureMember>/i.test(xml);
      diag.kulturminne = { ok: !isProtected, protected: isProtected };
    } catch (e: any) {
      diag.kulturminne = { ok: false, error: e.message };
    }

    /* ── 8) Returner resultat  ─────────────────────────────── */
    const result = {
      kommunenummer,
      gardsnummer: gnr,
      bruksnummer: bnr,
      seksjonsnummer: snr,
      bruksenhetnr,
      matrikkelenhetsId,
      byggår,
      bra_m2,
      bruksenheter,
      lat,
      lon,
      isProtected,
      energikarakter: energi?.energiytelse?.energikarakter ?? null,
      oppvarmingskarakter: energi?.energiytelse?.oppvarmingskarakter ?? null,
      takAreal_m2,
      sol_kwh_m2_yr,
      sol_kwh_bygg_tot,
      solKategori,
      takflater,
      _diag: diag,
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

app.get("/lookup", lookupHandler);

// ──────────────── start server ───────────────────────────────
const PORT = Number(process.env.BUILDINGS_PORT) || 4002;
console.log("[BIS] about to listen on", PORT);
app.listen(PORT, "0.0.0.0", () =>
  console.log(`building-info-service ▶ ${PORT}`)
);

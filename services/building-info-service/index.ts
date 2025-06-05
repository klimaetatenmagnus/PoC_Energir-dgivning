// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
// Henter bygningsdata for én adresse og returnerer også et _diag-objekt.
//   • Kartverket   → gnr/bnr/snr
//   • Matrikkel    → matrikkelenhetsID (+ mulig seksjons‐ eller bygg‐polygon)
//   • StoreService → byggeår, BRA (sum), etasjer, enheter
//   • Enova        → energimerke
//   • PBE Solkart  → sol­innstråling (via polygon eller gnr/bnr eller punkt)
//   • Kulturminne  → WFS-sjekk
// ---------------------------------------------------------------------------

import "dotenv/config";
import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import proj4 from "proj4";

import {
  MatrikkelClient,
  MatrikkelenhetMeta,
} from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient } from "../../src/clients/StoreClient.ts";
import type { ByggInfo } from "../../src/clients/StoreClient.ts";

// ──────────────── instanser & konstanter ──────────────────────
const BASE =
  process.env.MATRIKKEL_API_BASE_URL_TEST?.trim() ||
  "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1";

const {
  MATRIKKEL_USERNAME_TEST: USER,
  MATRIKKEL_PASSWORD: PASS,
  ENOVA_API_KEY,
  SOLAR_BASE,
} = process.env;

if (!USER || !PASS) throw new Error("Matrikkel-credentials mangler");

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

// ──────────────── div. helpers ───────────────────────────────
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

// ───────── Kartverket (adresse → gnr/bnr/ … ) ─────────────────
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

  if (!kommunenummer || !gnr || !bnr || !ENOVA_API_KEY) {
    return { httpStatus: 0, data: null };
  }

  const payload: Record<string, string> = {
    kommunenummer,
    gardsnummer: pad5(gnr),
    bruksnummer: pad4(bnr),
  };
  if (snr) payload.seksjonsnummer = pad4str(snr)!;
  if (bruksenhetnr) payload.bruksenhetsnummer = pad4str(bruksenhetnr)!;

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
   Express-app
   ======================================================================= */
const app = express();
app.use(cors());

const lookupHandler: RequestHandler = async (req: Request, res: Response) => {
  cache.flushAll(); // fjern for prod

  const adresse = req.query.adresse;
  if (typeof adresse !== "string") {
    res.status(400).json({ error: "Mangler adresse" });
    return;
  }

  const cacheKey = `build:${adresse}`;
  if (cache.has(cacheKey)) {
    console.log("[BIS] cache-hit:", cacheKey);
    res.json(cache.get(cacheKey));
    return;
  }

  const diag: Record<string, any> = {};

  try {
    /* ── 1) Kartverket ──────────────────────────────────── */
    const { kommunenummer, gnr, bnr, snr, bruksenhetnr } =
      await lookupKartverket(adresse);
    diag.kartverket = { ok: true };

    if (!gnr || !bnr) {
      res.status(404).json({ error: "Adressen mangler entydig gnr/bnr." });
      return;
    }

    /* ── 2) Matrikkel-enhet ─────────────────────────────── */
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

    /* ── 3) Bygg-bobler (StoreService) ──────────────────── */
    let byggår: number | null = null;
    let bra_m2_sum: number = 0;
    let bruksenheter: number | null = null;
    let antEtasjer: number | null = null;
    const bruksarealEtasjer: Record<number, number> = {};

    const byggIds: number[] = [];
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
        byggIds.push(...byggListe.map((b) => b.byggId));
        diag.bygg.byggCount = byggIds.length;

        for (const id of byggIds) {
          let info: ByggInfo;
          try {
            info = await storeClient.getBygg(id, ctx());
          } catch {
            continue; // hopp til neste bygg
          }

          /* ---- byggeår ---- */
          if (!byggår && info.byggeår) {
            byggår = info.byggeår;
            diag.bygg.felter.byggeår = true;
          }

          /* ---- BRA ---- */
          if (info.bra_m2 != null) {
            bra_m2_sum += info.bra_m2;
            diag.bygg.felter.bra_m2 = true;
          }

          /* ---- antall etasjer ---- */
          if (!antEtasjer && info.antEtasjer) {
            antEtasjer = info.antEtasjer;
            diag.bygg.felter.antEtasjer = true;
          }

          /* ---- areal per etasje ---- */
          if (info.etasjer?.length) {
            for (const e of info.etasjer) {
              if (e.bruksarealTotalt != null) {
                bruksarealEtasjer[e.etasjenummer] =
                  (bruksarealEtasjer[e.etasjenummer] ?? 0) + e.bruksarealTotalt;
              }
            }
            diag.bygg.felter.etasjer = true;
          }

          /* ---- bruksenheter ---- */
          if (!bruksenheter && info.antBruksenheter) {
            bruksenheter = info.antBruksenheter;
            diag.bygg.felter.bruksenheter = true;
          }
        }

        const bra_m2_total = bra_m2_sum > 0 ? bra_m2_sum : null;

        diag.bygg.ok =
          byggår !== null ||
          bra_m2_total !== null ||
          antEtasjer !== null ||
          Object.keys(bruksarealEtasjer).length > 0 ||
          bruksenheter !== null;

        if (bra_m2_total !== null) diag.bygg.bra_m2_total = bra_m2_total;
      } catch (e: any) {
        diag.bygg.error = e.message;
      }
    } else {
      diag.bygg.error = "Hopper over bygg-sjekk – mangler matrikkelenhetsId";
    }

    /* ── (new) Fetch injeksjonspunkt: Polygon for seksjon eller bygg ───────────── */
    let polygonWKT: string | null = null;
    if (matrikkelenhetsId !== null && snr) {
      // Hvis adresse har seksjonsnummer, hent polygon for den seksjonen
      try {
        polygonWKT = await matrikkelClient.getSectionPolygonWKT(
          {
            kommunenummer,
            gardsnummer: gnr,
            bruksnummer: bnr,
            seksjonsnummer: snr,
          },
          ctx()
        );
      } catch (e: any) {
        // Hvis det feiler (f.eks. ingen geometri for seksjon), la polygonWKT være null
        polygonWKT = null;
      }
    }
    if (!polygonWKT && matrikkelenhetsId !== null) {
      // Hvis vi ikke fikk en seksjons‐polygon, så prøv å hente polygon for hele matrikkelenheten (hele bygget)
      try {
        polygonWKT = await matrikkelClient.getBuildingPolygonWKT(
          {
            kommunenummer,
            gardsnummer: gnr,
            bruksnummer: bnr,
          },
          ctx()
        );
      } catch {
        polygonWKT = null;
      }
    }
    diag.polygon = { ok: !!polygonWKT, wkt: polygonWKT };

    /* ── 4) Enova  (uforandret) ─────────────────────────── */
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
      diag.enova.httpStatus = enovaStatus;
      diag.enova.ok = enovaStatus === 200;

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
            diag.enova.ok = true;
            diag.enova.retried = true;
          }
          diag.enova.httpStatus = retry.httpStatus;
        }
      }

      /* Enova kan gi BRA / byggeår hvis vi mangler det */
      if (enovaStatus === 200) {
        if (!byggår && energi?.enhet?.bygg?.byggeår)
          byggår = energi.enhet.bygg.byggeår;
        if (bra_m2_sum === 0 && energi?.enhet?.bruksareal)
          bra_m2_sum = energi.enhet.bruksareal;
      }
    } catch (e: any) {
      diag.enova.error = e.message;
    }

    /* ── 5) Geokoding  ───────────────────────────────────── */
    const { lat, lon } = await geocode(adresse);
    diag.geokoding = { ok: true, lat, lon };

    /* ── 6) PBE Solkart  (ENDRET: polygonWKT / gnr/bnr‐fallback / punkt 5m) ── */
    let takflater: SolarResponse["takflater"] = [];
    let takAreal_m2: number | null = null;
    let sol_kwh_m2_yr: number | null = null;
    let sol_kwh_bygg_tot: number | null = null;
    let solKategori: string | null = null;

    diag.solar = { ok: false as boolean, reference: null as number | null };

    try {
      let solarUrl: string;

      // 6.A) Hvis vi har polygonWKT, bruk den
      if (polygonWKT) {
        const encoded = encodeURIComponent(polygonWKT);
        solarUrl = `${SOLAR_URL}?polygon=${encoded}`;
      }
      // 6.B) Ellers, hvis vi har matrikkel‐parametre, bruk gnr/bnr(snr)
      else if (gnr && bnr) {
        const gnrPad = String(gnr).padStart(5, "0"); // 00073
        const bnrPad = String(bnr).padStart(4, "0"); // 0704
        solarUrl = snr
          ? `${SOLAR_URL}?gnr=${gnrPad}&bnr=${bnrPad}&snr=${snr}`
          : `${SOLAR_URL}?gnr=${gnrPad}&bnr=${bnrPad}`;
      }
      // 6.C) Ellers, hvis vi har lat/lon, bruk punktmetoden med delta=5
      else if (lat && lon) {
        solarUrl = `${SOLAR_URL}?lat=${lat}&lon=${lon}`;
      }
      // 6.D) Hvis ingen gyldige parametere, feilmeld
      else {
        throw new Error(
          "Ingen gyldig parameter for sol‐oppslag (polygon, gnr/bnr eller lat/lon)"
        );
      }

      const solarFetch = await fetch(solarUrl);
      if (!solarFetch.ok)
        throw new Error(`Solar-service → ${solarFetch.status}`);
      const solarRes = (await solarFetch.json()) as SolarResponse;

      takflater = solarRes.takflater;
      takAreal_m2 = solarRes.takflater.reduce((s, t) => s + t.area_m2, 0);
      sol_kwh_bygg_tot = solarRes.sol_kwh_bygg_tot;
      sol_kwh_m2_yr = solarRes.sol_kwh_m2_yr;
      solKategori = solarRes.category;

      diag.solar.ok = true;
      diag.solar.reference = solarRes.reference;
    } catch (e: any) {
      diag.solar.error = e.message;
    }

    /* ── 7) Kulturminne-sjekk (uforandret) ──────────────── */
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

    /* ── 8) Send resultat ───────────────────────────────── */
    const result = {
      kommunenummer,
      gardsnummer: gnr,
      bruksnummer: bnr,
      seksjonsnummer: snr,
      bruksenhetnr,
      matrikkelenhetsId,
      byggår,
      bra_m2: bra_m2_sum > 0 ? bra_m2_sum : null,
      bruksenheter,
      antEtasjer,
      bruksarealEtasjer,
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
app.listen(PORT, "0.0.0.0", () =>
  console.log(`[BIS] building-info-service ▶ ${PORT}`)
);

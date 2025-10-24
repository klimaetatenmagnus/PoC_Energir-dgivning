// services/solar-service/index.js
// ---------------------------------------------------------------------------
//  Henter solinnstråling fra PBE-Solkart 2024
//   • ?bygg_id=123456           (presist – prioritet 1)
//   • ?polygon=<WKT>            (seksjon / bygg-polygon)
//   • ?gnr=&bnr=[&snr=]         (hele matrikkelenheten)
//   • ?lat=&lon=[&delta=]       (punkt, default 10 m radius)                 ★
// ---------------------------------------------------------------------------

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import proj4 from "proj4";

/* ───────── SRID-definisjoner ─────────────────────────────────────────── */
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs"); // ★

/* ───────── Konstanter ────────────────────────────────────────────────── */
const app = express();
const REF_OSLO = Number(process.env.SOLAR_REFERENCE_KWH ?? "1005"); // kWh/m²·år
const SOLAR_CACHE_TTL = Number(process.env.SOLAR_CACHE_TTL ?? "3600");
const CACHE = new NodeCache({
  stdTTL: SOLAR_CACHE_TTL,
  checkperiod: Math.max(60, Math.floor(SOLAR_CACHE_TTL / 3)),
}); // cache TTL
const WFS_URL =
  process.env.SOLAR_WFS_URL ?? "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
const MAP_FILE =
  process.env.SOLAR_MAP_FILE ?? "d:/data_mapserver/kartfiler/solkart.map";
const LAYER = process.env.SOLAR_LAYER ?? "takflater2024";
const DEFAULT_POINT_DELTA = Number(process.env.SOLAR_POINT_DELTA ?? "10");
const MIN_RADIATION = Number(process.env.SOLAR_MIN_RADIATION ?? "800");
const SOLAR_PANEL_EFFICIENCY = Number(
  process.env.SOLAR_PANEL_EFFICIENCY ?? "0.2"
);

const infoLog = (...args) => console.warn('[solar-service]', ...args);
const errorLog = (...args) => console.error('[solar-service:error]', ...args);
const MOCK_MODE =
  process.env.SOLAR_SERVICE_MOCK === "1" ||
  process.env.SOLAR_SERVICE_MOCK?.toLowerCase() === "true";

app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/* ───────── Mini-helper for WFS-kall ───────────────────────────────────── */
async function wfsCall(params) {
  const res = await fetch(`${WFS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  return res.text(); // XML som string
}

/* ───────── GML → takflate-array ──────────────────────────────────────── */
function parseFeatureMembers(xml) {
  const feats =
    xml.match(/<ms:takflater2024[\s\S]*?<\/ms:takflater2024>/gi) || [];

  return feats.map((blk) => {
    const tag = (t) =>
      (blk.match(new RegExp(`<ms:${t}>([0-9.,-]+)<\\/ms:${t}>`, "i")) || [])[1];

    const takId = Number(tag("TAK_ID"));
    const byggId = Number(tag("BYGG_ID")); // ★ NYTT
    const area = Number(tag("AREA").replace(",", "."));
    const irr = Number(tag("SUM_AAR_KWH").replace(",", "."));

    return {
      tak_id: takId,
      bygg_id: byggId || null, // ★
      area_m2: area,
      irr_kwh_m2_yr: irr,
      kWh_tot: irr * area,
    };
  });
}

/* ───────── 1) BYGG_ID-filter ─────────────────────────────────────────── */
async function takflaterForByggId(id) {
  const filter = `<Filter xmlns="http://www.opengis.net/ogc">
    <PropertyIsEqualTo><PropertyName>BYGG_ID</PropertyName><Literal>${id}</Literal></PropertyIsEqualTo>
  </Filter>`;

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    FILTER: filter,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

/* ───────── 2) Polygon-filter ─────────────────────────────────────────── */
async function takflaterForPolygon(wkt) {
  const cql = `INTERSECTS(msGeometry, SRID=32632;${wkt})`;

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    CQL_FILTER: cql,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

/* ───────── 3) Matrikkel-filter ───────────────────────────────────────── */
async function takflaterForMatrikkel(gnr, bnr, snr) {
  const parts = [
    `<PropertyIsEqualTo><PropertyName>GNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>`,
    `<PropertyIsEqualTo><PropertyName>BNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>`,
  ];
  if (snr) {
    parts.push(
      `<PropertyIsEqualTo><PropertyName>SNR</PropertyName><Literal>${snr}</Literal></PropertyIsEqualTo>`
    );
  }
  const filter = `<Filter xmlns="http://www.opengis.net/ogc"><And>${parts.join(
    ""
  )}</And></Filter>`;

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    FILTER: filter,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

/* ───────── 4) Punkt-query (lat/lon → 32632) ──────────────────────────── */
async function takflaterFromPoint(lat, lon, delta = DEFAULT_POINT_DELTA) {
  // ★ +delta
  const [east, north] = proj4("EPSG:4326", "EPSG:32632", [
    parseFloat(lon),
    parseFloat(lat),
  ]);

  const bbox = [east - delta, north - delta, east + delta, north + delta].join(
    ","
  );

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    SRSNAME: "EPSG:32632",
    BBOX: bbox,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

/* ───────── Kategorisering ────────────────────────────────────────────── */
function categorize(avg, ref = REF_OSLO) {
  const pct = (avg / ref) * 100;
  if (pct < 75) return "Svært lavt";
  if (pct < 90) return "Lavt";
  if (pct <= 110) return "Gjennomsnittlig";
  if (pct <= 125) return "Godt";
  return "Svært godt";
}

/* ───────── Endpoint /solinnstraling ──────────────────────────────────── */
app.get("/solinnstraling", async (req, res) => {
  try {
    const { bygg_id, polygon, gnr, bnr, snr, lat, lon, delta } = req.query;

    if (MOCK_MODE) {
      const mockByggId = bygg_id ? Number.parseInt(String(bygg_id), 10) || 1 : 1;
      const mockTakflater = [
        {
          tak_id: mockByggId * 10 + 1,
          bygg_id: mockByggId,
          area_m2: 120,
          irr_kwh_m2_yr: 950,
          kWh_tot: 114_000,
        },
        {
          tak_id: mockByggId * 10 + 2,
          bygg_id: mockByggId,
          area_m2: 60,
          irr_kwh_m2_yr: 820,
          kWh_tot: 49_200,
        },
      ];

      const mockSumPot = mockTakflater.reduce((sum, tak) => sum + tak.kWh_tot, 0);
      const mockSumArea = mockTakflater.reduce((sum, tak) => sum + tak.area_m2, 0);
      const mockAvgIrr = mockSumArea ? mockSumPot / mockSumArea : null;

      return res.json({
        reference: REF_OSLO,
        takflater: mockTakflater,
        takAreal_m2: mockSumArea,
        sol_kwh_m2_yr: mockAvgIrr,
        sol_kwh_bygg_tot: mockSumPot,
        filteredSolarEnergy: mockSumPot * SOLAR_PANEL_EFFICIENCY,
        category: mockAvgIrr ? categorize(mockAvgIrr) : "Ukjent",
      });
    }

    const cacheKey = JSON.stringify(req.query);
    const hit = CACHE.get(cacheKey);
    if (hit) return res.json(hit);

    let takflater = [];

    /* -------- Søkeprioritet ------------------------------------------------ */
    if (bygg_id) {
      takflater = await takflaterForByggId(sanitizeByggId(bygg_id));
    } else if (typeof polygon === "string" && polygon.trim()) {
      takflater = await takflaterForPolygon(polygon);
    } else if (gnr && bnr) {
      takflater = await takflaterForMatrikkel(
        String(gnr).padStart(5, "0"),
        String(bnr).padStart(4, "0"),
        snr
      );
    } else if (lat && lon) {
      const parsedDelta = delta ? Number(delta) || DEFAULT_POINT_DELTA : DEFAULT_POINT_DELTA;
      const initial = await takflaterFromPoint(lat, lon, parsedDelta);

      if (initial.length && initial[0].bygg_id) {
        // ★ full BYGG
        takflater = await takflaterForByggId(initial[0].bygg_id);
        if (!takflater.length) takflater = initial; // fallback
      } else {
        takflater = initial;
      }
    } else {
      return res.status(400).json({
        error: "Oppgi bygg_id, polygon, gnr/bnr eller lat/lon",
      });
    }

    /* -------- Ingen treff? ------------------------------------------------- */
    if (!takflater.length) {
      return res.status(404).json({ error: "Ingen takflater funnet" }); // ★
    }

    /* -------- Summering / aggregering ------------------------------------- */
    const sumPot = takflater.reduce((s, t) => s + t.kWh_tot, 0);
    const sumArea = takflater.reduce((s, t) => s + t.area_m2, 0);
    const avgIrr = sumArea ? sumPot / sumArea : null;
    const filteredSolarEnergy = takflater
      .filter((tak) => (tak.irr_kwh_m2_yr ?? 0) > MIN_RADIATION)
      .reduce((sum, tak) => {
        const irr = tak.irr_kwh_m2_yr ?? 0;
        const area = tak.area_m2 ?? 0;
        return sum + irr * area * SOLAR_PANEL_EFFICIENCY;
      }, 0);

    const result = {
      reference: REF_OSLO,
      takflater,
      takAreal_m2: sumArea || null,
      sol_kwh_m2_yr: avgIrr,
      sol_kwh_bygg_tot: sumPot,
      filteredSolarEnergy,
      category: avgIrr ? categorize(avgIrr) : "Ukjent",
    };

    CACHE.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    errorLog('Feil i request handler', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───────── Start server ──────────────────────────────────────────────── */
const PORT = Number(process.env.SOLAR_SERVICE_PORT ?? process.env.PORT ?? 4003);
const HOST = process.env.SOLAR_SERVICE_HOST ?? "0.0.0.0";
app.listen(PORT, HOST, () =>
  infoLog(`Lytter på port ${HOST}:${PORT}`)
);

/* ---------------- helper for trygg BYGG_ID ----------------------------- */
function sanitizeByggId(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Ugyldig bygg_id");
  return String(n);
}

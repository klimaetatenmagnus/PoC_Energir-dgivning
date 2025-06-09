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
const CACHE = new NodeCache({ stdTTL: 3_600, checkperiod: 120 }); // 1 t
const REF_OSLO = 1005; // kWh/m²·år
const WFS_URL = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
const MAP_FILE = "d:/data_mapserver/kartfiler/solkart.map";
const LAYER = "takflater2024";

app.use(cors());

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
async function takflaterFromPoint(lat, lon, delta = 10) {
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
      const d = delta ? Number(delta) || 10 : 10; // ★ delta
      const initial = await takflaterFromPoint(lat, lon, d);

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

    const result = {
      reference: REF_OSLO,
      takflater,
      takAreal_m2: sumArea || null,
      sol_kwh_m2_yr: avgIrr,
      sol_kwh_bygg_tot: sumPot,
      category: avgIrr ? categorize(avgIrr) : "Ukjent",
    };

    CACHE.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("[solar-service]", err);
    res.status(500).json({ error: err.message });
  }
});

/* ───────── Start server ──────────────────────────────────────────────── */
const PORT = process.env.PORT || 4003;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`solar-service ▶ lytter på ${PORT}`)
);

/* ---------------- helper for trygg BYGG_ID ----------------------------- */
function sanitizeByggId(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Ugyldig bygg_id");
  return String(n);
}

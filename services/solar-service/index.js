// services/solar-service/index.js
// ---------------------------------------------------------------------------
//  Henter solinnstråling fra PBE Solkart – enten
//    • for alle takflater på en matrikkelenhet (gnr/bnr/snr), ELLER
//    • for ett punkt (lat/lon) hvor én eller flere takflater treffer.
//  Returnerer liste over flater { tak_id, area_m2, irr_kwh_m2_yr, kWh_tot }.
// ---------------------------------------------------------------------------

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import proj4 from "proj4";

proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");

const app = express();
app.use(cors());

// Cache 1 time
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Konstant referanse (kWh/m²·år) – brukt til kategori-inndeling
const REF_OSLO = 1005;

// ArcGIS FeatureService for takflater
const ARCGIS_URL =
  "https://od2.pbe.oslo.kommune.no/arcgis/rest/services/Solkart/Solkart_Takflater/MapServer/0/query";

// MapServer-WFS (punkt-oppslag)
const WFS_URL = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
const MAP_FILE = "d:/data_mapserver/kartfiler/solkart.map";
const LAYER = "takflater2024";

// ---------------------------------------------------------------------------
// 1. FeatureService-kall – matrikkelenhet
// ---------------------------------------------------------------------------
async function queryTakflater(where) {
  const params = new URLSearchParams({
    where,
    outFields: "tak_id,areal_m2,irr_år",
    returnGeometry: "false",
    f: "json",
  });

  const res = await fetch(`${ARCGIS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
  const j = await res.json();
  if (!Array.isArray(j.features)) return [];

  return j.features.map((f) => {
    const area = Number(String(f.attributes.areal_m2).replace(",", "."));
    const irr = Number(String(f.attributes.irr_år).replace(",", "."));
    return {
      tak_id: f.attributes.tak_id,
      area_m2: area,
      irr_kwh_m2_yr: irr,
      kWh_tot: irr * area,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. WFS-kall – liten BBOX rundt punkt
// ---------------------------------------------------------------------------
function parseFeatureMembers(xml) {
  const blocks =
    xml.match(/<ms:takflater2024[\s\S]*?<\/ms:takflater2024>/gi) || [];
  return blocks.map((blk) => {
    const g = (tag) =>
      (blk.match(new RegExp(`<ms:${tag}>([0-9.,]+)<\\/ms:${tag}>`, "i")) ||
        [])[1];
    const id = Number(g("TAK_ID"));
    const area = Number(String(g("AREA")).replace(",", "."));
    const irr = Number(String(g("SUM_AAR_KWH")).replace(",", "."));
    return {
      tak_id: id,
      area_m2: area,
      irr_kwh_m2_yr: irr,
      kWh_tot: irr * area,
    };
  });
}

async function takflaterFromPoint(lat, lon) {
  // transform WGS84 → UTM32
  const [easting, northing] = proj4("EPSG:4326", "EPSG:32632", [
    parseFloat(lon),
    parseFloat(lat),
  ]);
  const delta = 10; // m
  const bbox = [
    easting - delta,
    northing - delta,
    easting + delta,
    northing + delta,
  ].join(",");

  const params = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    SRSNAME: "EPSG:32632",
    BBOX: bbox,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const res = await fetch(`${WFS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  const xml = await res.text();
  return parseFeatureMembers(xml);
}

// ---------------------------------------------------------------------------
// Kategori basert på referanse
// ---------------------------------------------------------------------------
function categorize(avgIrr, ref = REF_OSLO) {
  const pct = (avgIrr / ref) * 100;
  if (pct < 75) return "Svært lavt";
  if (pct < 90) return "Lavt";
  if (pct <= 110) return "Gjennomsnittlig";
  if (pct <= 125) return "Godt";
  return "Svært godt";
}

// ---------------------------------------------------------------------------
// HTTP-endpoint
// ---------------------------------------------------------------------------
app.get("/solinnstraling", async (req, res) => {
  try {
    const { lat, lon, gnr, bnr, snr } = req.query;

    const cacheKey = `solar:${lat ?? ""},${lon ?? ""},${gnr ?? ""}/${
      bnr ?? ""
    }/${snr ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    let takflater = [];

    // ------- A) matrikkelenhet
    if (gnr && bnr) {
      const where =
        `gnr=${Number(gnr)} AND bnr=${Number(bnr)}` +
        (snr ? ` AND snr=${Number(snr)}` : "");
      takflater = await queryTakflater(where);
    }
    // ------- B) punkt
    else if (lat && lon) {
      takflater = await takflaterFromPoint(lat, lon);
    } else {
      return res.status(400).json({ error: "Oppgi lat/lon eller gnr/bnr" });
    }

    // summer
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

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("solar-service:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 4003;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`solar-service ▶ lytter på ${PORT}`)
);

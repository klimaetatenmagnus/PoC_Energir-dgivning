// services/solar-service/index.js
// ---------------------------------------------------------------------------
//  Henter solinnstråling fra PBE Solkart – enten
//    • med en polygon (WKT) for nøyaktig seksjon eller bygg, ELLER
//    • for alle takflater på en matrikkelenhet (gnr/bnr/snr), ELLER
//    • for ett punkt (lat/lon) med fuzzy‐areal på 5 m.
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

// Konstant referanse (kWh/m²·år) – brukt til kategori‐inndeling
const REF_OSLO = 1005;

// WFS‐tjeneste (MapServer/WFS, brukt både til polygon‐ og punkt‐oppslag)
const WFS_URL = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
const MAP_FILE = "d:/data_mapserver/kartfiler/solkart.map";
const LAYER = "takflater2024";

// ---------------------------------------------------------------------------
// 1) WFS‐kall – med CQL_FILTER basert på en polygon (WKT)
// ---------------------------------------------------------------------------
async function takflaterForPolygon(polygonWKT) {
  // Vi sender CQL_FILTER=INTERSECTS(msGeometry, SRID=32632;<WKT>)
  const cql = `INTERSECTS(msGeometry, SRID=32632;${polygonWKT})`;
  console.debug("[solar-service] CQL_FILTER:", cql);

  const params = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    CQL_FILTER: cql,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const url = `${WFS_URL}?${params.toString()}`;
  console.debug("[solar-service] WFS‐URL:", url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  const xml = await res.text();
  return parseFeatureMembers(xml);
}

// ---------------------------------------------------------------------------
// 2) WFS‐kall – matrikkelenhet (samme logikk som før, men vi padder gnr/bnr)
// ---------------------------------------------------------------------------
async function takflaterForMatrikkel(gnr, bnr, snr) {
  const filterParts = [
    `<PropertyIsEqualTo><PropertyName>GNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>`,
    `<PropertyIsEqualTo><PropertyName>BNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>`,
  ];
  if (snr) {
    filterParts.push(
      `<PropertyIsEqualTo><PropertyName>SNR</PropertyName><Literal>${snr}</Literal></PropertyIsEqualTo>`
    );
  }
  const filterXml = `<Filter xmlns="http://www.opengis.net/ogc"><And>${filterParts.join(
    ""
  )}</And></Filter>`;

  console.debug("[solar-service] WFS-filter:", filterXml);

  const params = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    FILTER: filterXml,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const res = await fetch(`${WFS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  const xml = await res.text();
  return parseFeatureMembers(xml);
}

// ---------------------------------------------------------------------------
// 3) Hjelper for å parse ut takflater fra WFS‐respons (GML)
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

// ---------------------------------------------------------------------------
// 4) Punkt‐metode (lat/lon) – med fuzzy‐areal = 5 meter (ikke 10!)
// ---------------------------------------------------------------------------
async function takflaterFromPoint(lat, lon) {
  // transform WGS84 → UTM32
  const [easting, northing] = proj4("EPSG:4326", "EPSG:32632", [
    parseFloat(lon),
    parseFloat(lat),
  ]);
  const delta = 5; // <— fuzzy‐areal: 5 meter (ned fra 10)
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
// 5) Kategori basert på referanse
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
// 6) HTTP‐endpoint
// ---------------------------------------------------------------------------
app.get("/solinnstraling", async (req, res) => {
  try {
    const { lat, lon, gnr, bnr, snr, polygon } = req.query;

    // Lag en cache‐nøkkel som inkluderer polygon (hvis tilstede)
    const cacheKey = `solar:${polygon ?? ""}|${lat ?? ""},${lon ?? ""},${
      gnr ?? ""
    }/${bnr ?? ""}/${snr ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    let takflater = [];

    // 6.A) Hvis vi fikk polygon‐WKT fra Building‐Info Service, bruk det
    if (typeof polygon === "string" && polygon.trim().length) {
      takflater = await takflaterForPolygon(polygon);
    }
    // 6.B) Ellers, hvis vi har matrikkel‐parametre, bruk takflaterForMatrikkel
    else if (gnr && bnr) {
      // Padd gnr/ bnr slik at de matcher datalagets format
      const gnrPad = String(gnr).padStart(5, "0");
      const bnrPad = String(bnr).padStart(4, "0");
      takflater = await takflaterForMatrikkel(gnrPad, bnrPad, snr);
    }
    // 6.C) Ellers, hvis vi har lat/lon, bruk punkt‐metoden med delta=5
    else if (lat && lon) {
      takflater = await takflaterFromPoint(lat, lon);
    }
    // 6.D) Hvis ingen av metodene er mulige, feilmeld
    else {
      return res
        .status(400)
        .json({ error: "Oppgi polygon, lat/lon eller gnr/bnr" });
    }

    // Summér alle takflater
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
// 7) Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 4003;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`solar-service ▶ lytter på ${PORT}`)
);

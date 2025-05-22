// services/solar-service/index.js

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import proj4 from "proj4";

// Definer UTM zone 32N projeksjon
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");

const app = express();
app.use(cors());

// Cache (TTL 1 time)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Konstant referanseverdi for Oslo (kWh/m²/år)
const REF_OSLO = 1005;

// WFS-endepunkt for Solkart og map-file path
const WFS_BASE_URL = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
const MAP_FILE = "d:/data_mapserver/kartfiler/solkart.map";
const TYPENAME = "takflater2024";

// Returnerer referanseverdien for Oslo
async function getReference() {
  return REF_OSLO;
}

// Henter solinnstråling for punkt via WFS GetFeature (XML)
async function fetchSolinnstraling(lat, lon) {
  // Konverter fra WGS84 til UTM32N
  const [easting, northing] = proj4("EPSG:4326", "EPSG:32632", [
    parseFloat(lon),
    parseFloat(lat),
  ]);
  const delta = 10; // meter
  const minX = easting - delta;
  const minY = northing - delta;
  const maxX = easting + delta;
  const maxY = northing + delta;

  const params = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: TYPENAME,
    SRSNAME: "EPSG:32632",
    BBOX: `${minX},${minY},${maxX},${maxY}`,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });
  const url = `${WFS_BASE_URL}?${params.toString()}`;

  const apiRes = await fetch(url);
  if (!apiRes.ok) throw new Error(`WFS-feil: ${apiRes.status}`);
  const xmlText = await apiRes.text();
  const match = xmlText.match(/<ms:SUM_AAR_KWH>([0-9.,]+)<\/ms:SUM_AAR_KWH>/i);
  if (!match) throw new Error("Kan ikke finne SUM_AAR_KWH i XML-respons");

  const raw = match[1].replace(/,/g, ".");
  const solValue = parseFloat(raw);
  if (isNaN(solValue)) throw new Error("Ugyldig soldata fra XML: " + raw);
  return solValue;
}

// Kategorisering mot referanse
function categorize(solValue, refValue) {
  const pct = (solValue / refValue) * 100;
  if (pct < 75) return "Svært lavt";
  if (pct < 90) return "Lavt";
  if (pct <= 110) return "Gjennomsnittlig";
  if (pct <= 125) return "Godt";
  return "Svært godt";
}

// Endpoint for solinnstråling
app.get("/solinnstraling", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: "Mangler eller ugyldig lat/lon" });
    }

    const cacheKey = `solar:${lat},${lon}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const solValue = await fetchSolinnstraling(lat, lon);
    const refValue = await getReference();
    const category = categorize(solValue, refValue);

    const result = { solinnstraling: solValue, reference: refValue, category };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("Feil i solar-service:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start server på alle grensesnitt
const PORT = process.env.PORT || 4002;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`solar-service kjører på port ${PORT}`)
);

// services/building-info-service/index.js

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import proj4 from "proj4";

const app = express();
app.use(cors());

// Cache (TTL: 1 time)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Projeksjoner for koordinatkonvertering
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");

// WFS-endepunkt og kartfil for BBR-bygg (MapServer-fil)
const WFS_BASE_URL = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
const MAP_FILE = "d:/data_mapserver/kartfiler/BBR_BYGG.map";
const TYPENAME = "BBR_BYGG";

// WFS-endepunkt for Byantikvaren/Askeladden kulturminner
const PROT_WFS_URL =
  "https://ws.geonorge.no/kulturminne/fkb_historiske_bygninger";
const PROT_TYPENAME = "hbf_histbygning";

// Enova energimerkeregister (fallback)
const ENOVA_API_URL = "https://api.enova.no/energi/certificate/v1/addresses";
const ENOVA_API_KEY =
  process.env.ENOVA_API_KEY || "0c5e4a53ce3d4262b3371de8a499c9ca";

// Geokoding via OSM Nominatim
async function geocode(adresse) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    adresse
  )}&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GrønnHusSjekk/1.0" },
  });
  if (!res.ok) throw new Error(`Geokode-feil: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data[0])
    throw new Error("Ingen adresse funnet via geokoding");
  const lat = parseFloat(data[0].lat);
  const lon = parseFloat(data[0].lon);
  if (isNaN(lat) || isNaN(lon))
    throw new Error("Ugyldig koordinatdata fra geokoding");
  return { lat, lon };
}

// Beregn område for polygon i UTM (meter)
function calculateArea(coords) {
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[(i + 1) % coords.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

app.get("/lookup", async (req, res) => {
  console.log("🔔 /lookup kalt med query:", req.query);
  try {
    const adresse = req.query.adresse;
    if (typeof adresse !== "string") {
      return res.status(400).json({ error: "Mangler adresse" });
    }

    const cacheKey = `build:${adresse}`;
    // const cached = cache.get(cacheKey)
    // if (cached) return res.json(cached)

    // 1) Geokode adresse
    const { lat, lon } = await geocode(adresse);

    // 2) Konverter til UTM32N
    const [easting, northing] = proj4("EPSG:4326", "EPSG:32632", [lon, lat]);
    const deltaM = 50;
    const minX = easting - deltaM,
      minY = northing - deltaM;
    const maxX = easting + deltaM,
      maxY = northing + deltaM;

    // 3) Prøv WFS-kall for BBR-data
    let byggår = null;
    let bra_m2 = null;
    let bruksenheter = 1;
    let footprint_m2 = null;

    const params = new URLSearchParams({
      map: MAP_FILE,
      SERVICE: "WFS",
      VERSION: "1.1.0",
      REQUEST: "GetFeature",
      TYPENAME,
      SRSNAME: "EPSG:32632",
      BBOX: `${minX},${minY},${maxX},${maxY}`,
      OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
    });
    const wfsUrl = `${WFS_BASE_URL}?${params.toString()}`;
    console.log("BBR WFS-URL:", wfsUrl);

    try {
      const wfsRes = await fetch(wfsUrl);
      const xml = await wfsRes.text();
      console.log("RAW BBR WFS XML:", xml);
      if (
        !xml ||
        xml.includes("Unable to access file") ||
        xml.includes("<gml:Null>")
      ) {
        throw new Error("WFS-data utilgjengelig");
      }

      const byggårMatch =
        xml.match(/<ms:BYGGEÅR>(\d+)<\/ms:BYGGEÅR>/i) ||
        xml.match(/<ms:BYGGEAAR>(\d+)<\/ms:BYGGEAAR>/i);
      if (byggårMatch) byggår = parseInt(byggårMatch[1], 10);

      const braMatch =
        xml.match(/<ms:BRA_M2>([0-9.,]+)<\/ms:BRA_M2>/i) ||
        xml.match(/<ms:AREAL_BRA>([0-9.,]+)<\/ms:AREAL_BRA>/i);
      if (braMatch) bra_m2 = parseFloat(braMatch[1].replace(",", "."));

      const brukMatch = xml.match(
        /<ms:ANT_BRUKSENHETER>(\d+)<\/ms:ANT_BRUKSENHETER>/i
      );
      if (brukMatch) bruksenheter = parseInt(brukMatch[1], 10);

      const posMatch = xml.match(
        /<gml:posList[^>]*>([\s0-9.]+)<\/gml:posList>/i
      );
      if (posMatch) {
        const nums = posMatch[1].trim().split(/\s+/).map(Number);
        const coords = [];
        for (let i = 0; i < nums.length; i += 2)
          coords.push([nums[i], nums[i + 1]]);
        footprint_m2 = calculateArea(coords);
      }
    } catch (wfsErr) {
      console.warn("WFS-feil:", wfsErr.message);
      console.log("Fallback til Enova energimerke");
      const certUrl = `${ENOVA_API_URL}?address=${encodeURIComponent(adresse)}`;
      console.log("Enova URL:", certUrl);
      try {
        const certRes = await fetch(certUrl, {
          headers: { "x-api-key": ENOVA_API_KEY },
        });
        console.log("Enova status:", certRes.status, certRes.statusText);
        if (certRes.ok) {
          const certText = await certRes.text();
          console.log("Enova respons (tekst):", certText);
          const certData = JSON.parse(certText);
          const entry = Array.isArray(certData.addresses)
            ? certData.addresses[0]
            : certData;
          byggår = entry.builderYear ?? byggår;
          bra_m2 = entry.grossFloorArea ?? bra_m2;
          bruksenheter = entry.numberOfUnits ?? bruksenheter;
        } else {
          console.warn("Enova API feilet med status", certRes.status);
        }
      } catch (e) {
        console.error("Enova fallback-feil:", e);
      }
    }

    // 4) Kulturminne-sjekk (Byantikvaren)
    let isProtected = false;
    try {
      const protParams = new URLSearchParams({
        service: "WFS",
        version: "1.1.0",
        request: "GetFeature",
        typeName: PROT_TYPENAME,
        SRSNAME: "EPSG:4326",
        BBOX: `${lon - deltaM / 1000},${lat - deltaM / 1000},${
          lon + deltaM / 1000
        },${lat + deltaM / 1000}`,
      });
      const protUrl = `${PROT_WFS_URL}?${protParams.toString()}`;
      console.log("Protected WFS-URL:", protUrl);
      const protRes = await fetch(protUrl);
      const protXml = await protRes.text();
      isProtected = /<gml:featureMember>/i.test(protXml);
    } catch (e) {
      console.warn("Kulturminne-sjekk feilet:", e.message);
    }

    const result = {
      byggår,
      bra_m2,
      bruksenheter,
      footprint_m2,
      lat,
      lon,
      isProtected,
    };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error("Feil i building-info-service:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`building-info-service kjører på port ${PORT}`)
);

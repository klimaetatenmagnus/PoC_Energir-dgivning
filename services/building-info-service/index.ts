// services/building-info-service/index.js
// ---------------------------------------------------------------------------
// Henter bygningsdata for én adresse:
//   • Kartverket → kommune/gnr/bnr/lat/lon
//   • Matrikkel → matrikkelenhetsID, byggID, Bygg-boble
//   • Enova → energimerke (fallback BRA/byggår)
//   • Kulturminne-WFS
// ---------------------------------------------------------------------------

import "dotenv/config"; // ← laster .env automatisk
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import proj4 from "proj4";

import { MatrikkelClient } from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient } from "../../src/clients/StoreClient.ts";

// ──────────────── instanser & konstanter ──────────────────────
const {
  MATRIKKEL_API_BASE_URL_TEST: BASE,
  MATRIKKEL_USERNAME_TEST: USER,
  MATRIKKEL_PASSWORD: PASS,
  ENOVA_API_KEY,
} = process.env;

const matrikkelClient = new MatrikkelClient(BASE, USER, PASS);
const bygningClient = new BygningClient(BASE, USER, PASS);
const storeClient = new StoreClient(BASE, USER, PASS);

const cache = new NodeCache({ stdTTL: 86_400, checkperiod: 600 });

proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");

const PROT_WFS_URL =
  "https://ws.geonorge.no/kulturminne/fkb_historiske_bygninger";
const PROT_TYPENAME = "hbf_histbygning";
const ENOVA_API_URL =
  "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest";

// ──────────────── helper: MatrikkelContext ────────────────────
const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "proxy",
  snapshotVersion: "9999-01-01T00:00:00+01:00",
});

// ──────────────── helper: Kartverket, Enova, Geocode ───────────
async function lookupKartverket(adresse) {
  const r = await fetch(
    "https://ws.geonorge.no/adresser/v1/sok?sok=" +
      encodeURIComponent(adresse) +
      "&treffPerSide=1&fuzzy=true",
    { headers: { "User-Agent": "Energiverktøy/1.0" } }
  );
  const j = await r.json();
  if (!j.adresser?.length) throw new Error("Kartverket fant ikke adresse");
  const a = j.adresser[0];
  return {
    kommunenummer: a.kommunenummer ?? a.kommunekode ?? null,
    gnr: a.matrikkelnummer?.gaardsnummer ?? a.gardsnummer ?? null,
    bnr: a.matrikkelnummer?.bruksnummer ?? a.bruksnummer ?? null,
  };
}

async function fetchEnergiattest({ kommunenummer, gnr, bnr }) {
  if (!kommunenummer || !gnr || !bnr) return null;
  const payload = {
    kommunenummer,
    gardsnummer: String(gnr),
    bruksnummer: String(bnr),
    bruksenhetnummer: "",
    seksjonsnummer: "",
  };
  const r = await fetch(ENOVA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Energiverktøy/1.0",
      "x-api-key": ENOVA_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Enova " + r.status);
  const list = await r.json();
  return Array.isArray(list) && list[0] ? list[0] : null;
}

async function geocode(adresse) {
  const r = await fetch(
    "https://nominatim.openstreetmap.org/search?format=json&q=" +
      encodeURIComponent(adresse) +
      "&limit=1",
    { headers: { "User-Agent": "Energiverktøy/1.0" } }
  );
  const j = await r.json();
  if (!j[0]) throw new Error("Adresse ikke funnet i Nominatim");
  return { lat: +j[0].lat, lon: +j[0].lon };
}

// ──────────────── route ────────────────────────────────────────
const app = express();
app.use(cors());

app.get("/lookup", async (req, res) => {
  const adresse = req.query.adresse;
  if (typeof adresse !== "string")
    return res.status(400).json({ error: "Mangler adresse" });

  const cacheKey = `build:${adresse}`;
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  try {
    // 1) Kartverket
    const { kommunenummer, gnr, bnr } = await lookupKartverket(adresse);
    if (!gnr || !bnr)
      return res
        .status(404)
        .json({ error: "Adressen mangler entydig gnr/bnr i Kartverket." });

    // 2) matrikkelenhets-ID
    const [matrikkelenhetsId] =
      (await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer,
          status: "BESTAENDE",
          gardsnummer: gnr,
          bruksnummer: bnr,
        },
        ctx()
      )) ?? [];

    // 3) Bygg-ID → Bygg-boble
    let byggår = null,
      bra_m2 = null,
      bruksenheter = null;
    if (matrikkelenhetsId) {
      const byggIds = await bygningClient.findByggIds(matrikkelenhetsId, ctx());
      if (byggIds.length) {
        const info = await storeClient.getBygg(byggIds[0], ctx());
        byggår = info.byggeår;
        bra_m2 = info.bruksareal;
        bruksenheter = info.antBruksenheter;
      }
    }

    // 4) Enova energimerke (+ fallback)
    let energi = null;
    try {
      energi = await fetchEnergiattest({ kommunenummer, gnr, bnr });
      if (!byggår && energi?.enhet?.bygg?.byggeår)
        byggår = energi.enhet.bygg.byggeår;
      if (!bra_m2 && energi?.enhet?.bruksareal)
        bra_m2 = energi.enhet.bruksareal;
    } catch (e) {
      console.warn("Enova:", e.message);
    }

    // 5) geokoding
    const { lat, lon } = await geocode(adresse);

    // 6) kulturminne
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
    } catch (e) {
      console.warn("Kulturminne:", e.message);
    }

    const result = {
      kommunenummer,
      gardsnummer: gnr,
      bruksnummer: bnr,
      matrikkelenhetsId,
      byggår,
      bra_m2,
      bruksenheter,
      lat,
      lon,
      isProtected,
      energikarakter: energi?.energiytelse?.energikarakter ?? null,
      oppvarmingskarakter: energi?.energiytelse?.oppvarmingskarakter ?? null,
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 4002, "0.0.0.0", () =>
  console.log("building-info-service ▶ 4002")
);

// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
// REST-tjeneste som kobler Adresse  ➜  Matrikkel  ➜  Bygg  ➜  (Energiattest)
// Nå med robust lookupAdresse (url-enkoding + debug)                    v1.2
// ---------------------------------------------------------------------------

import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import NodeCache from "node-cache";
import fetch from "node-fetch";

import { MatrikkelClient } from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient, PBE_EPSG } from "../../src/clients/StoreClient.ts";

/* ───────────────── MILJØVARIABLER ───────────────── */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Mangler miljøvariabel ${name}`);
  return v;
}
const BASE_URL = requireEnv("MATRIKKEL_API_BASE_URL_TEST");
const USERNAME = requireEnv("MATRIKKEL_USERNAME_TEST");
const PASSWORD = requireEnv("MATRIKKEL_PASSWORD");
const ENOVA_KEY = process.env.ENOVA_API_KEY ?? "";
const PORT = Number(process.env.PORT) || 4000;
const LOG_SOAP = process.env.LOG_SOAP === "1";

/* ───────────────── KLIENT-INSTANSER ─────────────── */
const matrikkelClient = new MatrikkelClient(BASE_URL, USERNAME, PASSWORD);
const bygningClient = new BygningClient(BASE_URL, USERNAME, PASSWORD);
const storeClient = new StoreClient(BASE_URL, USERNAME, PASSWORD);

/* cache: 24 t */
const cache = new NodeCache({ stdTTL: 86_400, checkperiod: 600 });

/* ───────────────── Felles context ───────────────── */
const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "building-info-service",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

/* ───────────────── Adresseoppslag (Geonorge) ────── */
interface KartverketSokRespons {
  adresser: {
    kommunenummer?: string;
    kommunekode?: string;
    matrikkelnummer?: { gaardsnummer?: number; bruksnummer?: number };
    gardsnummer?: number;
    bruksnummer?: number;
  }[];
}

async function lookupAdresse(adresse: string) {
  // første forsøk – original streng
  const res = await tryKartverket(adresse);
  if (res) return res;

  // reserveforsøk – fjern komma
  const alt = adresse.replace(/,/g, " ");
  if (alt !== adresse) {
    if (LOG_SOAP) console.log("⇢ Reserve-søke­streng:", alt);
    const res2 = await tryKartverket(alt);
    if (res2) return res2;
  }

  throw new Error(`Kartverket fant ikke adresse: «${adresse}»`);
}

/* Hjelper: kaller API-et og parser resultat */
async function tryKartverket(streng: string) {
  const qs = new URLSearchParams({
    sok: streng,
    treffPerSide: "1",
    fuzzy: "true",
  });
  const url = `https://ws.geonorge.no/adresser/v1/sok?${qs.toString()}`;

  const r = await fetch(url, {
    headers: { "User-Agent": "Energiverktøy/1.0" },
  });
  if (LOG_SOAP) console.log("Geonorge:", url, "→", r.status);

  if (!r.ok) throw new Error(`Kartverket utilgjengelig (HTTP ${r.status})`);

  const text = await r.text();
  const j = JSON.parse(text) as KartverketSokRespons;

  if (!Array.isArray(j.adresser) || j.adresser.length === 0) {
    if (LOG_SOAP)
      console.log("⚠️  tomt resultat, body:", text.slice(0, 500), "…");
    return null;
  }

  const a = j.adresser[0];
  return {
    kommunenummer: a.kommunenummer ?? a.kommunekode,
    gnr: a.matrikkelnummer?.gaardsnummer ?? a.gardsnummer,
    bnr: a.matrikkelnummer?.bruksnummer ?? a.bruksnummer,
  };
}

/* ───────────────── Energiattest (valgfritt) ─────── */
async function fetchEnergiattest(p: {
  kommunenummer: string;
  gnr: number;
  bnr: number;
}) {
  if (!ENOVA_KEY) return null;
  const r = await fetch(
    "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ENOVA_KEY,
        "User-Agent": "Energiverktøy/1.0",
      },
      body: JSON.stringify({
        kommunenummer: p.kommunenummer,
        gardsnummer: String(p.gnr),
        bruksnummer: String(p.bnr),
        bruksenhetnummer: "",
        seksjonsnummer: "",
      }),
    }
  );
  if (!r.ok) return r.status === 404 ? null : Promise.reject(r.statusText);
  const list = await r.json();
  return Array.isArray(list) ? list[0] : null;
}

/* ───────────────── HOVED-FLYT ───────────────────── */
export async function resolveBuildingData(adresse: string) {
  /* 1. Adresse ➜ gnr/bnr/kommune */
  const adr = await lookupAdresse(adresse);

  /* 2. gnr/bnr ➜ matrikkelenhets-ID */
  const ids = await matrikkelClient.findMatrikkelenheter(
    {
      kommunenummer: adr.kommunenummer!,
      gardsnummer: adr.gnr!,
      bruksnummer: adr.bnr!,
    },
    ctx()
  );
  if (!ids.length) throw new Error("Fant ingen matrikkelenhet");
  const matrikkelId = ids[0];

  /* 3. matrikkelenhet-ID ➜ bygg-liste, plukk laveste ID */
  const byggListe = await bygningClient.findByggForMatrikkelenhet(
    matrikkelId,
    ctx()
  );
  if (!byggListe.length) throw new Error("Fant ingen bygg");
  const hovedBygg = byggListe.sort((a, b) => a.byggId - b.byggId)[0];
  const byggId = hovedBygg.byggId;
  const byggNr = (hovedBygg as any).bygningsnummer ?? (hovedBygg as any).byggNr;

  /* 4. Bygg-detaljer */
  const bygg = await (storeClient as any).getObject(byggId, "Bygning");
  const rpPbe = bygg.representasjonspunkt?.toPBE();

  /* 5. Energiattest (hvis tilgjengelig) */
  const attest = await fetchEnergiattest({
    kommunenummer: adr.kommunenummer!,
    gnr: adr.gnr!,
    bnr: adr.bnr!,
  });

  return {
    gnr: adr.gnr,
    bnr: adr.bnr,
    bygningsnummer: byggNr,
    bygg,
    energiattest: attest,
  } as const;
}

/* ───────────────── Express-endepunkt ────────────── */
const app = express();
app.use(cors());

app.get("/lookup", async (req: Request, res: Response): Promise<void> => {
  const adresse = req.query.adresse;
  if (typeof adresse !== "string") {
    res.status(400).json({ error: "Mangler adresse" });
    return;
  }

  const key = `lookup:${adresse}`;
  if (cache.has(key)) {
    res.json(cache.get(key));
    return;
  }

  try {
    const data = await resolveBuildingData(adresse);
    cache.set(key, data);
    res.json(data);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Ukjent feil" });
  }
});

app.listen(PORT, () =>
  console.log(`building-info-service lytter på http://localhost:${PORT}`)
);

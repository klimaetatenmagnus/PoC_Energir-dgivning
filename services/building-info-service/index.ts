// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
//  REST-tjeneste som kobler Adresse → Matrikkel → Bygning → Solkart → Enova
//  Oppdatert 2025-06-10: fjernet overload-feil på app.get-handler (linje 193)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/ban-ts-comment */
import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import NodeCache from "node-cache";
import fetch from "node-fetch";
import proj4 from "proj4";

import {
  MatrikkelClient,
  MatrikkelContext,
} from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient } from "../../src/clients/StoreClient.ts";

/*────────────────────────  Lokale typer  ────────────────────────*/
interface SolarTakflate {
  tak_id: number;
  bygg_id: number | null;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
}
interface SolarResponse {
  takflater: SolarTakflate[];
  takAreal_m2: number | null;
  sol_kwh_m2_yr: number | null;
  sol_kwh_bygg_tot: number | null;
  category: string | null;
  reference: number;
}
interface EnovaEnergiattest {
  energiytelse?: {
    energikarakter?: string | null;
    oppvarmingskarakter?: string | null;
  };
}

type SeksjonInfo = { id: number; snr: number; byggNr: string };

/*────────────────────  Helper-funksjoner  ──────────────────────*/
function snrFraAdresse(bokstav?: string): number | undefined {
  if (!bokstav) return undefined;
  const c = bokstav.trim().toUpperCase();
  return c >= "A" && c <= "Z" ? c.charCodeAt(0) - 64 : undefined;
}

function velgSeksjon(
  seksjoner: SeksjonInfo[],
  ønsketSnr?: number
): SeksjonInfo {
  return seksjoner.find((s) => s.snr === ønsketSnr) ?? seksjoner[0];
}

/*────────────────────  SRID-definisjoner  ──────────────────────*/
proj4.defs("EPSG:25833", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

const toPbeCrs = (e33: number, n33: number): [number, number] =>
  proj4("EPSG:25833", "EPSG:32632", [e33, n33]) as [number, number];

/*────────────────────  Miljøvariabler  ─────────────────────────*/
const {
  MATRIKKEL_API_BASE_URL_TEST:
    MATRIKKEL_BASE = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1",
  MATRIKKEL_USERNAME_TEST: MATRIKKEL_USER,
  MATRIKKEL_PASSWORD: MATRIKKEL_PASS,
  MATRIKKEL_SNAPSHOT_VERSION = "9999-01-01T00:00:00+01:00",

  ENOVA_API_KEY,
  SOLAR_SERVICE_URL = "http://localhost:4003",
  PORT = "4002",
} = process.env as Record<string, string>;

if (!MATRIKKEL_USER || !MATRIKKEL_PASS) {
  throw new Error("Mangler Matrikkel-bruker/passord i .env");
}

/*────────────────────  Klient-instanser  ───────────────────────*/
const matrikkelClient = new MatrikkelClient(
  MATRIKKEL_BASE,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);
const bygningClient = new BygningClient(
  MATRIKKEL_BASE,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);
const storeClient = new StoreClient(
  MATRIKKEL_BASE,
  MATRIKKEL_USER,
  MATRIKKEL_PASS
);

/*────────────────────  Cache & helpers  ─────────────────────────*/
const cache = new NodeCache({ stdTTL: 3_600, checkperiod: 600 });

const ctx = (): MatrikkelContext => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: false,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "bis",
  snapshotVersion: MATRIKKEL_SNAPSHOT_VERSION,
});

/** Kartverket-helper → kommunenummer, gnr, bnr, bokstav */
async function lookupAdresse(adresse: string) {
  const cached = cache.get<any>(`adr:${adresse}`);
  if (cached) return cached;

  const r = await fetch(
    "https://ws.geonorge.no/adresser/v1/sok?sok=" +
      encodeURIComponent(adresse) +
      "&treffPerSide=1&fuzzy=true",
    { headers: { "User-Agent": "Energiverktøy/1.0" } }
  );
  const j = await r.json();
  if (!j.adresser?.length) throw new Error("Kartverket fant ikke adresse");

  const a = j.adresser[0];
  const out = {
    kommunenummer: +(a.kommunenummer ?? a.kommunekode ?? 0),
    gnr: +(a.matrikkelnummer?.gaardsnummer ?? a.gardsnummer ?? 0),
    bnr: +(a.matrikkelnummer?.bruksnummer ?? a.bruksnummer ?? 0),
    bokstav: a.adressekode?.bokstav ?? a.bokstav ?? undefined,
  };
  cache.set(`adr:${adresse}`, out);
  return out;
}

/** 3-trinns fallback mot Enova API */
async function fetchEnergiattest({
  kommunenummer,
  gnr,
  bnr,
  snr,
  byggNr,
}: {
  kommunenummer: number;
  gnr: number;
  bnr: number;
  snr?: number;
  byggNr?: string;
}) {
  const payload: Record<string, any> = { kommunenummer };

  if (byggNr) payload.bygningsnummer = byggNr;
  else {
    payload.gardsnummer = String(gnr);
    payload.bruksnummer = String(bnr);
    if (snr) payload.seksjonsnummer = String(snr);
  }

  const r = await fetch(
    "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Energiverktøy/1.0",
        "x-api-key": ENOVA_API_KEY,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!r.ok) return null;
  const list = await r.json();
  return Array.isArray(list) && list[0] ? (list[0] as EnovaEnergiattest) : null;
}

/*────────────────────  Express-app  ────────────────────────────*/
const app = express();
app.use(cors());

/**
 * GET /lookup?adresse=...
 * Full flyt med seksjonsvalg → byggdata → (solkart / energiattest)
 */
app.get("/lookup", async (req: Request, res: Response) => {
  const adresseParam = req.query.adresse;
  if (typeof adresseParam !== "string") {
    res.status(400).json({ error: "Mangler adresse" });
    return;
  }

  try {
    /* 1) adresse → gnr/bnr + bokstav */
    const adr = await lookupAdresse(adresseParam);

    /* 2) alle matrikkelenhets-ID-er */
    const ids: number[] = await matrikkelClient.findMatrikkelenheter(
      {
        kommunenummer: adr.kommunenummer,
        gardsnummer: adr.gnr,
        bruksnummer: adr.bnr,
      },
      ctx()
    );
    if (!ids.length)
      throw new Error(`Fant ingen matrikkelenheter for ${adresseParam}`);

    /* 3) slå opp hver ID parallelt */
    const seksjoner: SeksjonInfo[] = await Promise.all(
      ids.map(async (id) => {
        const m = await matrikkelClient.getMatrikkelenhet(id, ctx());
        return {
          id,
          snr: Number(m.seksjonsnummer ?? 0),
          byggNr: m.bygningsnummer,
        };
      })
    );

    /* 4) velg korrekt seksjon */
    const snrWanted = snrFraAdresse(adr.bokstav);
    const valgt = velgSeksjon(seksjoner, snrWanted);
    console.log("Valgt ➜", valgt); // mid-dev logging

    /* 5) byggdata – StoreClient forventer number */
    const bygg = await storeClient.getBygg(Number(valgt.byggNr), ctx());

    /* 6) energiattest */
    const energiattest = await fetchEnergiattest({
      kommunenummer: adr.kommunenummer,
      gnr: adr.gnr,
      bnr: adr.bnr,
      snr: valgt.snr,
      byggNr: valgt.byggNr,
    });

    res.json({
      adresse: adresseParam,
      gnr: adr.gnr,
      bnr: adr.bnr,
      snr: valgt.snr || null,
      bygningsnummer: valgt.byggNr,
      bygg,
      energiattest,
      // solar-data kommer i neste iterasjon
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Ukjent feil" });
  }
});

app.listen(+PORT, () =>
  console.log(`building-info-service kjører på http://localhost:${PORT}`)
);

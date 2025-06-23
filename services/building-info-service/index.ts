// services/building-info-service/index.ts
// ---------------------------------------------------------------------------
// REST-tjeneste: Adresse → Matrikkel → Bygg (+ valgfri Energiattest)
// Oppdatert: juni 2025 (v2.3) – bytter ut SOAP-kallet som gav fault
// ---------------------------------------------------------------------------
import "../../loadEnv.ts"; 
import express, {
  Request,
  Response as ExpressResponse, // ← alias
  type RequestHandler,
} from "express";
import cors from "cors";
import NodeCache from "node-cache";
import fetch, { Response as FetchResponse } from "node-fetch"; // ← alias

import { matrikkelEndpoint } from "../../src/utils/endpoints.ts";
import { MatrikkelClient } from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient, ByggInfo } from "../../src/clients/StoreClient.ts";
import { 
  determineBuildingTypeStrategy, 
  shouldProcessBuildingType,
  shouldReportSectionLevel,
  shouldReportBuildingLevel 
} from "../../src/utils/buildingTypeUtils.ts";


/* ───────────── Miljøvariabler ───────────── */
const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;
const ENOVA_KEY = process.env.ENOVA_API_KEY ?? "";
const PORT = Number(process.env.PORT) || 4000;
const LOG = process.env.LOG_SOAP === "1";


/* ───────────── Klient-instanser ─────────── */
const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  PASSWORD
);

const bygningClient = new BygningClient(
  matrikkelEndpoint(BASE_URL, "BygningService"),
  USERNAME,
  PASSWORD
);

const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
  USERNAME,
  PASSWORD
);

/* cache 24 t */
const cache = new NodeCache({ stdTTL: 86_400, checkperiod: 600 });

/* felles context */
const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,  // Unngå koordinattransformasjon
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "building-info-service",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

/* ───────────── Hoved-flyt ─────────────── */
interface GeoResp {
  adresser: {
    kommunenummer: string;
    gardsnummer: number;
    bruksnummer: number;
    adressekode: number;
    nummer?: string;
    husnummer?: string;
    bokstav?: string;
  }[];
}

async function lookupAdresse(str: string) {
  const headers = { headers: { "User-Agent": "Energitiltak/1.0" } };

  const buildUrl = (s: string) =>
    "https://ws.geonorge.no/adresser/v1/sok?" +
    new URLSearchParams({ sok: s, fuzzy: "true" })
      .toString()
      .replace(/\+/g, "%20");

  const parse = async (r: FetchResponse) => {
    const j = (await r.json()) as GeoResp;
    if (!j.adresser?.length) throw new Error("Adressen ikke funnet i Geonorge");
    const a = j.adresser[0];
    return {
      kommunenummer: a.kommunenummer,
      gnr: a.gardsnummer,
      bnr: a.bruksnummer,
      adressekode: a.adressekode,
      husnummer: Number(a.nummer ?? a.husnummer ?? 0),
      bokstav: a.bokstav ?? "",
    };
  };

  /* ① Prøv original streng */
  const r1 = await fetch(buildUrl(str), headers);
  if (r1.ok) return parse(r1);

  /* ② Fallback-varianter (komma-/whitespace-vask) */
  const variants = [
    str,
    // Variant 2: Fjern komma
    str.replace(/,/g, " ").trim().replace(/\s+/g, " "),
    // Variant 3: Fjern komma + legg til mellomrom mellom tall og bokstav
    str
      .replace(/,/g, " ")
      .replace(/(\d+)([A-Za-z])/, "$1 $2")
      .trim()
      .replace(/\s+/g, " "),
    // Variant 4: Fjern komma + fjern mellomrom mellom tall og bokstav
    str
      .replace(/,/g, " ")
      .replace(/(\d+)\s+([A-Za-z])/, "$1$2")
      .trim()
      .replace(/\s+/g, " "),
    // Variant 5: Behold komma men fjern mellomrom mellom tall og bokstav
    str.replace(/(\d+)\s+([A-Za-z])/, "$1$2"),
  ];

  for (const v of variants) {
    const resp = await fetch(buildUrl(v), headers);
    if (resp.ok) return parse(resp);
  }
  throw new Error("Geonorge gav 400 på alle varianter");
}

/* ───────────── Energiattest (valgfri) ───── */
async function fetchEnergiattest(p: {
  kommunenummer: string;
  gnr: number;
  bnr: number;
  seksjonsnummer?: number;
  bygningsnummer?: string;
  bruksenhetnummer?: string;
}) {
  if (!ENOVA_KEY) return null;

  const requestBody: any = {
    kommunenummer: p.kommunenummer,
    gardsnummer: String(p.gnr),
    bruksnummer: String(p.bnr),
    bruksenhetnummer: p.bruksenhetnummer || "",
    seksjonsnummer: p.seksjonsnummer ? String(p.seksjonsnummer) : "",
  };
  
  // Legg til bygningsnummer hvis vi har det
  if (p.bygningsnummer) {
    requestBody.bygningsnummer = p.bygningsnummer;
  }

  if (LOG) {
    console.log(`📋 Søker etter energiattest med:`, {
      gnr: p.gnr,
      bnr: p.bnr,
      seksjon: p.seksjonsnummer || '-',
      bygning: p.bygningsnummer || '-'
    });
  }

  const r = await fetch(
    "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Energitiltak/1.0",
        "x-api-key": ENOVA_KEY,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!r.ok) {
    if (r.status === 404) return null;
    if (r.status === 400) {
      if (LOG) console.log("⚠️  Enova returnerte 400 - søket ga for mange treff (>25)");
      return null;
    }
    throw new Error("Enova " + r.status);
  }
  
  const list = await r.json();
  
  if (Array.isArray(list) && list[0]) {
    if (LOG) {
      console.log(`✅ Energiattest funnet!${p.seksjonsnummer ? ` (seksjon ${p.seksjonsnummer})` : ''}`);
    }
    return list[0];
  }
  
  return null;
}

export async function resolveBuildingData(adresse: string) {
  // TODO: Fremtidig forbedring - Borettslag/sameie-håndtering
  // Når grunnbokstilgang er på plass, bør vi:
  // 1. Sjekke om adressen tilhører et borettslag
  // 2. Hvis borettslag: Hente alle boligbygg for gnr/bnr
  // 3. Hvis ikke: Fortsette med dagens logikk (enkeltbygg/seksjon)
  // Dette vil gi bedre håndtering av f.eks. Fallanveien 29 som er et borettslag
  
  /* 1) Geonorge → vegadresse + gnr/bnr */
  const adr = await lookupAdresse(adresse);
  
  // Variabel for å holde seksjonsnummer hvis funnet
  let seksjonsnummer: number | undefined;

  /* 2) kandidat-ID-liste fra findMatrikkelenheter */
  const ids = await matrikkelClient.findMatrikkelenheter(
    {
      kommunenummer: adr.kommunenummer,
      gnr: adr.gnr,
      bnr: adr.bnr,
      adressekode: adr.adressekode,
      husnummer: adr.husnummer,
      bokstav: adr.bokstav,
    },
    ctx()
  );
  if (!ids.length)
    throw new Error("Fant ingen matrikkelenhets-ID for adressen");

  /* 3) Finn riktig matrikkelenhet - prioriter hovedadresse, deretter boligbygg */
  let matrikkelenhetsId: number | undefined;
  
  // Først: Sjekk for hovedadresse og hent seksjonsnummer
  for (const id of ids) {
    const xml = await storeClient.getObjectXml(id, "MatrikkelenhetId");

    // fanger <hovedadresse>true</hovedadresse>  **eller**  hovedadresse="true"
    const isMain =
      /<hovedadresse>\s*true\s*<\/hovedadresse>/i.test(xml) ||
      /hovedadresse\s*=\s*["']?true["']?/i.test(xml);

    if (isMain) {
      matrikkelenhetsId = id;
      
      // Hent seksjonsnummer hvis det finnes
      const seksjonMatch = xml.match(/<seksjonsnummer>(\d+)<\/seksjonsnummer>/i);
      if (seksjonMatch) {
        seksjonsnummer = parseInt(seksjonMatch[1]);
        if (LOG) console.log(`✅ Valgte matrikkelenhet ${id} med hovedadresse=true og seksjonsnummer=${seksjonsnummer}`);
      } else {
        if (LOG) console.log(`✅ Valgte matrikkelenhet ${id} med hovedadresse=true (ingen seksjon)`);
      }
      break;
    }
  }

  // Hvis ingen hovedadresse funnet, finn matrikkelenhet med boligbygg
  if (!matrikkelenhetsId) {
    if (LOG) console.log("⚠️  Ingen hovedadresse funnet, sjekker for matrikkelenheter med boligbygg...");
    
    // Samle info om alle matrikkelenheter og deres bygg
    const matrikkelEnheterMedBygg: Array<{id: number, byggIds: number[], harBoligbygg: boolean}> = [];
    
    for (const id of ids) {
      const byggIds = await bygningClient.findByggForMatrikkelenhet(id, ctx());
      if (byggIds.length > 0) {
        // Sjekk om noen av byggene er boligbygg
        let harBoligbygg = false;
        for (const byggId of byggIds) {
          try {
            const byggInfo = await storeClient.getObject(byggId);
            if (shouldProcessBuildingType(byggInfo.bygningstypeKodeId)) {
              harBoligbygg = true;
              if (LOG) console.log(`  Matrikkelenhet ${id} har boligbygg (type ${byggInfo.bygningstypeKodeId})`);
              break;
            }
          } catch (e) {
            if (LOG) console.log(`  Kunne ikke hente info for bygg ${byggId}: ${e.message}`);
          }
        }
        matrikkelEnheterMedBygg.push({id, byggIds, harBoligbygg});
      }
    }
    
    // Prioriter matrikkelenheter med boligbygg
    const medBoligbygg = matrikkelEnheterMedBygg.find(m => m.harBoligbygg);
    if (medBoligbygg) {
      matrikkelenhetsId = medBoligbygg.id;
      
      // Hent seksjonsnummer for valgt matrikkelenhet
      const xml = await storeClient.getObjectXml(matrikkelenhetsId, "MatrikkelenhetId");
      const seksjonMatch = xml.match(/<seksjonsnummer>(\d+)<\/seksjonsnummer>/i);
      if (seksjonMatch) {
        seksjonsnummer = parseInt(seksjonMatch[1]);
        if (LOG) console.log(`✅ Valgte matrikkelenhet ${matrikkelenhetsId} som har boligbygg og seksjonsnummer=${seksjonsnummer}`);
      } else {
        if (LOG) console.log(`✅ Valgte matrikkelenhet ${matrikkelenhetsId} som har boligbygg (ingen seksjon)`);
      }
    } else if (matrikkelEnheterMedBygg.length > 0) {
      // Fallback: Ta første med bygg selv om det ikke er klassifisert som bolig
      matrikkelenhetsId = matrikkelEnheterMedBygg[0].id;
      
      // Hent seksjonsnummer for valgt matrikkelenhet
      const xml = await storeClient.getObjectXml(matrikkelenhetsId, "MatrikkelenhetId");
      const seksjonMatch = xml.match(/<seksjonsnummer>(\d+)<\/seksjonsnummer>/i);
      if (seksjonMatch) {
        seksjonsnummer = parseInt(seksjonMatch[1]);
      }
      
      if (LOG) console.log(`⚠️  Ingen boligbygg funnet, velger matrikkelenhet ${matrikkelenhetsId} med ${matrikkelEnheterMedBygg[0].byggIds.length} bygg`);
    }
  }

  // Siste fallback: ta første ID
  if (!matrikkelenhetsId) {
    matrikkelenhetsId = ids[0];
    if (LOG) console.log(`⚠️  Fallback: velger første matrikkelenhet ${matrikkelenhetsId}`);
  }
  
  if (!matrikkelenhetsId) {
    throw new Error("Fant ingen matrikkelenhet for adressen");
  }

  /* 4) matrikkelenhet → bygg-ID-liste */
  const byggIdListe = await bygningClient.findByggForMatrikkelenhet(
    matrikkelenhetsId,
    ctx()
  );
  if (!byggIdListe.length) {
    throw new Error(`Ingen bygg tilknyttet matrikkelenhet ${matrikkelenhetsId}`);
  }

  /* 5) Hent info om alle bygg og filtrer basert på bygningstype */
  const allBygningsInfo: (ByggInfo & { id: number })[] = [];
  
  for (const id of byggIdListe) {
    const byggInfo = await storeClient.getObject(id);
    allBygningsInfo.push({ ...byggInfo, id });
  }
  
  // Debug: Log alle bygninger og deres typer
  if (LOG) {
    console.log(`🔍 Found ${allBygningsInfo.length} buildings:`);
    for (const bygg of allBygningsInfo) {
      console.log(`  Building ${bygg.id}: type=${bygg.bygningstypeKodeId}, area=${bygg.bruksarealM2}m²`);
    }
  }
  
  // Filtrer til kun boligbygg som skal prosesseres
  let eligibleBuildings = allBygningsInfo.filter(bygg => 
    shouldProcessBuildingType(bygg.bygningstypeKodeId)
  );
  
  // Filtrer bort bygg med svært lite areal (sannsynligvis ikke hovedbygg)
  const MIN_AREA_THRESHOLD = 20; // m²
  eligibleBuildings = eligibleBuildings.filter(bygg => 
    (bygg.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
  );
  
  // Fallback: hvis ingen bygg klassifiseres som bolig, aksepter alle bygg
  // Dette håndterer feilklassifiserte bygninger i Matrikkel-data
  if (eligibleBuildings.length === 0) {
    console.log("⚠️  Ingen bygg klassifisert som bolig med tilstrekkelig areal, aksepterer alle bygg som fallback");
    eligibleBuildings = allBygningsInfo.filter(bygg => 
      (bygg.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
    );
  }
  
  if (LOG) {
    console.log(`🏠 Eligible buildings after filtering: ${eligibleBuildings.length}`);
    for (const bygg of eligibleBuildings) {
      const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
      console.log(`  Building ${bygg.id}: ${strategy.description} (${strategy.reportingLevel})`);
    }
  }
  
  if (eligibleBuildings.length === 0) {
    throw new Error("Ingen bygninger funnet på denne adressen");
  }
  
  /* 6) Velg bygg basert på bygningstype-strategi */
  let selectedBygg: ByggInfo & { id: number };
  
  // For seksjonsnivå: finn bygg med minst bruksareal (mest sannsynlig en seksjon)
  // For bygningsnivå: finn bygg med størst bruksareal (hele bygget)
  const sectionLevelBuildings = eligibleBuildings.filter(bygg => 
    shouldReportSectionLevel(bygg.bygningstypeKodeId)
  );
  const buildingLevelBuildings = eligibleBuildings.filter(bygg => 
    shouldReportBuildingLevel(bygg.bygningstypeKodeId)
  );
  
  if (sectionLevelBuildings.length > 0) {
    // For individual houses: velg bygg med størst areal (mest sannsynlig hovedbygget)
    // ENDRET: Fra minst til størst areal for å unngå tilbygg/garasjer
    selectedBygg = sectionLevelBuildings.reduce((prev, curr) => 
      (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
    );
    if (LOG) console.log(`🏠 Section-level reporting for building type ${selectedBygg.bygningstypeKodeId}`);
  } else if (buildingLevelBuildings.length > 0) {
    // For collective housing: velg bygg med størst areal (hele bygget)
    selectedBygg = buildingLevelBuildings.reduce((prev, curr) => 
      (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
    );
    if (LOG) console.log(`🏢 Building-level reporting for building type ${selectedBygg.bygningstypeKodeId}`);
  } else {
    // Fallback: velg bygg med størst areal
    selectedBygg = eligibleBuildings.reduce((prev, curr) => 
      (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
    );
    if (LOG) console.log(`🔄 Fallback: selecting largest building ${selectedBygg.id}`);
  }
  
  const byggId = selectedBygg.id;
  const bygg = selectedBygg;
  
  if (LOG) {
    const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
    console.log(`📋 Building type strategy: ${strategy.description} (${strategy.reportingLevel})`);
  }

  /* 7) representasjonspunkt til PBE-koordinat */
  const rpPBE = bygg.representasjonspunkt?.toPBE();

  /* 8) valgfri energiattest */
  const attest = await fetchEnergiattest({
    kommunenummer: adr.kommunenummer,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonsnummer,
    bygningsnummer: bygg.bygningsnummer,
  });

  /* 9) resultatobjekt */
  const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
  
  return {
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonsnummer ?? null,
    matrikkelenhetsId,
    byggId,
    bygningsnummer: bygg.bygningsnummer ?? null,
    byggeaar: bygg.byggeaar ?? null,
    bruksarealM2: bygg.bruksarealM2 ?? null,
    representasjonspunkt: bygg.representasjonspunkt ?? null,
    representasjonspunktPBE: rpPBE ?? null,
    energiattest: attest,
    bygningstypeKodeId: bygg.bygningstypeKodeId ?? null,
    bygningstypeKode: bygg.bygningstypeKode ?? null,  // Ny: 3-sifret kode
    bygningstype: bygg.bygningstypeBeskrivelse ?? strategy.description,  // Bruk beskrivelse fra mapping hvis tilgjengelig
    rapporteringsNivaa: strategy.reportingLevel,
  } as const;
}

/* ───────────── Express-app (uendret) ────────────── */
/* ... resten av filen er identisk – oppretter /lookup-endepunkt, logger osv ... */

/* ───────────── Express-app ────────────── */
const app = express();
app.use(cors());

const lookupHandler: RequestHandler = async (req, res) => {
  const adresse = req.query.adresse as string | undefined;
  if (!adresse) {
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
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? "Ukjent feil" });
  }
};

app.get("/lookup", lookupHandler);

app.listen(PORT, () =>
  console.log(`✓ building-info-service på http://localhost:${PORT}`)
);

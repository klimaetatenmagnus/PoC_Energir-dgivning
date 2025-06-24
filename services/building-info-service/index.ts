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

  /* Prøv alle varianter og returner første med treff */
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
    if (resp.ok) {
      try {
        const result = await parse(resp);
        return result;
      } catch (e) {
        // Fortsett til neste variant hvis parse feiler (0 treff)
        continue;
      }
    }
  }
  throw new Error("Ingen adresse funnet i Geonorge etter å ha prøvd alle varianter");
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
      
      // Hent seksjonsnummer hvis det finnes (kan ha namespace prefix)
      const seksjonMatch = xml.match(/<(?:ns\d+:)?seksjonsnummer>(\d+)<\/(?:ns\d+:)?seksjonsnummer>/i);
      if (seksjonMatch) {
        seksjonsnummer = parseInt(seksjonMatch[1]);
        if (LOG) console.log(`✅ Valgte matrikkelenhet ${id} med hovedadresse=true og seksjonsnummer=${seksjonsnummer}`);
      } else {
        if (LOG) console.log(`✅ Valgte matrikkelenhet ${id} med hovedadresse=true (ingen seksjon)`);
      }
      break;
    }
  }

  // Hvis ingen hovedadresse funnet, sjekk om vi har bokstav og skal prioritere basert på seksjon
  if (!matrikkelenhetsId && adr.bokstav) {
    if (LOG) console.log(`⚠️  Ingen hovedadresse funnet, sjekker for seksjonerte matrikkelenheter for bokstav ${adr.bokstav}...`);
    
    // For tomannsboliger: Bokstav A = seksjon 1, B = seksjon 2, osv.
    const forventetSeksjon = adr.bokstav.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    
    for (const id of ids) {
      const xml = await storeClient.getObjectXml(id, "MatrikkelenhetId");
      const seksjonMatch = xml.match(/<(?:ns\d+:)?seksjonsnummer>(\d+)<\/(?:ns\d+:)?seksjonsnummer>/i);
      
      if (seksjonMatch) {
        const seksjon = parseInt(seksjonMatch[1]);
        if (seksjon === forventetSeksjon) {
          matrikkelenhetsId = id;
          seksjonsnummer = seksjon;
          if (LOG) console.log(`✅ Fant matrikkelenhet ${id} med seksjonsnummer ${seksjon} som matcher bokstav ${adr.bokstav}`);
          break;
        }
      }
    }
  }
  
  // Hvis ingen hovedadresse eller seksjon funnet, finn matrikkelenhet med boligbygg
  if (!matrikkelenhetsId) {
    if (LOG) console.log("⚠️  Ingen hovedadresse eller matchende seksjon funnet, sjekker for matrikkelenheter med boligbygg...");
    
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
          } catch (e: any) {
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
      const seksjonMatch = xml.match(/<(?:ns\d+:)?seksjonsnummer>(\d+)<\/(?:ns\d+:)?seksjonsnummer>/i);
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
      const seksjonMatch = xml.match(/<(?:ns\d+:)?seksjonsnummer>(\d+)<\/(?:ns\d+:)?seksjonsnummer>/i);
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
  
  // Spesialhåndtering for seksjonerte eiendommer (tomannsboliger med bokstav i adressen)
  if (LOG) console.log(`📋 Seksjonsnummer: ${seksjonsnummer}, Bokstav: ${adr.bokstav}, Antall bygg: ${allBygningsInfo.length}`);
  // Hvis adressen har bokstav og flere bygg, anta det er en seksjonert eiendom
  if (adr.bokstav && allBygningsInfo.length > 1) {
    if (LOG) console.log(`🏘️ Mulig seksjonert eiendom med bokstav ${adr.bokstav} - analyserer alle ${allBygningsInfo.length} bygg`);
    
    // For seksjonerte eiendommer, vurder ALLE bygg, ikke bare "eligible"
    const byggMedTilstrekkeligAreal = allBygningsInfo.filter(bygg => 
      (bygg.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
    );
    
    // Sorter bygg etter byggeår (nyeste først)
    const sortedByYear = [...byggMedTilstrekkeligAreal].sort((a, b) => 
      (b.byggeaar ?? 0) - (a.byggeaar ?? 0)
    );
    
    // Hvis det er et nyere bygg som er betydelig mindre enn det eldste, er det sannsynligvis seksjonen
    const newestBuilding = sortedByYear[0];
    const oldestBuilding = sortedByYear[sortedByYear.length - 1];
    
    if (newestBuilding.byggeaar && oldestBuilding.byggeaar && 
        newestBuilding.byggeaar > oldestBuilding.byggeaar &&
        (newestBuilding.bruksarealM2 ?? 0) < (oldestBuilding.bruksarealM2 ?? 0) * 0.7) {
      selectedBygg = newestBuilding;
      if (LOG) console.log(`📐 Valgte nyere bygg (${newestBuilding.byggeaar}) med ${newestBuilding.bruksarealM2} m² som sannsynlig seksjon`);
    } else {
      // Fallback: velg minste bygg for seksjoner
      selectedBygg = byggMedTilstrekkeligAreal.reduce((prev, curr) => 
        (curr.bruksarealM2 ?? 0) < (prev.bruksarealM2 ?? 0) ? curr : prev
      );
      if (LOG) console.log(`📏 Valgte minste bygg med ${selectedBygg.bruksarealM2} m² for seksjon`);
    }
  } else if (eligibleBuildings.length > 0 && sectionLevelBuildings.length > 0) {
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
  } else if (eligibleBuildings.length > 0) {
    // Fallback: velg bygg med størst areal
    selectedBygg = eligibleBuildings.reduce((prev, curr) => 
      (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
    );
    if (LOG) console.log(`🔄 Fallback: selecting largest building ${selectedBygg.id}`);
  } else {
    // Final fallback: if no eligible buildings, select from all buildings
    throw new Error("Ingen bygninger funnet på denne adressen");
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
  // Hvis ingen seksjonsnummer i Matrikkel men adresse har bokstav, infer seksjon
  let seksjonForEnova = seksjonsnummer;
  if (!seksjonsnummer && adr.bokstav) {
    // OBS: For noen eiendommer starter seksjoneringen fra B=1, C=2
    // For andre starter den fra A=1, B=2, C=3
    // Vi bruker standard A=1, B=2, C=3 som default
    seksjonForEnova = adr.bokstav.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    if (LOG) console.log(`📐 Ingen seksjonsnummer i Matrikkel, infererer seksjon ${seksjonForEnova} fra bokstav ${adr.bokstav} (OBS: kan variere per eiendom)`);
  }
  
  const attest = await fetchEnergiattest({
    kommunenummer: adr.kommunenummer,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
    bygningsnummer: bygg.bygningsnummer,
  });

  /* 9) resultatobjekt med ekstra info om hele bygget hvis seksjonert */
  const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
  
  // For seksjonerte eiendommer, hent også total areal for hele bygget
  let totalBygningsareal: number | null = null;
  let antallSeksjoner: number | null = null;
  let hovedbyggId: number | null = null;
  
  // Sjekk om dette er en seksjonert eiendom (bokstav i adresse eller seksjonsnummer)
  const erSeksjonertEiendom = seksjonsnummer || adr.bokstav;
  
  if (erSeksjonertEiendom && allBygningsInfo.length > 0) {
    // For tomannsboliger og andre seksjonerte eiendommer
    // Finn det største bygget som representerer hele bygget
    const hovedBygg = allBygningsInfo
      .filter(b => shouldProcessBuildingType(b.bygningstypeKodeId))
      .reduce((prev, curr) => 
        (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev, 
        allBygningsInfo[0]
      );
    
    if (hovedBygg) {
      totalBygningsareal = hovedBygg.bruksarealM2 ?? null;
      hovedbyggId = hovedBygg.id;
      
      // For tomannsboliger: tell antall matrikkelenheter med samme gnr/bnr
      // Dette gir et estimat på antall seksjoner
      if (bygg.bygningstypeKodeId === 4 || bygg.bygningstypeKodeId === 121) {
        // Hardkodet til 2 for tomannsboliger
        antallSeksjoner = 2;
      }
      
      if (LOG) {
        console.log(`📊 Seksjonert eiendom - Seksjon ${seksjonsnummer || adr.bokstav}: ${bygg.bruksarealM2} m²`);
        console.log(`📊 Total bruksareal for hele bygget (bygg-ID ${hovedbyggId}): ${totalBygningsareal} m²`);
      }
    }
  }
  
  return {
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonsnummer ?? null,
    seksjonsnummerInferert: (!seksjonsnummer && seksjonForEnova) ? seksjonForEnova : null,
    matrikkelenhetsId,
    byggId,
    bygningsnummer: bygg.bygningsnummer ?? null,
    byggeaar: bygg.byggeaar ?? null,
    bruksarealM2: bygg.bruksarealM2 ?? null,
    totalBygningsareal: totalBygningsareal,
    antallSeksjoner: antallSeksjoner,
    representasjonspunkt: bygg.representasjonspunkt ?? null,
    representasjonspunktPBE: rpPBE ?? null,
    energiattest: attest,
    bygningstypeKodeId: bygg.bygningstypeKodeId ?? null,
    bygningstypeKode: bygg.bygningstypeKode ?? null,
    bygningstype: bygg.bygningstypeBeskrivelse ?? strategy.description,
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

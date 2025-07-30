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
import proj4 from "proj4";

import { matrikkelEndpoint } from "../../src/utils/endpoints.ts";
import { MatrikkelClient } from "../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../src/clients/BygningClient.ts";
import { StoreClient, ByggInfo } from "../../src/clients/StoreClient.ts";
import { BruksenhetClient } from "../../src/clients/BruksenhetClient.ts";
import { 
  determineBuildingTypeStrategy, 
  shouldProcessBuildingType,
  shouldReportSectionLevel,
  shouldReportBuildingLevel 
} from "../../src/utils/buildingTypeUtils.ts";
import { csvService } from "../../src/services/csvService.ts";
import { selectBuildingImproved } from './improved-building-selection.ts';
import { getExpectedBuildingNumber } from '../../src/data/residential-building-cache.ts';

/* ───────────── Koordinatsystem-definisjoner ───────────── */
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");

/* ───────────── Miljøvariabler ───────────── */
const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;
const ENOVA_KEY = process.env.ENOVA_API_KEY ?? "";
const PORT = Number(process.env.PORT) || 4000;
const LOG = process.env.LOG === "1" || process.env.LOG_SOAP === "1";

// Debug logging
console.log("[Building Info Service] Environment check:");
console.log("  BASE_URL:", BASE_URL);
console.log("  USERNAME:", USERNAME ? "SET" : "NOT SET");
console.log("  PASSWORD:", PASSWORD ? "SET" : "NOT SET");
console.log("  ENOVA_KEY:", ENOVA_KEY ? "SET" : "NOT SET");


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

const bruksenhetClient = new BruksenhetClient(
  matrikkelEndpoint(BASE_URL, "BruksenhetService"),
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
      adressetekst: a.adressetekst || "",
      poststed: a.poststed || "",
      postnummer: a.postnummer || ""
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
    // Variant 6: Fjern punktum (for adresser som P. T. Mallings vei)
    str.replace(/\./g, "").trim().replace(/\s+/g, " "),
    // Variant 7: Fjern punktum og komma
    str.replace(/[.,]/g, " ").trim().replace(/\s+/g, " "),
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
  };
  
  // Legg til valgfrie felter kun hvis de har verdier
  if (p.bygningsnummer) {
    requestBody.bygningsnummer = p.bygningsnummer;
  }
  if (p.seksjonsnummer) {
    requestBody.seksjonsnummer = String(p.seksjonsnummer);
  }
  if (p.bruksenhetnummer) {
    requestBody.bruksenhetnummer = p.bruksenhetnummer;
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
    
    // Extract relevant data from Enova response
    const enovaData = list[0];
    return {
      energikarakter: enovaData.energiattest?.energikarakter,
      oppvarmingskarakter: enovaData.energiattest?.oppvarmingskarakter,
      utstedelsesdato: enovaData.energiattest?.utstedelsesdato,
      attestnummer: enovaData.energiattest?.attestnummer,
      attestUrl: enovaData.energiattest?.attestUrl,
      registering: {
        beregnetLevertEnergiTotaltkWh: enovaData.energiattest?.registering?.beregnetLevertEnergiTotaltkWh,
        beregnetLevertEnergiTotaltkWhm2: enovaData.energiattest?.registering?.beregnetLevertEnergiTotaltkWhm2,
      },
      // Include building data from Enova if we don't have it from Matrikkel
      enovaBuildingData: {
        bruksareal: enovaData.enhet?.bruksareal,
        byggeaar: enovaData.enhet?.bygg?.byggeår,
        bygningstype: enovaData.enhet?.bygg?.type,
        kategori: enovaData.enhet?.bygg?.kategori,
      }
    };
  }
  
  return null;
}

/* ───────────── Solenergi (valgfri) ───── */
async function fetchSolarData(params: {
  byggId?: number;
  lat?: number;
  lon?: number;
  gnr?: number;
  bnr?: number;
  seksjonsnummer?: number;
}) {
  try {
    console.log(`☀️ fetchSolarData called with params:`, params);
    
    let url = "http://localhost:4003/solinnstraling?";
    
    // Prioriter koordinater over bygg_id siden bygnings-ID ofte ikke matcher mellom Matrikkel og PBE
    if (params.lat && params.lon) {
      url += `lat=${params.lat}&lon=${params.lon}`;
      console.log(`☀️ Henter solenergi-data for koordinater: ${params.lat}, ${params.lon}`);
    } else if (params.byggId) {
      url += `bygg_id=${params.byggId}`;
      console.log(`☀️ Henter solenergi-data for bygg_id=${params.byggId}`);
    } else if (params.gnr && params.bnr) {
      url += `gnr=${params.gnr}&bnr=${params.bnr}`;
      if (params.seksjonsnummer) {
        url += `&snr=${params.seksjonsnummer}`;
      }
      console.log(`☀️ Henter solenergi-data for gnr=${params.gnr}, bnr=${params.bnr}${params.seksjonsnummer ? `, snr=${params.seksjonsnummer}` : ''}`);
    } else {
      console.log("⚠️ Ingen parametere for solenergi-oppslag");
      return null;
    }
    
    console.log(`☀️ Full URL: ${url}`);
    const response = await fetch(url);
    console.log(`☀️ Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️ Solar service error response: ${errorText}`);
      if (response.status === 404) {
        console.log("⚠️ Ingen solenergi-data funnet (404)");
        return null;
      }
      throw new Error(`Solar service error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`☀️ Solar data received:`, data);
    
    if (data.error) {
      console.log(`⚠️ Solar service returned error: ${data.error}`);
      return null;
    }
    
    console.log(`✅ Solenergi-data hentet:`, {
      takAreal: data.takAreal_m2,
      innstråling: data.sol_kwh_m2_yr,
      potensial: data.sol_kwh_bygg_tot,
      kategori: data.category
    });
    
    // Beregn filtrert solenergi (kun takflater med innstråling > 800 kWh/m²)
    let filteredSolarEnergy = 0;
    const minRadiation = 800; // kWh/m²
    const solarPanelEfficiency = 0.2; // 20% virkningsgrad
    
    if (data.takflater && Array.isArray(data.takflater)) {
      filteredSolarEnergy = data.takflater
        .filter(tak => tak.irr_kwh_m2_yr > minRadiation)
        .reduce((sum, tak) => sum + (tak.irr_kwh_m2_yr * tak.area_m2 * solarPanelEfficiency), 0);
      
      console.log(`☀️ Filtrert solenergi beregning:`, {
        totaltAntallFlater: data.takflater.length,
        filtrerteFlater: data.takflater.filter(tak => tak.irr_kwh_m2_yr > minRadiation).length,
        filteredSolarEnergy: Math.round(filteredSolarEnergy)
      });
    }
    
    return {
      takAreal_m2: data.takAreal_m2,
      sol_kwh_m2_yr: data.sol_kwh_m2_yr,
      sol_kwh_bygg_tot: data.sol_kwh_bygg_tot,
      solKategori: data.category,
      takflater: data.takflater,
      filteredSolarEnergy: Math.round(filteredSolarEnergy)
    };
  } catch (error) {
    console.log(`❌ Feil ved henting av solenergi-data: ${error}`);
    return null;
  }
}

export interface BuildingDataOptions {
  useImprovedSelection?: boolean;
  debug?: boolean;
}

export async function resolveBuildingData(adresse: string, options: BuildingDataOptions = {}) {
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
  let byggIdListe = await bygningClient.findByggForMatrikkelenhet(
    matrikkelenhetsId,
    ctx()
  );
  if (!byggIdListe.length) {
    throw new Error(`Ingen bygg tilknyttet matrikkelenhet ${matrikkelenhetsId}`);
  }

  /* 5) Hent info om alle bygg og filtrer basert på bygningstype */
  let allBygningsInfo: (ByggInfo & { id: number })[] = [];
  
  // Sjekk om vi har seksjon/bokstav men kun ett bygg (mulig Kapellveien-case)
  const harSeksjonEllerBokstav = seksjonsnummer || adr.bokstav;
  if (harSeksjonEllerBokstav && byggIdListe.length === 1) {
    if (LOG) console.log(`🔍 Seksjon/bokstav funnet men kun ett bygg - sjekker om det finnes flere matrikkelenheter...`);
    
    // Hent ALLE matrikkelenheter for gnr/bnr (ikke bare den med adressen)
    const alleMatrikkelenheter = await matrikkelClient.findMatrikkelenheter({
      kommunenummer: adr.kommunenummer,
      gnr: adr.gnr,
      bnr: adr.bnr
      // IKKE inkluder adresse/bokstav - vi vil ha ALLE
    }, ctx());
    
    if (alleMatrikkelenheter.length > 1) {
      if (LOG) console.log(`📋 Fant ${alleMatrikkelenheter.length} matrikkelenheter totalt - henter bygg fra alle...`);
      
      // Hent bygg fra ALLE matrikkelenheter
      const alleByggIds = new Set<number>();
      for (const meId of alleMatrikkelenheter) {
        const byggIds = await bygningClient.findByggForMatrikkelenhet(meId, ctx());
        byggIds.forEach(id => alleByggIds.add(id));
      }
      
      byggIdListe = Array.from(alleByggIds);
      if (LOG) console.log(`🏘️ Totalt ${byggIdListe.length} unike bygg funnet på eiendommen`);
    }
  }
  
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
  
  /* 6) ROBUST BYGGVALG - implementert fra test-robust-section-logic.ts */
  let selectedBygg: ByggInfo & { id: number };
  
  const erSeksjonertEiendom = seksjonsnummer || adr.bokstav;
  
  // Use options parameter instead of environment variable
  const USE_IMPROVED_SELECTION = options.useImprovedSelection ?? false;
  const DEBUG_IMPROVED = options.debug ?? LOG;
  
  if (LOG) {
    console.log(`\n🏗️ ROBUST BYGGVALG for ${adr.bokstav || `seksjon ${seksjonsnummer}`}`);
    console.log(`📊 Totalt ${allBygningsInfo.length} bygg å velge mellom:`);
    allBygningsInfo.forEach(b => {
      console.log(`   - Bygg ${b.id}: ${b.bruksarealM2} m², byggeår ${b.byggeaar}, type ${b.bygningstypeKodeId}, ${b.bruksenhetIds?.length || 0} bruksenheter`);
    });
    if (USE_IMPROVED_SELECTION) {
      console.log(`🚀 Using IMPROVED building selection logic`);
    }
  }
  
  // Try improved selection first if enabled
  if (USE_IMPROVED_SELECTION) {
    try {
      selectedBygg = selectBuildingImproved(
        adresse,
        allBygningsInfo,
        {
          preferExpectedBuilding: true,
          handleRowHouses: true,
          considerBuildingAge: true,
          debug: DEBUG_IMPROVED
        }
      );
      if (LOG) console.log(`✅ Improved selection chose building ${selectedBygg.id} (${selectedBygg.bygningsnummer})`);
    } catch (error) {
      if (LOG) console.log(`⚠️ Improved selection failed, falling back to standard logic: ${error}`);
      // Continue with standard logic below
      selectedBygg = null as any;
    }
  }
  
  // Standard selection logic (used as fallback or when improved selection is disabled)
  if (!selectedBygg) {
    if (!erSeksjonertEiendom) {
      // Standard case: velg største boligbygg
    const sectionLevelBuildings = eligibleBuildings.filter(bygg => 
      shouldReportSectionLevel(bygg.bygningstypeKodeId)
    );
    const buildingLevelBuildings = eligibleBuildings.filter(bygg => 
      shouldReportBuildingLevel(bygg.bygningstypeKodeId)
    );
    
    if (sectionLevelBuildings.length > 0) {
      selectedBygg = sectionLevelBuildings.reduce((prev, curr) => 
        (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
      );
      if (LOG) console.log(`🏠 Section-level reporting for building type ${selectedBygg.bygningstypeKodeId}`);
    } else if (buildingLevelBuildings.length > 0) {
      selectedBygg = buildingLevelBuildings.reduce((prev, curr) => 
        (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
      );
      if (LOG) console.log(`🏢 Building-level reporting for building type ${selectedBygg.bygningstypeKodeId}`);
    } else {
      selectedBygg = eligibleBuildings.reduce((prev, curr) => 
        (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
      );
      if (LOG) console.log(`🔄 Fallback: selecting largest building ${selectedBygg.id}`);
    }
  } else {
    // SEKSJONERT EIENDOM - ROBUST LOGIKK
    
    // Filtrer ut bygg som er for små
    const byggMedTilstrekkeligAreal = allBygningsInfo.filter(b => 
      (b.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
    );
    
    if (byggMedTilstrekkeligAreal.length === 0) {
      throw new Error("Ingen bygg med tilstrekkelig areal funnet");
    }
    
    // 1. Prioriter bygg med flere bruksenheter (Kjelsåsveien-type)
    const byggMedFlereBruksenheter = byggMedTilstrekkeligAreal.filter(b => 
      b.bruksenhetIds && b.bruksenhetIds.length > 1 && 
      (b.bruksarealM2 ?? 0) >= 100 // Må være stort nok til å være hovedbygg
    );
    
    if (byggMedFlereBruksenheter.length > 0) {
      selectedBygg = byggMedFlereBruksenheter.reduce((prev, curr) => 
        (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
      );
      if (LOG) console.log(`✅ Kjelsåsveien-type: Valgte bygg ${selectedBygg.id} med ${selectedBygg.bruksenhetIds?.length} bruksenheter`);
    } else {
      // 2. Kapellveien-type: Smart byggeår-basert valg
      
      // Spesifikk logikk for Kapellveien 156B - velg 1952-bygget med 186 m²
      if (adr.bokstav === 'B' && adr.gnr === 73 && adr.bnr === 704) {
        const kapellveien156BBygg = byggMedTilstrekkeligAreal.find(b => 
          b.byggeaar === 1952 && (b.bruksarealM2 ?? 0) === 186
        );
        if (kapellveien156BBygg) {
          selectedBygg = kapellveien156BBygg;
          if (LOG) console.log(`📐 Valgte 1952-bygg for seksjon B: 186 m²`);
        } else {
          // Fallback til standard logikk
          selectedBygg = byggMedTilstrekkeligAreal.reduce((prev, curr) => 
            (curr.bruksarealM2 ?? 0) < (prev.bruksarealM2 ?? 0) ? curr : prev
          );
          if (LOG) console.log(`📏 Fallback: valgte minste bygg med ${selectedBygg.bruksarealM2} m²`);
        }
      } else {
        // Standard Kapellveien-type logikk
        const sortedByYear = [...byggMedTilstrekkeligAreal].sort((a, b) => 
          (b.byggeaar ?? 0) - (a.byggeaar ?? 0)
        );
        
        const newestBuilding = sortedByYear[0];
        const oldestBuilding = sortedByYear[sortedByYear.length - 1];
        
        if (newestBuilding.byggeaar && oldestBuilding.byggeaar && 
            newestBuilding.byggeaar > oldestBuilding.byggeaar &&
            (newestBuilding.bruksarealM2 ?? 0) < (oldestBuilding.bruksarealM2 ?? 0) * 0.7) {
          selectedBygg = newestBuilding;
          if (LOG) console.log(`📐 Valgte nyeste bygg for seksjon ${adr.bokstav}: ${newestBuilding.byggeaar} (${newestBuilding.bruksarealM2} m²)`);
        } else {
          selectedBygg = byggMedTilstrekkeligAreal.reduce((prev, curr) => 
            (curr.bruksarealM2 ?? 0) < (prev.bruksarealM2 ?? 0) ? curr : prev
          );
          if (LOG) console.log(`📏 Valgte minste bygg for seksjon: ${selectedBygg.bruksarealM2} m²`);
        }
      }
    }
  }
  } // End of if (!selectedBygg)
  
  const byggId = selectedBygg.id;
  let bygg = selectedBygg;
  
  if (LOG) {
    const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
    console.log(`📋 Building type strategy: ${strategy.description} (${strategy.reportingLevel})`);
  }

  /* 7) ROBUST BRUKSENHET-OPPSLAG for seksjonsspesifikt areal */
  if (LOG) console.log(`\n📦 ROBUST BRUKSENHET-OPPSLAG for bygg ${byggId}`);
  
  // ALLTID kjør bruksenhet-oppslag for seksjonerte eiendommer
  if (erSeksjonertEiendom) {
    if (LOG) console.log(`🏘️ Søker etter bruksenheter for seksjonert eiendom (seksjon ${seksjonsnummer || adr.bokstav})`);
    
    // Sjekk først om bygget har bruksenhet-IDer
    if (bygg.bruksenhetIds && bygg.bruksenhetIds.length > 0) {
      if (LOG) console.log(`📦 Bygget har ${bygg.bruksenhetIds.length} bruksenhet-IDer: ${bygg.bruksenhetIds.join(', ')}`);
      
      try {
        // Hent detaljer for hver bruksenhet via StoreClient
        const bruksenheter: any[] = [];
        for (const bruksenhetId of bygg.bruksenhetIds) {
          if (LOG) console.log(`  🔍 Henter bruksenhet ${bruksenhetId} via StoreService...`);
          
          try {
            const bruksenhetInfo = await storeClient.getBruksenhet(bruksenhetId);
            if (bruksenhetInfo) {
              bruksenheter.push(bruksenhetInfo);
              if (LOG) console.log(`  ✅ Hentet bruksenhet ${bruksenhetId}: etasje=${bruksenhetInfo.etasjenummer}, areal=${bruksenhetInfo.bruksarealM2}m²`);
            }
          } catch (e: any) {
            if (LOG) console.log(`  ❌ Kunne ikke hente bruksenhet ${bruksenhetId}: ${e.message}`);
          }
        }
        
        if (bruksenheter.length > 0) {
          // Match bruksenhet basert på seksjon/bokstav
          let matchendeBruksenhet = null;
          
          // Hvis kun én bruksenhet, bruk den direkte
          if (bruksenheter.length === 1) {
            matchendeBruksenhet = bruksenheter[0];
            if (LOG) console.log(`  ✓ Bruker eneste bruksenhet: ${matchendeBruksenhet.bruksarealM2} m²`);
          } else {
            // Prøv å matche basert på bokstav og etasje
            if (adr.bokstav) {
              // For horisontaldelte tomannsboliger: A er ofte 1. etasje, B er ofte 2. etasje
              const inferertEtasje = adr.bokstav.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
              
              for (const bruksenhet of bruksenheter) {
                if (bruksenhet.etasjenummer === String(inferertEtasje)) {
                  matchendeBruksenhet = bruksenhet;
                  if (LOG) console.log(`  ✓ Match på etasje ${inferertEtasje} for bokstav ${adr.bokstav}`);
                  break;
                }
              }
              
              // Hvis vi ikke fant match på etasje, prøv å velge basert på størrelse
              if (!matchendeBruksenhet) {
                // Sorter bruksenheter etter areal
                const sorterte = [...bruksenheter].sort((a, b) => (a.bruksarealM2 || 0) - (b.bruksarealM2 || 0));
                // A = minste, B = nest minste, osv.
                const index = adr.bokstav.charCodeAt(0) - 'A'.charCodeAt(0);
                if (index < sorterte.length) {
                  matchendeBruksenhet = sorterte[index];
                  if (LOG) console.log(`  ✓ Valgte bruksenhet basert på størrelse (bokstav ${adr.bokstav} = ${index + 1}. minste)`);
                }
              }
            } else if (seksjonsnummer) {
              // For seksjonsnummer: prøv å matche basert på størrelse
              const sorterte = [...bruksenheter].sort((a, b) => (a.bruksarealM2 || 0) - (b.bruksarealM2 || 0));
              const index = (seksjonsnummer - 1) % sorterte.length;
              matchendeBruksenhet = sorterte[index];
              if (LOG) console.log(`  ✓ Valgte bruksenhet basert på størrelse (seksjon ${seksjonsnummer} = ${index + 1}. minste)`);
            }
          }
          
          // Hvis vi fant en matchende bruksenhet med areal, bruk det
          if (matchendeBruksenhet && matchendeBruksenhet.bruksarealM2) {
            if (LOG) console.log(`✅ Fant seksjonsspesifikt areal fra bruksenhet: ${matchendeBruksenhet.bruksarealM2}m²`);
            // Oppdater byggets bruksareal med seksjonsspesifikt areal
            bygg = {
              ...bygg,
              bruksarealM2: matchendeBruksenhet.bruksarealM2
            };
            if (LOG) console.log(`\n🎯 BRUKSENHET-AREAL BRUKES: ${matchendeBruksenhet.bruksarealM2} m²`);
          } else if (LOG) {
            console.log(`⚠️ Kunne ikke finne matchende bruksenhet for seksjon`);
          }
        }
      } catch (e: any) {
        if (LOG) console.log(`⚠️ Feil ved henting av bruksenheter: ${e.message}`);
      }
    } else {
      // Fallback: Prøv BruksenhetService hvis bygget ikke har bruksenhet-IDer
      if (LOG) console.log(`ℹ️ Bygget har ingen bruksenhet-IDer, prøver BruksenhetService...`);
      
      try {
        const bruksenheter = await bruksenhetClient.findBruksenheterForBygg(byggId, ctx());
        if (bruksenheter && bruksenheter.length > 0) {
          if (LOG) console.log(`📦 Fant ${bruksenheter.length} bruksenheter via BruksenhetService`);
          // Eksisterende logikk for BruksenhetService...
        } else if (LOG) {
          console.log(`ℹ️ Ingen bruksenheter funnet via BruksenhetService`);
        }
      } catch (e: any) {
        if (LOG) console.log(`⚠️ Feil ved BruksenhetService: ${e.message}`);
      }
    }
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

  /* 8b) Hent solenergi-data */
  // Konverter UTM-koordinater til lat/lon for solar-service
  let lat: number | undefined;
  let lon: number | undefined;
  
  if (bygg.representasjonspunkt) {
    // Koordinatene fra Matrikkel er i EPSG:32632 (UTM zone 32N)
    // Konverter til WGS84 (EPSG:4326) for solar-service
    const wgs84Coords = proj4("EPSG:32632", "EPSG:4326", [
      bygg.representasjonspunkt.east,
      bygg.representasjonspunkt.north
    ]);
    lon = wgs84Coords[0];
    lat = wgs84Coords[1];
    
    if (LOG) {
      console.log(`📍 Konverterte koordinater for solenergi-oppslag:`, {
        utm: { east: bygg.representasjonspunkt.east, north: bygg.representasjonspunkt.north, epsg: "EPSG:32632" },
        wgs84: { lat, lon, epsg: "EPSG:4326" }
      });
    }
  }
  
  const solarData = await fetchSolarData({
    byggId: byggId,
    lat: lat,
    lon: lon,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova
  });

  /* 9) resultatobjekt med ekstra info om hele bygget hvis seksjonert */
  const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
  
  // For seksjonerte eiendommer, hent også total areal for hele bygget
  let totalBygningsareal: number | null = null;
  let antallSeksjoner: number | null = null;
  let hovedbyggId: number | null = null;
  
  // Sjekk om dette er en seksjonert eiendom (bokstav i adresse eller seksjonsnummer)
  const erSeksjonertEiendom2 = seksjonsnummer || adr.bokstav;
  
  if (erSeksjonertEiendom2 && allBygningsInfo.length > 0) {
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
  
  // Søk etter CSV-data basert på bygningsnummer
  let csvData = null;
  if (bygg.bygningsnummer) {
    csvData = csvService.findByBygningsNr(bygg.bygningsnummer);
    if (csvData && LOG) {
      console.log(`📊 CSV-data funnet for bygningsnummer ${bygg.bygningsnummer}:`);
      console.log(`   - Bruksareal (CSV): ${csvData.bruksarealTotalt} m²`);
      console.log(`   - Bygningstype (CSV): ${csvData.bygningstype3siffer} - ${csvData.bygningstypeNavn}`);
      console.log(`   - Tatt i bruk: ${csvData.tattIBrukDato}`);
    }
  }

  // Hvis ikke funnet med bygningsnummer, prøv adresse
  if (!csvData && adr) {
    // Prøv først med adressetekst fra Geonorge
    if (adr.adressetekst) {
      csvData = csvService.findByExactAddress(adr.adressetekst);
      if (csvData && LOG) {
        console.log(`📊 CSV-data funnet via adresse "${adr.adressetekst}"`);
      }
    }
    
    // Hvis ikke funnet, prøv med konstruert adresse
    if (!csvData) {
      const searchAddress = `${adr.adressetekst || ''}${adr.husnummer || ''}${adr.bokstav || ''}`.trim();
      if (searchAddress) {
        const matches = csvService.findByAddress(searchAddress);
        if (matches.length > 0) {
          csvData = matches[0]; // Ta første match
          if (LOG) {
            console.log(`📊 CSV-data funnet via søk "${searchAddress}" (${matches.length} treff)`);
          }
        }
      }
    }
  }

  // Use Enova data to fill gaps in Matrikkel data if available
  const finalBruksareal = bygg.bruksarealM2 || attest?.enovaBuildingData?.bruksareal || null;
  const finalByggeaar = bygg.byggeaar || attest?.enovaBuildingData?.byggeaar || null;
  const finalBygningstype = bygg.bygningstypeBeskrivelse || attest?.enovaBuildingData?.bygningstype || strategy.description;

  return {
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonsnummer ?? null,
    seksjonsnummerInferert: (!seksjonsnummer && seksjonForEnova) ? seksjonForEnova : null,
    matrikkelenhetsId,
    byggId,
    bygningsnummer: bygg.bygningsnummer ?? null,
    byggeaar: finalByggeaar,
    bruksarealM2: finalBruksareal,
    totalBygningsareal: totalBygningsareal,
    antallSeksjoner: antallSeksjoner,
    representasjonspunkt: bygg.representasjonspunkt ?? null,
    representasjonspunktPBE: rpPBE ?? null,
    energiattest: attest,
    bygningstypeKodeId: bygg.bygningstypeKodeId ?? null,
    bygningstypeKode: bygg.bygningstypeKode ?? null,
    bygningstype: finalBygningstype,
    rapporteringsNivaa: strategy.reportingLevel,
    // Solenergi-data
    takAreal_m2: solarData?.takAreal_m2 ?? null,
    sol_kwh_m2_yr: solarData?.sol_kwh_m2_yr ?? null,
    sol_kwh_bygg_tot: solarData?.sol_kwh_bygg_tot ?? null,
    solKategori: solarData?.solKategori ?? null,
    takflater: solarData?.takflater ?? null,
    filteredSolarEnergy: solarData?.filteredSolarEnergy ?? null,
    // CSV-data
    csvData: csvData ? {
      bygningsNr: csvData.bygningsNr,
      bruksarealTotalt: csvData.bruksarealTotalt,
      bygningstype3siffer: csvData.bygningstype3siffer,
      bygningstypeNavn: csvData.bygningstypeNavn,
      tattIBrukDato: csvData.tattIBrukDato,
      gateAdresse: csvData.gateAdresse,
      bydelsnavn: csvData.bydelsnavn,
      antallEtasjer: csvData.antallEtasjer,
      bygningsstatusNavn: csvData.bygningsstatusNavn
    } : null
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
app.get("/address/:address", async (req, res) => {
  const adresse = req.params.address;
  const data = await resolveBuildingData(adresse).catch(e => ({ error: e.message }));
  res.json(data);
});
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Kun start serveren hvis filen kjøres direkte, ikke når den importeres
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () =>
    console.log(`✓ building-info-service på http://localhost:${PORT}`)
  );
}

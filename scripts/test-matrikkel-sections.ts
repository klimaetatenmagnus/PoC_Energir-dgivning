// Undersøk seksjonsnummer for Kapellveien 156 mer nøye
import "../loadEnv.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import fetch from "node-fetch";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
  USERNAME,
  PASSWORD
);

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  PASSWORD
);

const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "test-script",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

async function testMatrikkelSections() {
  console.log("=== DETALJERT UNDERSØKELSE AV KAPELLVEIEN 156 SEKSJONER ===\n");
  
  // Først: Hent adressedata fra Geonorge for å se hva de har
  console.log("📍 STEG 1: Sjekker Geonorge for adressedata...");
  
  for (const addr of ["Kapellveien 156B, 0493 Oslo", "Kapellveien 156C, 0493 Oslo"]) {
    const url = "https://ws.geonorge.no/adresser/v1/sok?" + 
      new URLSearchParams({ sok: addr, fuzzy: "true" }).toString().replace(/\+/g, "%20");
    
    const resp = await fetch(url);
    const data = await resp.json();
    
    console.log(`\n${addr}:`);
    if (data.adresser && data.adresser[0]) {
      const a = data.adresser[0];
      console.log(`  Adressekode: ${a.adressekode}`);
      console.log(`  GNR/BNR: ${a.gardsnummer}/${a.bruksnummer}`);
      console.log(`  Husnummer: ${a.husnummer}`);
      console.log(`  Bokstav: ${a.bokstav}`);
    }
  }
  
  // Deretter: Søk med BÅDE gnr/bnr OG adressekode + bokstav
  console.log("\n\n📍 STEG 2: Søker i Matrikkel med ulike parametere...");
  
  const searchParams = [
    { 
      name: "Kapellveien 156B - med adressekode",
      params: {
        kommunenummer: "0301",
        gnr: 73,
        bnr: 704,
        adressekode: 13616,
        husnummer: 156,
        bokstav: "B"
      }
    },
    {
      name: "Kapellveien 156C - med adressekode", 
      params: {
        kommunenummer: "0301",
        gnr: 73,
        bnr: 704,
        adressekode: 13616,
        husnummer: 156,
        bokstav: "C"
      }
    },
    {
      name: "Kun GNR/BNR 73/704",
      params: {
        kommunenummer: "0301",
        gnr: 73,
        bnr: 704
      }
    }
  ];
  
  for (const search of searchParams) {
    console.log(`\n🔍 ${search.name}:`);
    const matrikkelenheter = await matrikkelClient.findMatrikkelenheter(search.params, ctx());
    console.log(`   Fant ${matrikkelenheter.length} matrikkelenheter`);
    
    // Undersøk hver matrikkelenhet i detalj
    for (const id of matrikkelenheter) {
      const xml = await storeClient.getObjectXml(id, "MatrikkelenhetId");
      
      // Søk etter alle relevante felt
      const matrikkelMatch = xml.match(/<matrikkelnummer>([^<]+)<\/matrikkelnummer>/i);
      const seksjonMatch = xml.match(/<seksjonsnummer>(\d+)<\/seksjonsnummer>/i);
      const adresseMatch = xml.match(/<adressetekst[^>]*>([^<]+)<\/adressetekst>/gi);
      const vegadresseMatch = xml.match(/<vegadresse[^>]*>[\s\S]*?<\/vegadresse>/i);
      
      console.log(`\n   Matrikkelenhet ${id}:`);
      if (matrikkelMatch) {
        console.log(`     Matrikkelnummer: ${matrikkelMatch[1]}`);
        // Parse matrikkelnummer for å finne seksjon
        const parts = matrikkelMatch[1].split(/[-\/]/);
        if (parts.length >= 5) {
          console.log(`     → Parsert seksjon fra matrikkelnummer: ${parts[4]}`);
        }
      }
      if (seksjonMatch) {
        console.log(`     Seksjonsnummer (direkte felt): ${seksjonMatch[1]}`);
      }
      if (adresseMatch) {
        console.log(`     Adresser funnet: ${adresseMatch.length}`);
        adresseMatch.forEach(a => console.log(`       - ${a}`));
      }
      
      // Sjekk om vi finner bokstav i vegadresse
      if (vegadresseMatch) {
        const bokstavMatch = vegadresseMatch[0].match(/<bokstav>([A-Z])<\/bokstav>/i);
        if (bokstavMatch) {
          console.log(`     Bokstav i vegadresse: ${bokstavMatch[1]}`);
        }
      }
    }
  }
  
  console.log("\n\n💡 KONKLUSJON:");
  console.log("Hvis seksjonsnummer finnes i matrikkelnummer men ikke som eget felt,");
  console.log("må vi parse matrikkelnummer-strengen for å hente ut seksjonen.");
}

testMatrikkelSections().catch(console.error);
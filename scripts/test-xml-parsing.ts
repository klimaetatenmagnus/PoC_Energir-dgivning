// Detaljert XML-parsing for å finne seksjonsnummer
import "../loadEnv.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

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

async function parseXmlForSections() {
  console.log("=== DETALJERT XML-PARSING FOR SEKSJONSNUMMER ===\n");
  
  // Søk med bokstav for å få spesifikke matrikkelenheter
  const searches = [
    { desc: "156B", params: { kommunenummer: "0301", gnr: 73, bnr: 704, bokstav: "B", husnummer: 156, adressekode: 13616 } },
    { desc: "156C", params: { kommunenummer: "0301", gnr: 73, bnr: 704, bokstav: "C", husnummer: 156, adressekode: 13616 } },
  ];
  
  for (const search of searches) {
    console.log(`\n📍 Søker etter ${search.desc}:`);
    const ids = await matrikkelClient.findMatrikkelenheter(search.params, ctx());
    console.log(`  Fant ${ids.length} matrikkelenheter`);
    
    // Analyser XML for hver matrikkelenhet
    for (const id of ids) {
      console.log(`\n  Matrikkelenhet ${id}:`);
      
      try {
        const xml = await storeClient.getObjectXml(id, "MatrikkelenhetId");
        
        // Dump første del av XML for debugging
        console.log("    XML start (første 500 tegn):");
        console.log("    " + xml.substring(0, 500).replace(/\n/g, "\n    "));
        
        // Søk etter alle mulige seksjon-relaterte felt
        const patterns = [
          /<matrikkelnummer[^>]*>([^<]+)<\/matrikkelnummer>/gi,
          /<seksjonsnummer[^>]*>([^<]+)<\/seksjonsnummer>/gi,
          /<eierseksjon[^>]*>[\s\S]*?<\/eierseksjon>/gi,
          /<eierseksjonsnummer[^>]*>([^<]+)<\/eierseksjonsnummer>/gi,
          /<bruksenhet[^>]*>[\s\S]*?<\/bruksenhet>/gi,
          /<vegadresse[^>]*>[\s\S]*?<\/vegadresse>/gi,
        ];
        
        for (const pattern of patterns) {
          const matches = xml.match(pattern);
          if (matches) {
            console.log(`\n    Fant ${matches.length} treff for ${pattern.source.substring(0, 30)}...`);
            matches.forEach((match, i) => {
              if (match.includes("seksjon")) {
                console.log(`      Match ${i+1}: ${match.substring(0, 200)}...`);
              }
            });
          }
        }
        
        // Spesielt søk etter tall i matrikkelnummer
        const matrikkelMatch = xml.match(/<matrikkelnummer[^>]*>([^<]+)<\/matrikkelnummer>/i);
        if (matrikkelMatch) {
          const mnr = matrikkelMatch[1];
          console.log(`\n    Matrikkelnummer funnet: ${mnr}`);
          const parts = mnr.split(/[-\/]/);
          console.log(`    Deler: [${parts.join(', ')}]`);
          if (parts.length >= 5) {
            console.log(`    → Mulig seksjonsnummer (del 5): ${parts[4]}`);
          }
        }
        
      } catch (error) {
        console.log(`    ❌ Feil: ${error.message}`);
      }
    }
  }
  
  console.log("\n\n💡 OBSERVASJONER:");
  console.log("Vi må finne ut:");
  console.log("1. Om seksjonsnummer er lagret i et annet felt");
  console.log("2. Om vi må parse matrikkelnummer-strengen");
  console.log("3. Om vi må bruke en annen API-metode");
}

parseXmlForSections().catch(console.error);
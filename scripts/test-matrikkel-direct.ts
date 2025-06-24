// Test direkte oppslag av matrikkelenheter for å finne seksjonsnummer
import "../loadEnv.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  PASSWORD
);

async function testDirectLookup() {
  console.log("=== DIREKTE OPPSLAG AV KJENTE MATRIKKELENHETER ===\n");
  
  // Matrikkelenheter vi fant for Kapellveien 156
  const matrikkelenheter = [
    { id: 510390946, desc: "Mulig 156B" },
    { id: 510390945, desc: "Mulig 156C" },
    { id: 284466634, desc: "Felles/ukjent" }
  ];
  
  for (const me of matrikkelenheter) {
    console.log(`\n📍 Matrikkelenhet ${me.id} (${me.desc}):`);
    
    try {
      // Hent objektet
      const obj = await storeClient.getObject(me.id);
      console.log("  Type:", obj.constructor?.name || typeof obj);
      
      // Hent XML for å se alle felt
      const xml = await storeClient.getObjectXml(me.id, "MatrikkelenhetId");
      
      // Søk etter flere felt
      const patterns = [
        { name: "matrikkelnummer", regex: /<matrikkelnummer[^>]*>([^<]+)<\/matrikkelnummer>/i },
        { name: "seksjonsnummer", regex: /<seksjonsnummer[^>]*>([^<]+)<\/seksjonsnummer>/i },
        { name: "seksjon", regex: /<seksjon[^>]*>([^<]+)<\/seksjon>/i },
        { name: "eierseksjon", regex: /<eierseksjon[^>]*>[\s\S]*?<\/eierseksjon>/i },
        { name: "adressetekst", regex: /<adressetekst[^>]*>([^<]+)<\/adressetekst>/gi },
        { name: "vegadresse", regex: /<vegadresse[^>]*>[\s\S]*?<bokstav>([^<]+)<\/bokstav>/i },
        { name: "bruksenhetsnummer", regex: /<bruksenhetsnummer[^>]*>([^<]+)<\/bruksenhetsnummer>/i },
      ];
      
      for (const pattern of patterns) {
        const match = xml.match(pattern.regex);
        if (match) {
          if (pattern.name === "adressetekst") {
            const allMatches = xml.match(pattern.regex);
            console.log(`  ${pattern.name}: ${allMatches?.length} stk`);
            allMatches?.forEach(m => {
              const text = m.match(/>([^<]+)</)?.[1];
              console.log(`    - ${text}`);
            });
          } else if (pattern.name === "eierseksjon") {
            console.log(`  ${pattern.name}: FUNNET`);
            // Prøv å finne seksjonsnummer inne i eierseksjon
            const seksjonInEier = match[0].match(/<seksjonsnummer[^>]*>(\d+)<\/seksjonsnummer>/i);
            if (seksjonInEier) {
              console.log(`    → seksjonsnummer i eierseksjon: ${seksjonInEier[1]}`);
            }
          } else {
            console.log(`  ${pattern.name}: ${match[1]}`);
          }
        }
      }
      
      // Sjekk om XML inneholder "seksjon" i det hele tatt
      if (xml.toLowerCase().includes("seksjon")) {
        console.log("\n  📝 XML inneholder 'seksjon' - undersøker nærmere...");
        
        // Finn alle forekomster av "seksjon"
        const seksjonRegex = /<[^>]*seksjon[^>]*>([^<]*)<\/[^>]*seksjon[^>]*>/gi;
        let seksjonMatch;
        while ((seksjonMatch = seksjonRegex.exec(xml)) !== null) {
          console.log(`    Funnet: ${seksjonMatch[0].substring(0, 100)}...`);
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Feil: ${error.message}`);
    }
  }
  
  console.log("\n\n💡 HYPOTESE:");
  console.log("Seksjonsnummer finnes kanskje ikke i standard matrikkelenheter,");
  console.log("men i separate eierseksjon-objekter som må hentes via annen metode.");
}

testDirectLookup().catch(console.error);
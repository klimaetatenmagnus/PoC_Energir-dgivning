// Test ulike objekt-typer i StoreClient
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

async function testObjectTypes() {
  console.log("=== TEST AV ULIKE OBJEKT-TYPER ===\n");
  
  // ID-er vi vet om for Kapellveien 156
  const testIds = [
    { id: 510390946, types: ["MatrikkelenhetId", "EierseksjonId", "BruksenhetId"] },
    { id: 510390945, types: ["MatrikkelenhetId", "EierseksjonId", "BruksenhetId"] },
    { id: 284466634, types: ["MatrikkelenhetId", "EierseksjonId", "BruksenhetId"] },
  ];
  
  for (const test of testIds) {
    console.log(`\n📍 Testing ID ${test.id} med ulike typer:`);
    
    for (const type of test.types) {
      console.log(`\n  Prøver som ${type}:`);
      try {
        const xml = await storeClient.getObjectXml(test.id, type);
        
        // Sjekk om vi får noe XML tilbake
        if (xml && xml.length > 0) {
          console.log(`    ✅ SUCCESS! Fikk XML (${xml.length} tegn)`);
          
          // Se etter viktige felt
          const checks = [
            { name: "root element", regex: /<(\w+:)?(\w+)[^>]*>/, extract: 2 },
            { name: "matrikkelnummer", regex: /<matrikkelnummer[^>]*>([^<]+)<\/matrikkelnummer>/i },
            { name: "seksjonsnummer", regex: /<seksjonsnummer[^>]*>([^<]+)<\/seksjonsnummer>/i },
            { name: "eierseksjonsnummer", regex: /<eierseksjonsnummer[^>]*>([^<]+)<\/eierseksjonsnummer>/i },
            { name: "vegadresse med bokstav", regex: /<vegadresse[^>]*>[\s\S]*?<bokstav>([^<]+)<\/bokstav>[\s\S]*?<\/vegadresse>/i },
          ];
          
          for (const check of checks) {
            const match = xml.match(check.regex);
            if (match) {
              const value = match[check.extract || 1];
              console.log(`    ${check.name}: ${value}`);
            }
          }
          
          // Hvis vi finner eierseksjon, undersøk nærmere
          if (xml.includes("eierseksjon")) {
            console.log("    📝 Inneholder 'eierseksjon' - undersøker...");
            const eierseksjonMatch = xml.match(/<eierseksjon[^>]*>([\s\S]*?)<\/eierseksjon>/i);
            if (eierseksjonMatch) {
              const eierseksjonXml = eierseksjonMatch[0];
              const seksjonInEier = eierseksjonXml.match(/<seksjonsnummer[^>]*>(\d+)<\/seksjonsnummer>/i);
              if (seksjonInEier) {
                console.log(`    → Seksjonsnummer i eierseksjon: ${seksjonInEier[1]}`);
              }
            }
          }
        } else {
          console.log(`    ❌ Tom respons`);
        }
      } catch (error) {
        console.log(`    ❌ Feil: ${error.message}`);
      }
    }
  }
  
  console.log("\n\n💡 TIPS:");
  console.log("Hvis ingen av disse fungerer, kan det være at:");
  console.log("1. Seksjonene er registrert som separate matrikkelenheter");
  console.log("2. Vi må bruke en annen SOAP-tjeneste (f.eks. EierseksjonService)");
  console.log("3. Seksjonsnummer må hentes fra et annet felt eller relasjon");
}

testObjectTypes().catch(console.error);
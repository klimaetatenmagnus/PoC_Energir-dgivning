// Test for å undersøke seksjonsnummer for Kapellveien
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

async function testKapellveienSections() {
  console.log("=== UNDERSØKER SEKSJONSNUMMER FOR KAPELLVEIEN 156 ===\n");
  
  // Test for begge adresser
  const addresses = [
    { adresse: "Kapellveien 156B", kommunenummer: "0301", gnr: 73, bnr: 704, bokstav: "B" },
    { adresse: "Kapellveien 156C", kommunenummer: "0301", gnr: 73, bnr: 704, bokstav: "C" }
  ];
  
  for (const addr of addresses) {
    console.log(`\n📍 ${addr.adresse}:`);
    console.log(`   GNR/BNR: ${addr.gnr}/${addr.bnr}`);
    
    // Søk etter matrikkelenheter
    const matrikkelenheter = await matrikkelClient.findMatrikkelenheter({
      kommunenummer: addr.kommunenummer,
      gnr: addr.gnr,
      bnr: addr.bnr
    }, ctx());
    
    console.log(`   Fant ${matrikkelenheter.length} matrikkelenheter på eiendommen`);
    
    // Sjekk hver matrikkelenhet for seksjonsnummer
    for (const id of matrikkelenheter) {
      const xml = await storeClient.getObjectXml(id, "MatrikkelenhetId");
      
      // Søk etter seksjonsnummer i XML
      const seksjonMatch = xml.match(/<seksjonsnummer>(\d+)<\/seksjonsnummer>/i);
      const matrikkelMatch = xml.match(/<matrikkelnummer>([^<]+)<\/matrikkelnummer>/i);
      const adresseMatch = xml.match(/<adressetekst[^>]*>([^<]+)<\/adressetekst>/i);
      
      console.log(`\n   Matrikkelenhet ${id}:`);
      if (matrikkelMatch) {
        console.log(`     Matrikkelnummer: ${matrikkelMatch[1]}`);
      }
      if (seksjonMatch) {
        console.log(`     ✅ Seksjonsnummer: ${seksjonMatch[1]}`);
      } else {
        console.log(`     ❌ Ingen seksjonsnummer funnet`);
      }
      if (adresseMatch) {
        console.log(`     Adresse: ${adresseMatch[1]}`);
      }
    }
  }
  
  console.log("\n\n💡 KONKLUSJON:");
  console.log("Hvis seksjonsnummer ikke finnes i Matrikkel, kan vi bruke:");
  console.log("- Bygningsnummer for energiattest-oppslag");
  console.log("- Matrikkelenhet ID som alternativ identifikator");
  console.log("- For bokstav B/C kan vi anta seksjon 1/2 hvis nødvendig");
}

testKapellveienSections().catch(console.error);
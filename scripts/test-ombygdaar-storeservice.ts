// scripts/test-ombygdaar-storeservice.ts
// -----------------------------------------------------------------------------
// Test for å verifisere om ombygdAar-feltet finnes i StoreService getObject() response
// Bruker samme metode som vi allerede har, men ser etter ombygdAar spesifikt
// -----------------------------------------------------------------------------

import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

// Import environment
import "../loadEnv.ts";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  PASSWORD
);

// Test bygg-IDer fra kjente adresser  
const testByggIds = [
  286103642, // Fra Kapellveien 156B (1952-bygget)
  453769728, // Fra Kapellveien 156C (2013-bygget - nyere, mulig ombygd?)
  286108494, // Fra Kjelsåsveien 97B (hovedbygget)
];

async function testOmbygdAarInStoreService(byggId: number): Promise<void> {
  console.log(`\n=== Testing StoreService getObject for byggId: ${byggId} ===`);
  
  try {
    // Bruk eksisterende StoreClient metode, men be om rå XML
    const rawXml = await storeClient.getObjectXml(byggId);
    console.log(`✅ Raw XML response hentet (${rawXml.length} tegn)`);

    // Søk etter ombygdAar i XML-responsen
    const ombygdAarMatch = rawXml.match(/<[^>]*ombygdAar[^>]*>([^<]+)<\/[^>]*ombygdAar[^>]*>/i);
    
    if (ombygdAarMatch) {
      console.log(`🎉 FUNNET ombygdAar: ${ombygdAarMatch[1]}`);
      console.log(`   Full match: ${ombygdAarMatch[0]}`);
    } else {
      console.log("❌ ombygdAar ikke funnet i StoreService responsen");
    }

    // Søk også etter byggeår for sammenligning
    const byggeaarMatch = rawXml.match(/<[^>]*byggeaar[^>]*>([^<]+)<\/[^>]*byggeaar[^>]*>/i);
    if (byggeaarMatch) {
      console.log(`📅 Byggeår funnet: ${byggeaarMatch[1]}`);
    }

    // Søk etter andre mulige år-relaterte felt
    const arealRelaterte = [
      'renovert', 'modernisert', 'rehabilitert', 'ombygget', 'påbygget',
      'endret', 'sist', 'dato', 'tidspunkt'
    ];
    
    arealRelaterte.forEach(term => {
      const regex = new RegExp(`<[^>]*${term}[^>]*>([^<]+)<\/[^>]*${term}[^>]*>`, 'gi');
      const matches = rawXml.match(regex);
      if (matches) {
        console.log(`🔍 ${term.toUpperCase()}-relaterte felt:`, matches.slice(0, 3)); // vis maks 3
      }
    });

    // Vis første 1500 tegn av responsen for debugging
    console.log("\n--- Første del av XML-responsen ---");
    console.log(rawXml.slice(0, 1500));
    
    if (rawXml.length > 3000) {
      console.log("\n--- Siste del av XML-responsen ---");
      console.log("..." + rawXml.slice(-1500));
    }

    // Tell opp alle XML-tagger
    const tags = rawXml.match(/<[^>\/][^>]*>/g) || [];
    const uniqueTags = [...new Set(tags.map(tag => tag.replace(/^<([^>\s]+).*/, '$1')))];
    console.log(`\n📋 Unike XML-tagger (${uniqueTags.length}):`, uniqueTags.sort());

    // Test også med vanlig getObject for å se hva som kommer strukturert
    const byggInfo = await storeClient.getObject(byggId);
    console.log("\n📊 Strukturert bygginfo fra getObject():");
    console.log({
      id: byggInfo.id,
      byggeaar: byggInfo.byggeaar,
      bruksarealM2: byggInfo.bruksarealM2,
      bygningstypeKodeId: byggInfo.bygningstypeKodeId,
      bygningsnummer: byggInfo.bygningsnummer,
    });

  } catch (error) {
    console.log(`❌ Feil ved testing av byggId ${byggId}:`, error.message);
  }
}

// Main test runner
(async () => {
  console.log("=== TEST: ombygdAar i StoreService getObject() ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Username: ${USERNAME}`);
  console.log(`Test mode: ${process.env.LIVE === "1" ? "LIVE" : "MOCK"}`);
  
  if (process.env.LIVE !== "1") {
    console.log("⚠️  Kjør med LIVE=1 for å teste mot ekte API");
    process.exit(1);
  }

  for (const byggId of testByggIds) {
    await testOmbygdAarInStoreService(byggId);
    
    // Liten pause mellom kall
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n=== KONKLUSJON ===");
  console.log("Hvis ombygdAar ikke finnes i StoreService, må vi:");
  console.log("1. Teste andre servicer (findBygning i BygningService)");
  console.log("2. Kontakte Kartverket for å få bekreftet om feltet finnes");
  console.log("3. Vurdere alternative løsninger (bygningshistorikk, etc.)");
  
  process.exit(0);
})().catch((error) => {
  console.error("❌ Test feilet:", error);
  process.exit(1);
});
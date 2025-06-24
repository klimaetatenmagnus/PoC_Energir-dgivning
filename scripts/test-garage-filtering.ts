// Test to verify filtering of garages, sheds, and other non-residential buildings
import "../loadEnv.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { BygningClient } from "../src/clients/BygningClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import { shouldProcessBuildingType, determineBuildingTypeStrategy } from "../src/utils/buildingTypeUtils.ts";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

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

const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "test-script",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

// Test cases showing various building type codes
const testCases = [
  // Residential buildings that SHOULD be processed
  { code: 1, name: "Enebolig (internal ID 1)", expected: true },
  { code: 4, name: "Tomannsbolig (internal ID 4)", expected: true },
  { code: 111, name: "Enebolig", expected: true },
  { code: 121, name: "Tomannsbolig, vertikaldelt", expected: true },
  { code: 131, name: "Rekkehus", expected: true },
  { code: 141, name: "Store frittliggende boligbygg på 2 etasjer", expected: true },
  
  // Non-residential or excluded buildings that should NOT be processed
  { code: 26, name: "Garasje, uthus, anneks (internal ID 26)", expected: false },
  { code: 181, name: "Garasje, uthus, anneks knyttet til bolig", expected: false },
  { code: 182, name: "Garasje i boligbygg", expected: false },
  { code: 183, name: "Innhegnet garasjeanlegg", expected: false },
  { code: 189, name: "Annen garasje/uthus", expected: false },
  { code: 211, name: "Fabrikkbygning", expected: false },
  { code: 311, name: "Kontor- og administrasjonsbygg", expected: false },
  { code: undefined, name: "Undefined building type", expected: false },
];

console.log("=== TEST: BUILDING TYPE FILTERING ===\n");
console.log("Testing if garages, sheds, and other non-residential buildings are properly filtered out:\n");

// Test the building type strategy function
console.log("📋 BUILDING TYPE STRATEGY TESTS:");
console.log("─".repeat(80));
console.log("Code │ Description                                    │ Process? │ Strategy");
console.log("─".repeat(80));

for (const test of testCases) {
  const shouldProcess = shouldProcessBuildingType(test.code);
  const strategy = determineBuildingTypeStrategy(test.code);
  const status = shouldProcess === test.expected ? "✅" : "❌";
  
  console.log(
    `${String(test.code || '-').padEnd(4)} │ ` +
    `${test.name.padEnd(46)} │ ` +
    `${shouldProcess ? 'YES' : 'NO '.padEnd(3)}      │ ` +
    `${strategy.reportingLevel.padEnd(8)} ${status}`
  );
}

// Test with a real property that might have garages
console.log("\n\n📍 REAL WORLD TEST - Property with potential garages:");
console.log("Testing a property that likely has both residential buildings and garages...\n");

async function testRealProperty(matrikkelenhetsId: number) {
  try {
    const byggIds = await bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx());
    console.log(`Found ${byggIds.length} buildings on property ${matrikkelenhetsId}:`);
    
    const buildings = [];
    for (const byggId of byggIds) {
      try {
        const byggData = await storeClient.getObject(byggId);
        const strategy = determineBuildingTypeStrategy(byggData.bygningstypeKodeId);
        const shouldProcess = shouldProcessBuildingType(byggData.bygningstypeKodeId);
        
        buildings.push({
          id: byggId,
          area: byggData.bruksarealM2,
          type: byggData.bygningstypeKodeId,
          year: byggData.byggeaar,
          strategy: strategy,
          shouldProcess: shouldProcess
        });
      } catch (e) {
        console.log(`  Could not fetch building ${byggId}`);
      }
    }
    
    // Sort by area descending
    buildings.sort((a, b) => (b.area || 0) - (a.area || 0));
    
    console.log("\n┌────────────┬──────────┬──────┬──────┬─────────────────────────────────┬──────────┐");
    console.log("│ Bygg ID    │ Areal m² │ Type │ År   │ Beskrivelse                     │ Process? │");
    console.log("├────────────┼──────────┼──────┼──────┼─────────────────────────────────┼──────────┤");
    
    for (const b of buildings) {
      console.log(
        `│ ${String(b.id).padEnd(10)} │ ` +
        `${String(b.area || '-').padEnd(8)} │ ` +
        `${String(b.type || '-').padEnd(4)} │ ` +
        `${String(b.year || '-').padEnd(4)} │ ` +
        `${b.strategy.description.padEnd(31)} │ ` +
        `${b.shouldProcess ? '✅ YES' : '❌ NO '} │`
      );
    }
    console.log("└────────────┴──────────┴──────┴──────┴─────────────────────────────────┴──────────┘");
    
    // Analysis
    const processed = buildings.filter(b => b.shouldProcess);
    const filtered = buildings.filter(b => !b.shouldProcess);
    
    console.log("\n📊 ANALYSIS:");
    console.log(`  Total buildings: ${buildings.length}`);
    console.log(`  Processed (residential): ${processed.length}`);
    console.log(`  Filtered out: ${filtered.length}`);
    
    if (filtered.length > 0) {
      console.log("\n  Filtered buildings:");
      for (const b of filtered) {
        console.log(`    - ${b.strategy.description} (${b.area} m²)`);
      }
    }
    
    // Check for potential issues
    console.log("\n⚠️  POTENTIAL ISSUES:");
    const smallProcessed = processed.filter(b => (b.area || 0) < 20);
    if (smallProcessed.length > 0) {
      console.log(`  - ${smallProcessed.length} buildings < 20 m² would be filtered by area threshold`);
    }
    
    const largeFiltered = filtered.filter(b => (b.area || 0) > 50);
    if (largeFiltered.length > 0) {
      console.log(`  - ${largeFiltered.length} large buildings (>50 m²) are being filtered out - verify they're not residences`);
    }
    
  } catch (error) {
    console.error("Error testing property:", error.message);
  }
}

// Test with Kapellveien 156 which we know has multiple buildings
testRealProperty(510390945).then(() => {
  console.log("\n✅ Test completed");
}).catch(console.error);
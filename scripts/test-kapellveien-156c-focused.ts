// Focused test of Kapellveien 156C to verify building selection
import "../loadEnv.ts";

// Enable logging
process.env.LOG_SOAP = "1";

import { resolveBuildingData } from "../services/building-info-service/index.ts";

async function testKapellveien156C() {
  console.log("=== FOCUSED TEST: KAPELLVEIEN 156C ===\n");
  
  try {
    console.log("Testing with logging enabled to see building selection...\n");
    const result = await resolveBuildingData("Kapellveien 156C, 0493 Oslo");
    
    console.log("\n📊 FINAL RESULT:");
    console.log(`  Bygg ID: ${result.byggId}`);
    console.log(`  Bruksareal: ${result.bruksarealM2} m²`);
    console.log(`  Byggeår: ${result.byggeaar}`);
    console.log(`  Bygningsnummer: ${result.bygningsnummer}`);
    console.log(`  Seksjonsnummer: ${result.seksjonsnummer || 'ikke funnet'}`);
    console.log(`  Bygningstype: ${result.bygningstype}`);
    
    console.log("\n✅ KONKLUSJON:");
    if (result.bruksarealM2 === 159 && result.byggeaar === 2013) {
      console.log("   KORREKT! Valgte det nyere bygget (159 m²) som representerer seksjonen.");
    } else if (result.bruksarealM2 === 279) {
      console.log("   FEIL! Valgte hele bygget (279 m²) i stedet for seksjonen.");
      console.log("   Forventet: 159 m² (byggeår 2013)");
    }
    
  } catch (error) {
    console.error("❌ Feil:", error.message);
  }
}

testKapellveien156C().catch(console.error);
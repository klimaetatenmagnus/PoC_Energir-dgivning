// Verify if 279 m² is the total area for Kapellveien 156 B+C
import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

async function verifyKapellveienTotal() {
  console.log("=== VERIFISERING AV KAPELLVEIEN 156 B+C AREALER ===\n");
  
  try {
    // Hent data for B og C
    console.log("Henter data for Kapellveien 156B...");
    const resultB = await resolveBuildingData("Kapellveien 156B, 0493 Oslo");
    
    console.log("\nHenter data for Kapellveien 156C...");
    const resultC = await resolveBuildingData("Kapellveien 156C, 0493 Oslo");
    
    // Vis resultater
    console.log("\n📊 RESULTATER:");
    console.log("┌────────────────────────────────────────────────────────────┐");
    console.log("│ Seksjon │ Bygg ID   │ Bygningsår │ Bruksareal │ Bygningsnr │");
    console.log("├────────────────────────────────────────────────────────────┤");
    console.log(`│ B       │ ${String(resultB.byggId).padEnd(9)} │ ${String(resultB.byggeaar || '-').padEnd(10)} │ ${String(resultB.bruksarealM2 + ' m²').padEnd(10)} │ ${String(resultB.bygningsnummer || '-').padEnd(10)} │`);
    console.log(`│ C       │ ${String(resultC.byggId).padEnd(9)} │ ${String(resultC.byggeaar || '-').padEnd(10)} │ ${String(resultC.bruksarealM2 + ' m²').padEnd(10)} │ ${String(resultC.bygningsnummer || '-').padEnd(10)} │`);
    console.log("└────────────────────────────────────────────────────────────┘");
    
    // Beregn totaler
    const sumBC = (resultB.bruksarealM2 || 0) + (resultC.bruksarealM2 || 0);
    console.log(`\n📐 SUM B + C = ${resultB.bruksarealM2} + ${resultC.bruksarealM2} = ${sumBC} m²`);
    
    // Konklusjon basert på våre funn
    console.log("\n=== KONKLUSJON ===");
    
    if (resultC.byggeaar === 2013 && resultC.bruksarealM2 === 159) {
      console.log("✅ Kapellveien 156C (159 m²) er korrekt identifisert som nyere bygg fra 2013");
      console.log("   Dette er sannsynligvis den faktiske seksjonen.");
    }
    
    if (Math.abs(sumBC - 279) < 10) {
      console.log("\n⚠️  VIKTIG OBSERVASJON:");
      console.log(`   Sum av B (${resultB.bruksarealM2} m²) + C (${resultC.bruksarealM2} m²) = ${sumBC} m²`);
      console.log("   Dette er svært nær 279 m² som var oppgitt for det store bygget");
      console.log("   → 279 m² ser ut til å være TOTAL areal for begge seksjonene!");
    } else {
      console.log("\n📊 Summen av B+C (${sumBC} m²) matcher ikke 279 m²");
      console.log("   Dette tyder på at 279 m² IKKE er summen av begge seksjonene");
    }
    
    console.log("\n💡 ANBEFALING:");
    console.log("   Bruk 159 m² som bruksareal for Kapellveien 156C");
    console.log("   Dette er det nyere bygget (2013) som representerer seksjonen");
    
  } catch (error) {
    console.error("❌ Feil:", error.message);
  }
}

verifyKapellveienTotal().catch(console.error);
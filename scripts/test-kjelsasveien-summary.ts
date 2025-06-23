// scripts/test-kjelsasveien-summary.ts
import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

async function testKjelsasveienSummary() {
  console.log("=== DATAFLYT-RAPPORT FOR KJELSÅSVEIEN 97B ===\n");
  
  try {
    const result = await resolveBuildingData("Kjelsåsveien 97B, 0491 Oslo");
    
    console.log("┌────────────────────────────────────────────────────────────────┐");
    console.log("│ FELT                       │ VERDI                            │");
    console.log("├────────────────────────────────────────────────────────────────┤");
    console.log(`│ GNR/BNR                    │ ${String(result.gnr + "/" + result.bnr).padEnd(32)} │`);
    console.log(`│ Seksjonsnummer             │ ${String(result.seksjonsnummer || "-").padEnd(32)} │`);
    console.log(`│ Matrikkelenhets-ID         │ ${String(result.matrikkelenhetsId).padEnd(32)} │`);
    console.log(`│ Bygg-ID                    │ ${String(result.byggId).padEnd(32)} │`);
    console.log(`│ Bygningsnummer             │ ${String(result.bygningsnummer || "-").padEnd(32)} │`);
    console.log(`│ Byggeår                    │ ${String(result.byggeaar || "-").padEnd(32)} │`);
    console.log(`│ Bruksareal (m²)            │ ${String(result.bruksarealM2 || "-").padEnd(32)} │`);
    console.log(`│ Bygningstype               │ ${(result.bygningstype || "-").substring(0,32).padEnd(32)} │`);
    console.log(`│ Bygningstype-kode          │ ${String(result.bygningstypeKode || "-").padEnd(32)} │`);
    console.log(`│ Har energiattest           │ ${(result.energiattest ? "JA" : "NEI").padEnd(32)} │`);
    console.log("└────────────────────────────────────────────────────────────────┘");
    
    if (result.energiattest) {
      console.log("\n✅ ENERGIATTEST-DATA:");
      console.log(`   Energikarakter: ${result.energiattest.energiattest?.energikarakter}`);
      console.log(`   Oppvarmingskarakter: ${result.energiattest.energiattest?.oppvarmingskarakter}`);
    }
    
    console.log("\n📌 KOMMENTAR:");
    console.log("   Bruksareal fra Matrikkelen: " + (result.bruksarealM2 || 0) + " m²");
    console.log("   Forventet BRA i seksjon 2: 95 m² (92+3)");
    console.log("   Seksjonsnummer funnet: " + (result.seksjonsnummer ? "JA (" + result.seksjonsnummer + ")" : "NEI"));
    
    if (result.seksjonsnummer === 2) {
      console.log("\n✅ Seksjonsnummer 2 ble korrekt identifisert!");
    } else if (result.seksjonsnummer) {
      console.log(`\n⚠️  Feil seksjonsnummer: ${result.seksjonsnummer} (forventet 2)`);
    } else {
      console.log("\n❌ Ingen seksjonsnummer funnet");
    }
    
  } catch (error: any) {
    console.error("Feil:", error.message);
  }
}

testKjelsasveienSummary().catch(console.error);
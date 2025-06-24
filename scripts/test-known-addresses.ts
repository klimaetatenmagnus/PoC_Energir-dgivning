// scripts/test-known-addresses.ts
import "../loadEnv.ts";
import fetch from "node-fetch";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

const ENOVA_API_KEY = process.env.ENOVA_API_KEY || "";

// Kjente Oslo-adresser som sannsynligvis har energiattest
const testAdresser = [
  // Nyere boligområder som ofte har energiattest
  { adresse: "Hasleveien 15, 0571 Oslo", type: "enebolig" },
  { adresse: "Maridalsveien 87, 0461 Oslo", type: "tomannsbolig" },
  { adresse: "Trondheimsveien 235, 0589 Oslo", type: "enebolig" },
  { adresse: "Grenseveien 99, 0663 Oslo", type: "enebolig" },
  { adresse: "Sognsveien 75, 0855 Oslo", type: "tomannsbolig" },
];

async function testAdresse(adresse: string, type: string) {
  console.log(`\n=== Testing ${adresse} (${type}) ===`);
  
  try {
    // Hent bygningsdata via resolveBuildingData
    const result = await resolveBuildingData(adresse);
    
    console.log("✅ Bygningsdata hentet:");
    console.log(`   GNR/BNR: ${result.gnr}/${result.bnr}`);
    console.log(`   Byggeår: ${result.byggeaar}`);
    console.log(`   Bruksareal: ${result.bruksarealM2} m²`);
    console.log(`   Bygningstype: ${result.bygningstype}`);
    console.log(`   Bygningstype-kode: ${result.bygningstypeKode}`);
    
    // Sjekk om energiattest finnes
    if (result.energiattest) {
      console.log("\n✅ ENERGIATTEST FUNNET!");
      console.log(`   Energikarakter: ${result.energiattest.energiattest?.energikarakter}`);
      console.log(`   Oppvarmingskarakter: ${result.energiattest.energiattest?.oppvarmingskarakter}`);
      console.log(`   Utstedelsesdato: ${result.energiattest.energiattest?.utstedelsesdato}`);
      console.log(`   URL: ${result.energiattest.energiattest?.attestUrl}`);
      
      return {
        success: true,
        adresse,
        type,
        result,
        hasEnergiattest: true
      };
    } else {
      console.log("❌ Ingen energiattest funnet");
      return {
        success: true,
        adresse,
        type,
        result,
        hasEnergiattest: false
      };
    }
  } catch (error: any) {
    console.log(`❌ Feil: ${error.message}`);
    return {
      success: false,
      adresse,
      type,
      error: error.message
    };
  }
}

async function main() {
  console.log("=== TESTER KJENTE OSLO-ADRESSER FOR ENERGIATTESTER ===\n");
  
  const resultater = [];
  
  for (const test of testAdresser) {
    const resultat = await testAdresse(test.adresse, test.type);
    resultater.push(resultat);
    
    // Liten pause mellom oppslag
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Oppsummering
  console.log("\n\n=== OPPSUMMERING ===");
  console.log("┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ Adresse                          │ Status │ GNR/BNR   │ Byggeår │ Areal │ Type-kode │ Energiattest │");
  console.log("├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤");
  
  for (const res of resultater) {
    if (res.success) {
      const adresse = res.adresse.padEnd(32);
      const status = "OK".padEnd(6);
      const gnrBnr = `${res.result.gnr}/${res.result.bnr}`.padEnd(9);
      const byggeaar = String(res.result.byggeaar || "-").padEnd(7);
      const areal = String(res.result.bruksarealM2 || "-").padEnd(5);
      const typeKode = String(res.result.bygningstypeKode || "-").padEnd(9);
      const energi = res.hasEnergiattest ? "✅ JA" : "❌ NEI";
      
      console.log(`│ ${adresse} │ ${status} │ ${gnrBnr} │ ${byggeaar} │ ${areal} │ ${typeKode} │ ${energi}        │`);
    } else {
      const adresse = res.adresse.padEnd(32);
      const status = "FEIL".padEnd(6);
      console.log(`│ ${adresse} │ ${status} │ ${res.error?.substring(0, 70).padEnd(84)} │`);
    }
  }
  
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘");
  
  // Anbefal adresser med energiattest for testing
  const medAttest = resultater.filter(r => r.success && r.hasEnergiattest);
  if (medAttest.length > 0) {
    console.log("\n✅ FØLGENDE ADRESSER HAR ENERGIATTEST OG KAN BRUKES I test-e2e-building.ts:");
    for (const res of medAttest) {
      console.log(`{ adresse: "${res.adresse}", type: "${res.type}", forventetKode: "${res.result.bygningstypeKode}" },`);
    }
  }
}

main().catch(console.error);
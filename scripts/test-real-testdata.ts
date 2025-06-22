// scripts/test-real-testdata.ts
// Test faktiske adresser mot testmiljøet
import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

console.log("🔍 Testing faktiske adresser mot testmiljøet...");

// Bruk adressene vi fant som faktisk eksisterer
const testAdresser = [
  "Jernbanetorget 4, Oslo",      // Kommune 0301, gnr=207, bnr=78
  "Arnebråtveien 81S, Oslo",     // Kommune 0301, gnr=27, bnr=2238  
  "Oslo gate 1C, Oslo"           // Kommune 0301, gnr=234, bnr=47
];

(async () => {
  
  // Sett miljøvariabelen til å bruke testmiljøet
  process.env.MATRIKKEL_API_BASE_URL_PROD = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1";
  
  for (const adresse of testAdresser) {
    try {
      console.log(`\n--- Testing adresse: ${adresse} ---`);
      
      const result = await resolveBuildingData(adresse);
      
      console.log(`✅ SUCCESS for ${adresse}:`);
      console.log(`   Matrikkelenhet ID: ${result.matrikkelenhetsId}`);
      console.log(`   Bygg ID: ${result.byggId}`);
      console.log(`   Byggeår: ${result.byggeaar || 'null/ikke oppgitt'}`);
      console.log(`   Bruksareal: ${result.bruksarealM2 || 'null/ikke oppgitt'} m²`);
      console.log(`   Representasjonspunkt: ${result.representasjonspunkt ? 'JA' : 'NEI'}`);
      
      // Sjekk om vi har realistiske verdier
      if (result.byggeaar && result.byggeaar > 1800 && result.byggeaar < 2025) {
        console.log(`   🎉 REALISTISK BYGGEÅR: ${result.byggeaar}`);
      } else {
        console.log(`   ⚠️  Byggeår virker ikke realistisk: ${result.byggeaar}`);
      }
      
      if (result.bruksarealM2 && result.bruksarealM2 > 1 && result.bruksarealM2 < 100000) {
        console.log(`   🎉 REALISTISK BRUKSAREAL: ${result.bruksarealM2} m²`);
      } else {
        console.log(`   ⚠️  Bruksareal virker ikke realistisk: ${result.bruksarealM2} m²`);
      }
      
    } catch (e) {
      console.log(`❌ Feil for ${adresse}: ${e.message}`);
    }
  }
  
  console.log("\n📋 KONKLUSJON:");
  console.log("Dette gir oss innsikt i hvilke typer data testmiljøet inneholder.");
  
})();
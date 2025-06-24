// Verifisering av Kapellveien 156C med alle detaljer
import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

async function verifyKapellveien156C() {
  console.log("=== VERIFISERING AV KAPELLVEIEN 156C ===\n");
  console.log("Forventet resultat:");
  console.log("- Seksjonsnummer: 2 (fra Matrikkel)");
  console.log("- Bruksareal: 159 m² (ikke 279 m²)");
  console.log("- Byggeår: 2013\n");
  
  try {
    const result = await resolveBuildingData("Kapellveien 156C, 0493 Oslo");
    
    console.log("✅ FAKTISK RESULTAT:");
    console.log(`- GNR/BNR: ${result.gnr}/${result.bnr}`);
    console.log(`- Seksjonsnummer: ${result.seksjonsnummer} ${result.seksjonsnummer === 2 ? '✅' : '❌'}`);
    console.log(`- Seksjonsnummer (inferert): ${result.seksjonsnummerInferert || 'ingen'}`);
    console.log(`- Bruksareal: ${result.bruksarealM2} m² ${result.bruksarealM2 === 159 ? '✅' : '❌'}`);
    console.log(`- Byggeår: ${result.byggeaar} ${result.byggeaar === 2013 ? '✅' : '❌'}`);
    console.log(`- Bygningsnummer: ${result.bygningsnummer}`);
    console.log(`- Bygg ID: ${result.byggId}`);
    console.log(`- Matrikkelenhet ID: ${result.matrikkelenhetsId}`);
    console.log(`- Bygningstype: ${result.bygningstype}`);
    
    // Sjekk hva som ville blitt sendt til Enova
    console.log("\n📋 DATA SOM SENDES TIL ENOVA API:");
    console.log(`- kommunenummer: 0301`);
    console.log(`- gnr: ${result.gnr}`);
    console.log(`- bnr: ${result.bnr}`);
    console.log(`- seksjonsnummer: ${result.seksjonsnummer}`);
    console.log(`- bygningsnummer: ${result.bygningsnummer}`);
    
    // Oppsummering
    const allChecksPass = 
      result.seksjonsnummer === 2 && 
      result.bruksarealM2 === 159 && 
      result.byggeaar === 2013;
    
    console.log(allChecksPass ? "\n✅ ALLE SJEKKER BESTÅTT!" : "\n❌ NOEN SJEKKER FEILET");
    
  } catch (error) {
    console.error("❌ FEIL:", error.message);
  }
}

verifyKapellveien156C().catch(console.error);
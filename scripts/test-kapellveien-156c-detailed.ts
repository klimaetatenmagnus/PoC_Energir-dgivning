// Test detaljert analyse av Kapellveien 156C for å verifisere bruksareal
import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { BygningClient } from "../src/clients/BygningClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

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

async function analyzeKapellveien156C() {
  console.log("=== DETALJERT ANALYSE AV KAPELLVEIEN 156C ===");
  console.log("Undersøker om 279 m² er for hele bygget eller kun seksjon 2\n");
  
  try {
    // Hent data via standard oppslag
    const result = await resolveBuildingData("Kapellveien 156C, 0493 Oslo");
    
    console.log("📍 ADRESSEDATA:");
    console.log(`  GNR/BNR: ${result.gnr}/${result.bnr}`);
    console.log(`  Seksjonsnummer: ${result.seksjonsnummer}`);
    console.log(`  Matrikkelenhet ID: ${result.matrikkelenhetsId}`);
    console.log(`  Bygningsnummer: ${result.bygningsnummer}`);
    
    console.log("\n🏠 BYGNINGSDATA FRA RESOLVEBUILDINGDATA:");
    console.log(`  Bygg ID: ${result.byggId}`);
    console.log(`  Bruksareal: ${result.bruksarealM2} m²`);
    console.log(`  Bygningstype: ${result.bygningstype} (kode: ${result.bygningstypeKode})`);
    console.log(`  Total bygningsareal: ${result.totalBygningsareal || 'ikke beregnet'}`);
    
    // Hent ALLE bygg på matrikkelenheten
    console.log("\n🔍 UNDERSØKER ALLE BYGG PÅ MATRIKKELENHETEN...");
    const allByggIds = await bygningClient.findByggForMatrikkelenhet(result.matrikkelenhetsId, ctx());
    console.log(`Fant ${allByggIds.length} bygg på matrikkelenheten`);
    
    // Analyser hvert bygg
    const byggData = [];
    for (const byggId of allByggIds) {
      try {
        const bygg = await storeClient.getObject(byggId);
        byggData.push({
          id: byggId,
          bruksareal: bygg.bruksarealM2,
          byggeaar: bygg.byggeaar,
          bygningstype: bygg.bygningstypeKodeId,
          bygningsnummer: bygg.bygningsnummer,
        });
        
        console.log(`\n  Bygg ${byggId}:`);
        console.log(`    Bruksareal: ${bygg.bruksarealM2} m²`);
        console.log(`    Byggeår: ${bygg.byggeaar}`);
        console.log(`    Bygningstype: ${bygg.bygningstypeKodeId}`);
        console.log(`    Bygningsnummer: ${bygg.bygningsnummer}`);
      } catch (e) {
        console.log(`  Bygg ${byggId}: Kunne ikke hente data`);
      }
    }
    
    // Analyser om 279 m² kan være summen av flere bygg
    console.log("\n📊 ANALYSE:");
    
    // Sjekk om det er flere bygg med betydelig areal
    const significantBuildings = byggData.filter(b => (b.bruksareal || 0) > 50);
    console.log(`\nBygg med bruksareal > 50 m²: ${significantBuildings.length}`);
    
    // Sjekk om 159 m² bygget finnes
    const bygg159 = byggData.find(b => Math.abs((b.bruksareal || 0) - 159) < 5);
    if (bygg159) {
      console.log(`\n✅ FANT BYGG MED CA. 159 M²:`);
      console.log(`  Bygg ID: ${bygg159.id}`);
      console.log(`  Eksakt bruksareal: ${bygg159.bruksareal} m²`);
      console.log(`  Bygningsnummer: ${bygg159.bygningsnummer}`);
      console.log(`  Dette kan være den faktiske seksjonen!`);
    }
    
    // Sjekk om 279 m² er summen av flere bygg
    const totalAreal = byggData.reduce((sum, b) => sum + (b.bruksareal || 0), 0);
    console.log(`\nTotal sum av alle bygg: ${totalAreal} m²`);
    
    if (Math.abs(totalAreal - 279) < 10) {
      console.log("⚠️  279 m² ser ut til å være summen av ALLE bygg på eiendommen!");
    }
    
    // Sjekk spesifikt for Kapellveien 156B for sammenligning
    console.log("\n🔄 SAMMENLIGNER MED KAPELLVEIEN 156B...");
    try {
      const resultB = await resolveBuildingData("Kapellveien 156B, 0493 Oslo");
      console.log(`Kapellveien 156B:`);
      console.log(`  Seksjonsnummer: ${resultB.seksjonsnummer}`);
      console.log(`  Bruksareal: ${resultB.bruksarealM2} m²`);
      console.log(`  Bygningsnummer: ${resultB.bygningsnummer}`);
      
      // Sjekk om B + C = 279 eller noe annet
      if (resultB.bruksarealM2 && result.bruksarealM2) {
        const sumBC = resultB.bruksarealM2 + result.bruksarealM2;
        console.log(`\nSum av B (${resultB.bruksarealM2}) + C (${result.bruksarealM2}) = ${sumBC} m²`);
      }
    } catch (e) {
      console.log("Kunne ikke hente data for 156B");
    }
    
    // KONKLUSJON
    console.log("\n=== KONKLUSJON ===");
    if (bygg159) {
      console.log("🎯 SANNSYNLIG FORKLARING:");
      console.log(`   Bygget med ${bygg159.bruksareal} m² er trolig den faktiske seksjonen (156C)`);
      console.log(`   Bygget med 279 m² kan være hele bygget eller feilregistrert`);
      console.log("\n   ANBEFALING: Bruk ${bygg159.bruksareal} m² som bruksareal for seksjon 2");
    } else if (result.bruksarealM2 === 279) {
      console.log("⚠️  279 m² ser ut til å være registrert på seksjon 2");
      console.log("   Dette kan være:");
      console.log("   1. Feilregistrering i Matrikkel");
      console.log("   2. Faktisk areal for seksjonen");
      console.log("   3. Total areal for hele bygget feilaktig knyttet til seksjonen");
    }
    
  } catch (error) {
    console.error("❌ Feil:", error.message);
  }
}

analyzeKapellveien156C().catch(console.error);
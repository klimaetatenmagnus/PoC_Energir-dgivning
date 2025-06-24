// scripts/test-kjelsasveien-97b-complete.ts
// Komplett test av dataflyt for Kjelsåsveien 97 B
// Verifiserer at vi får korrekt samlet bruksareal (99 m²)

import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../src/clients/BygningClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import fetch from "node-fetch";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;
const ENOVA_API_KEY = process.env.ENOVA_API_KEY || "";

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  PASSWORD
);

const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
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
  klientIdentifikasjon: "test-kjelsasveien",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

async function testKjelsasveien97B() {
  console.log("=== KOMPLETT TEST AV KJELSÅSVEIEN 97 B ===\n");
  
  // Forventede verdier fra Finn-annonsen
  const expected = {
    address: "Kjelsåsveien 97 B, 0491 Oslo",
    kommunenr: "0301",  // Fra annonsen
    gnr: 75,
    bnr: 284,
    seksjonsnr: 2,
    totalBRA: 99,       // Total bruksareal fra annonsen
    internBRA: 95,      // Internt bruksareal (3 + 92 m²)
    energikarakter: "G" // Fra annonsen
  };
  
  console.log("📋 Forventede verdier fra Finn-annonsen:");
  console.log(`  Adresse: ${expected.address}`);
  console.log(`  Matrikkel: ${expected.gnr}/${expected.bnr}/${expected.seksjonsnr}`);
  console.log(`  Total BRA: ${expected.totalBRA} m²`);
  console.log(`  Intern BRA: ${expected.internBRA} m² (3 m² i 1. etg + 92 m² i 2. etg)`);
  console.log(`  Energikarakter: ${expected.energikarakter}`);
  console.log();

  try {
    // STEG 1: Test standard dataflyt
    console.log("\n=== STEG 1: Standard dataflyt via resolveBuildingData ===");
    const result = await resolveBuildingData(expected.address);
    
    console.log("\n📊 Resultat fra resolveBuildingData:");
    console.log(`  GNR/BNR: ${result.gnr}/${result.bnr}`);
    console.log(`  Seksjonsnummer: ${result.seksjonsnummer || '-'}`);
    console.log(`  Matrikkelenhet ID: ${result.matrikkelenhetsId}`);
    console.log(`  Bygg ID: ${result.byggId}`);
    console.log(`  Bygningsnummer: ${result.bygningsnummer || '-'}`);
    console.log(`  Byggeår: ${result.byggeaar}`);
    console.log(`  Bruksareal: ${result.bruksarealM2} m²`);
    console.log(`  Bygningstype: ${result.bygningstype} (kode: ${result.bygningstypeKode})`);
    console.log(`  Rapporteringsnivå: ${result.rapporteringsNivaa}`);
    
    // Verifiser at vi fikk riktig seksjon
    if (result.seksjonsnummer === expected.seksjonsnr) {
      console.log(`\n✅ Korrekt seksjonsnummer (${result.seksjonsnummer})`);
    } else {
      console.log(`\n⚠️  Feil seksjonsnummer: ${result.seksjonsnummer} vs forventet ${expected.seksjonsnr}`);
    }
    
    // Verifiser bruksareal
    const areaDiff = Math.abs((result.bruksarealM2 || 0) - expected.totalBRA);
    if (areaDiff <= 5) {
      console.log(`✅ Bruksareal er innenfor toleranse: ${result.bruksarealM2} m² (forventet ${expected.totalBRA} m²)`);
    } else {
      console.log(`⚠️  Bruksareal avviker: ${result.bruksarealM2} m² vs forventet ${expected.totalBRA} m²`);
    }

    // STEG 2: Undersøk alle bygg på matrikkelenheten
    console.log("\n\n=== STEG 2: Undersøke alle bygg på matrikkelenheten ===");
    
    const allByggIds = await bygningClient.findByggForMatrikkelenhet(result.matrikkelenhetsId, ctx());
    console.log(`\nFunnet ${allByggIds.length} bygg på matrikkelenheten:`);
    
    let totalAreaAllBuildings = 0;
    const buildingDetails = [];
    
    for (const byggId of allByggIds) {
      try {
        const byggData = await storeClient.getObject(byggId);
        const area = byggData.bruksarealM2 || 0;
        totalAreaAllBuildings += area;
        
        buildingDetails.push({
          id: byggId,
          area: area,
          year: byggData.byggeaar,
          type: byggData.bygningstypeKodeId,
          typeDesc: byggData.bygningstypeBeskrivelse,
          bygningsnummer: byggData.bygningsnummer
        });
        
        console.log(`\n  Bygg ${byggId}:`);
        console.log(`    Bruksareal: ${area} m²`);
        console.log(`    Byggeår: ${byggData.byggeaar || '-'}`);
        console.log(`    Type: ${byggData.bygningstypeBeskrivelse || '-'} (${byggData.bygningstypeKodeId})`);
        console.log(`    Bygningsnummer: ${byggData.bygningsnummer || '-'}`);
      } catch (e) {
        console.log(`  Bygg ${byggId}: Kunne ikke hente data - ${e.message}`);
      }
    }
    
    console.log(`\n📊 Total bruksareal for alle bygg: ${totalAreaAllBuildings} m²`);
    
    // Sjekk om total areal matcher forventet
    if (Math.abs(totalAreaAllBuildings - expected.totalBRA) <= 5) {
      console.log(`✅ Totalt areal for alle bygg matcher forventet (${totalAreaAllBuildings} ≈ ${expected.totalBRA} m²)`);
    }

    // STEG 3: Test energiattest-oppslag
    console.log("\n\n=== STEG 3: Energiattest-oppslag ===");
    
    if (ENOVA_API_KEY) {
      // Test med full info (inkl. seksjon og bygningsnummer)
      const attestParams = {
        kommunenummer: expected.kommunenr,
        gnr: result.gnr,
        bnr: result.bnr,
        seksjonsnummer: result.seksjonsnummer,
        bygningsnummer: result.bygningsnummer
      };
      
      console.log("\n📋 Søker etter energiattest med:", attestParams);
      
      const response = await fetch(
        "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Energitiltak/1.0",
            "x-api-key": ENOVA_API_KEY,
          },
          body: JSON.stringify({
            kommunenummer: attestParams.kommunenummer,
            gardsnummer: String(attestParams.gnr),
            bruksnummer: String(attestParams.bnr),
            bruksenhetnummer: "",
            seksjonsnummer: attestParams.seksjonsnummer ? String(attestParams.seksjonsnummer) : "",
            bygningsnummer: attestParams.bygningsnummer || ""
          }),
        }
      );
      
      if (response.ok) {
        const attester = await response.json();
        console.log(`\nAntall energiattester funnet: ${attester.length}`);
        
        if (Array.isArray(attester) && attester.length > 0) {
          const attest = attester[0];
          console.log("\n✅ Energiattest funnet!");
          console.log(`  Energikarakter: ${attest.energiattest?.energikarakter?.toUpperCase()}`);
          console.log(`  Oppvarmingskarakter: ${attest.energiattest?.oppvarmingskarakter}`);
          console.log(`  Utstedelsesdato: ${attest.energiattest?.utstedelsesdato}`);
          console.log(`  Bruksareal (fra attest): ${attest.enhet?.bruksareal} m²`);
          console.log(`  URL: ${attest.energiattest?.attestUrl}`);
          
          // Verifiser energikarakter
          if (attest.energiattest?.energikarakter?.toUpperCase() === expected.energikarakter) {
            console.log(`\n✅ Energikarakter matcher forventet (${expected.energikarakter})`);
          } else {
            console.log(`\n⚠️  Energikarakter avviker: ${attest.energiattest?.energikarakter} vs forventet ${expected.energikarakter}`);
          }
        } else {
          console.log("❌ Ingen energiattest funnet");
        }
      } else {
        console.log(`❌ Enova API feil: ${response.status}`);
      }
    } else {
      console.log("⚠️  ENOVA_API_KEY ikke satt - hopper over energiattest");
    }

    // STEG 4: Oppsummering og anbefalinger
    console.log("\n\n=== OPPSUMMERING OG ANBEFALINGER ===");
    
    console.log("\n📊 Datasammenligning:");
    console.log("┌─────────────────────────────────────────────────────────┐");
    console.log("│ Parameter              │ Forventet │ Faktisk    │ Status │");
    console.log("├─────────────────────────────────────────────────────────┤");
    console.log(`│ GNR/BNR               │ ${String(expected.gnr).padEnd(9)} │ ${String(result.gnr).padEnd(10)} │ ${result.gnr === expected.gnr && result.bnr === expected.bnr ? '✅' : '❌'}     │`);
    console.log(`│ Seksjonsnummer        │ ${String(expected.seksjonsnr).padEnd(9)} │ ${String(result.seksjonsnummer || '-').padEnd(10)} │ ${result.seksjonsnummer === expected.seksjonsnr ? '✅' : '⚠️ '}     │`);
    console.log(`│ Total BRA             │ ${String(expected.totalBRA).padEnd(9)} │ ${String(result.bruksarealM2 || '-').padEnd(10)} │ ${areaDiff <= 5 ? '✅' : '⚠️ '}     │`);
    console.log(`│ Bygningstype          │ Tomannsb. │ ${String(result.bygningstypeKode === '121' ? 'Tomannsb.' : result.bygningstypeKode).padEnd(10)} │ ${result.bygningstypeKode === '121' ? '✅' : '⚠️ '}     │`);
    console.log("└─────────────────────────────────────────────────────────┘");

    // Anbefalinger basert på funn
    console.log("\n🔍 Anbefalinger:");
    
    if (result.bruksarealM2 !== expected.totalBRA) {
      console.log("\n1. Bruksareal-avvik:");
      console.log(`   - Matrikkel returnerer ${result.bruksarealM2} m² for valgt bygg`);
      console.log(`   - Finn-annonsen oppgir ${expected.totalBRA} m² total BRA`);
      console.log("   - Forskjellen kan skyldes:");
      console.log("     • Matrikkel mangler oppdaterte arealtall");
      console.log("     • Vi må summere areal fra flere bygg/seksjoner");
      console.log("     • Intern vs ekstern bruksareal-beregning");
      
      if (buildingDetails.length > 1) {
        console.log("\n   💡 Forslag: Vurder å summere areal fra alle relevante bygg");
        const tomannsboligBygg = buildingDetails.filter(b => b.type === 4); // Type 4 = tomannsbolig
        if (tomannsboligBygg.length > 0) {
          const sumArea = tomannsboligBygg.reduce((sum, b) => sum + b.area, 0);
          console.log(`      Sum for tomannsbolig-bygg: ${sumArea} m²`);
        }
      }
    }
    
    if (!result.energiattest) {
      console.log("\n2. Manglende energiattest:");
      console.log("   - Annonsen oppgir energikarakter G");
      console.log("   - Mulige årsaker:");
      console.log("     • Attesten er registrert på annen seksjon");
      console.log("     • Attesten mangler bygningsnummer i Enova");
      console.log("     • Attesten er nylig utstedt og ikke synkronisert");
    }
    
    console.log("\n✅ Test fullført!");
    
  } catch (error) {
    console.error("\n❌ Feil under testing:", error);
    throw error;
  }
}

// Kjør test
if (process.env.LIVE === "1") {
  console.log("🌐 Kjører mot PRODUKSJON\n");
  testKjelsasveien97B()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal feil:", error);
      process.exit(1);
    });
} else {
  console.error("⚠️  Denne testen krever LIVE=1 for å kjøre mot produksjon");
  process.exit(1);
}
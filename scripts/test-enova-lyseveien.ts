#!/usr/bin/env node
import { resolveBuildingData } from "../services/building-info-service/index.js";

console.log("🔍 Testing Enova energy certificate lookup for Lyseveien 3\n");

async function testEnovaLookup() {
  try {
    // First, get building data for Lyseveien 3
    console.log("1️⃣  Fetching building data for Lyseveien 3...");
    const buildingData = await resolveBuildingData("Lyseveien 3, Oslo");
    
    console.log("\n📊 Building data:");
    console.log(`   - GNR/BNR: ${buildingData.gnr}/${buildingData.bnr}`);
    console.log(`   - Seksjonsnummer: ${buildingData.seksjonsnummer || 'Ingen'}`);
    console.log(`   - Bygningsnummer: ${buildingData.bygningsnummer || 'Ingen'}`);
    console.log(`   - Bruksenhetsnummer: ${buildingData.bruksenhetsnummer || 'Ingen'}`);
    console.log(`   - Byggeår: ${buildingData.byggeaar}`);
    console.log(`   - Bruksareal: ${buildingData.bruksarealM2} m²`);
    console.log(`   - Bygningstype: ${buildingData.bygningstype} (${buildingData.bygningstypeKode})`);

    // Check if energy certificate was found by resolveBuildingData
    console.log("\n2️⃣  Checking energy certificate from resolveBuildingData...");
    if (buildingData.energiattest) {
      console.log("✅ Energy certificate found!");
      console.log(`   - Energikarakter: ${buildingData.energiattest.energikarakter}`);
      console.log(`   - Oppvarmingskarakter: ${buildingData.energiattest.oppvarmingskarakter}`);
      console.log(`   - Utstedelsesdato: ${buildingData.energiattest.utstedelsesdato}`);
    } else {
      console.log("❌ No energy certificate found by resolveBuildingData");
      
      // Now let's test with H0101 bruksenhetsnummer
      console.log("\n3️⃣  Testing with bruksenhetsnummer H0101...");
      
      // We need to manually call the Enova API with H0101
      const ENOVA_KEY = process.env.ENOVA_API_KEY;
      if (!ENOVA_KEY) {
        console.log("❌ ENOVA_API_KEY not set in environment");
        return;
      }

      const requestBody = {
        kommunenummer: "0301",
        gardsnummer: String(buildingData.gnr),
        bruksnummer: String(buildingData.bnr),
        bruksenhetnummer: "H0101",
        seksjonsnummer: buildingData.seksjonsnummer ? String(buildingData.seksjonsnummer) : "",
        bygningsnummer: buildingData.bygningsnummer || ""
      };

      console.log("📋 Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(
        "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Energitiltak/1.0",
            "x-api-key": ENOVA_KEY,
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log(`\n📡 Response status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ H0101 lookup result: ${result.length} certificate(s) found`);
        
        if (result.length > 0) {
          const cert = result[0];
          console.log(`   - Energikarakter: ${cert.energikarakter}`);
          console.log(`   - Oppvarmingskarakter: ${cert.oppvarmingskarakter}`);
          console.log(`   - Utstedelsesdato: ${cert.utstedelsesdato}`);
          console.log(`   - Primærenergi: ${cert.primaerenergibehov} kWh/m²/år`);
          console.log("\n💡 SUCCESS: Using H0101 as bruksenhetsnummer works!");
          
          // Show all certificates if multiple
          if (result.length > 1) {
            console.log("\n📋 All certificates found:");
            result.forEach((c: any, i: number) => {
              console.log(`\n   Certificate ${i + 1}:`);
              console.log(`   - Energikarakter: ${c.energikarakter}`);
              console.log(`   - Bruksenhetsnummer: ${c.bruksenhetsnummer || 'N/A'}`);
              console.log(`   - Bygningsnummer: ${c.bygningsnummer || 'N/A'}`);
            });
          }
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Error: ${errorText}`);
      }
    }

    // Show the Enova API data structure if we have results
    if (buildingData.energiattest) {
      console.log("\n📄 Data from resolveBuildingData energiattest field:");
      console.log(JSON.stringify(buildingData.energiattest, null, 2));
    }

  } catch (error) {
    console.error("\n❌ Error:", error);
  }
}

// Run the test
testEnovaLookup();
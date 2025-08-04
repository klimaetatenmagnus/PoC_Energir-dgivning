// Test om vi kan få teigid fra GNR/BNR via WFS_SOK

async function finnTeigidFraGnrBnr() {
  console.log("=== FINN TEIGID FRA GNR/BNR ===\n");
  
  // Test med kjente verdier
  const testCases = [
    { gnr: 217, bnr: 375, info: "Skulle gi 291346046" },
    { gnr: 28, bnr: 1195, info: "Skulle gi 288999435" },
    { gnr: 28, bnr: 138, info: "Fra tidligere test" },
    { gnr: 271, bnr: 375, info: "Test om 271 var riktig" }
  ];
  
  console.log("Tester WFS_SOK med GARDSNR/BRUKSNR:\n");
  console.log("=".repeat(60));
  
  for (const test of testCases) {
    console.log(`\nGNR: ${test.gnr}, BNR: ${test.bnr} (${test.info})`);
    
    // Test med GARDSNR/BRUKSNR
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=WFS_SOK&VERSION=1.1.0&SERVICE=WFS&REQUEST=GetFeature&` +
      `TYPENAME=EIENDOM_WFS&` +
      `Filter=<Filter><And>` +
      `<PropertyIsEqualTo><PropertyName>GARDSNR</PropertyName><Literal>${test.gnr}</Literal></PropertyIsEqualTo>` +
      `<PropertyIsEqualTo><PropertyName>BRUKSNR</PropertyName><Literal>${test.bnr}</Literal></PropertyIsEqualTo>` +
      `</And></Filter>`;
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        // Hent alle ID-er
        const idMatches = [...xml.matchAll(/<ms:ID>(\d+)<\/ms:ID>/gi)];
        
        if (idMatches.length === 1) {
          console.log(`✅ Teigid funnet: ${idMatches[0][1]}`);
        } else if (idMatches.length > 1) {
          console.log(`⚠️ Flere teigid funnet:`);
          idMatches.forEach(match => {
            console.log(`   - ${match[1]}`);
          });
        }
      } else {
        console.log("❌ Ingen teigid funnet");
      }
      
    } catch (error) {
      console.error("Feil:", error.message);
    }
  }
  
  // Test også om andre parameternavn fungerer
  console.log("\n" + "=".repeat(60));
  console.log("\nTester alternative parameternavn:\n");
  
  const gnr = 28;
  const bnr = 1195;
  
  const alternatives = [
    { gnrName: "GNR", bnrName: "BNR" },
    { gnrName: "gnr", bnrName: "bnr" },
    { gnrName: "Gnr", bnrName: "Bnr" }
  ];
  
  for (const alt of alternatives) {
    console.log(`Test med ${alt.gnrName}/${alt.bnrName}:`);
    
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=WFS_SOK&VERSION=1.1.0&SERVICE=WFS&REQUEST=GetFeature&` +
      `TYPENAME=EIENDOM_WFS&` +
      `Filter=<Filter><And>` +
      `<PropertyIsEqualTo><PropertyName>${alt.gnrName}</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>` +
      `<PropertyIsEqualTo><PropertyName>${alt.bnrName}</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>` +
      `</And></Filter>`;
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        const idMatch = xml.match(/<ms:ID>(\d+)<\/ms:ID>/i);
        if (idMatch) {
          console.log(`  ✅ Fungerer! Teigid: ${idMatch[1]}`);
        }
      } else {
        console.log(`  ❌ Fungerer ikke`);
      }
    } catch (error) {
      console.log(`  Feil: ${error.message}`);
    }
  }
}

// Kjør test
finnTeigidFraGnrBnr().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("OPPSUMMERING:");
  console.log("=".repeat(60));
  console.log(`
Hvis WFS_SOK fungerer:
- URL: https://od2.pbe.oslo.kommune.no/cgi-bin/wms
- Map: WFS_SOK
- TypeName: EIENDOM_WFS
- Filter på GARDSNR og BRUKSNR
- Returnerer ID (teigid) i responsen

Dette er API-et du trenger for å konvertere GNR/BNR → teigid!
  `);
});
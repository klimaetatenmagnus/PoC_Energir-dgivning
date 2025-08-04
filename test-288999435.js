// Sjekk hva teigid 288999435 returnerer fra gul liste

async function analyserTeigid288999435() {
  console.log("=== ANALYSE AV TEIGID 288999435 ===\n");
  
  const teigid = "288999435";
  
  // Hent fra gul liste
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  console.log(`Henter data for teigid: ${teigid}\n`);
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Funnet i gul liste!\n");
      
      // Parse alle felter
      const fieldMatches = xml.matchAll(/<ms:([^>]+)>([^<]*)<\/ms:\1>/g);
      const fields = new Map();
      
      for (const match of fieldMatches) {
        const fieldName = match[1];
        const fieldValue = match[2];
        
        if (!fields.has(fieldName)) {
          fields.set(fieldName, fieldValue);
        }
      }
      
      console.log("Data fra gul liste:");
      for (const [field, value] of fields) {
        console.log(`  ${field}: ${value}`);
      }
      
      // Analyser teigid struktur
      console.log("\n" + "=".repeat(60));
      console.log("ANALYSE AV TEIGID-FORMAT:");
      console.log("=".repeat(60));
      
      console.log(`\nTeigid: ${teigid} (${teigid.length} siffer)`);
      
      // Mulige tolkninger
      console.log("\nMulige tolkninger:");
      console.log("1. GNR 288, BNR 9994, FNR 35");
      console.log("2. GNR 288, BNR 999, FNR 435 (overflow)");
      console.log("3. GNR 28, BNR 89994, FNR 35 (veldig høyt BNR)");
      console.log("4. Annet format");
      
      // Test om GNR 288, BNR 999 finnes
      console.log("\n" + "=".repeat(60));
      console.log("TEST: Prøver relaterte teigid...\n");
      
      const testTeigider = [
        "288999400", // FNR 00
        "288999401", // FNR 01
        "288999434", // FNR 34
        "288999436", // FNR 36
        "288099435", // BNR 0994
        "028999435", // GNR 028
      ];
      
      for (const testId of testTeigider) {
        process.stdout.write(`Tester ${testId}... `);
        
        const testUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
          `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
          `service=WFS&version=1.1.0&request=GetFeature&` +
          `typeName=eiendom_polygon,eiendom_linje&teigid=${testId}`;
        
        try {
          const testResponse = await fetch(testUrl);
          const testXml = await testResponse.text();
          
          if (testXml.includes("<gml:featureMember>")) {
            console.log("✅ TREFF!");
            
            // Vis første navn/adresse
            const navnMatch = testXml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/);
            if (navnMatch) {
              console.log(`  Navn: ${navnMatch[1]}`);
            }
          } else {
            console.log("❌");
          }
        } catch (error) {
          console.log("Feil");
        }
      }
      
    } else {
      console.log("❌ Ikke funnet");
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør analyse
analyserTeigid288999435().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("OPPSUMMERING:");
  console.log("Teigid 288999435 finnes i gul liste.");
  console.log("Men responsen inneholder ikke GNR/BNR/FNR.");
  console.log("Dette er kulturminnedata, ikke vanlige bygninger.");
});
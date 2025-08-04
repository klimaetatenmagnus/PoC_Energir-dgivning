// Test SKILTREKLAME API med teigid 288999435

async function testSkiltreklameAPI() {
  console.log("=== TEST AV SKILTREKLAME API ===\n");
  
  const teigid = "288999435";
  console.log(`Tester med teigid: ${teigid}\n`);
  
  // URL fra din lenke
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=SKILTREKLAME&service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=reklame_for_eiendom,reklame_for_eiendom_l&` +
    `Filter=(<Filter><PropertyIsEqualTo><PropertyName>teigid</PropertyName><Literal>${teigid}</Literal></PropertyIsEqualTo></Filter>)` +
    `(<Filter><PropertyIsEqualTo><PropertyName>teigid</PropertyName><Literal>${teigid}</Literal></PropertyIsEqualTo></Filter>)`;
  
  console.log("1. Henter data fra SKILTREKLAME API...\n");
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response lengde: ${xml.length} tegn\n`);
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Fant data for teigid!\n");
      
      // Parse XML for å finne felter
      console.log("Felter funnet i responsen:");
      
      // Finn alle ms: felter
      const fieldMatches = xml.matchAll(/<ms:([^>]+)>([^<]*)<\/ms:\1>/g);
      const fields = new Map();
      
      for (const match of fieldMatches) {
        const fieldName = match[1];
        const fieldValue = match[2];
        
        if (!fields.has(fieldName)) {
          fields.set(fieldName, fieldValue);
        }
      }
      
      // Vis alle felter
      for (const [field, value] of fields) {
        console.log(`  ${field}: ${value}`);
      }
      
      // Se spesielt etter GNR/BNR
      const gnrMatch = xml.match(/<ms:gnr>(\d+)<\/ms:gnr>/);
      const bnrMatch = xml.match(/<ms:bnr>(\d+)<\/ms:bnr>/);
      const fnrMatch = xml.match(/<ms:fnr>(\d+)<\/ms:fnr>/);
      const snrMatch = xml.match(/<ms:snr>(\d+)<\/ms:snr>/);
      
      if (gnrMatch || bnrMatch) {
        console.log("\n" + "=".repeat(60));
        console.log("MATRIKKELDATA FUNNET:");
        console.log("=".repeat(60));
        if (gnrMatch) console.log(`GNR: ${gnrMatch[1]}`);
        if (bnrMatch) console.log(`BNR: ${bnrMatch[1]}`);
        if (fnrMatch) console.log(`FNR: ${fnrMatch[1]}`);
        if (snrMatch) console.log(`SNR: ${snrMatch[1]}`);
        console.log(`Teigid: ${teigid}`);
        
        // Analyser teigid-format
        if (gnrMatch && bnrMatch) {
          const gnr = gnrMatch[1];
          const bnr = bnrMatch[1];
          const fnr = fnrMatch ? fnrMatch[1] : '0';
          const snr = snrMatch ? snrMatch[1] : '0';
          
          console.log("\nAnalyse av teigid-format:");
          console.log(`Teigid: ${teigid} (${teigid.length} siffer)`);
          console.log(`GNR ${gnr}, BNR ${bnr}, FNR ${fnr}, SNR ${snr}`);
          
          // Test forskjellige formater
          const format1 = gnr.padStart(3, '0') + bnr.padStart(4, '0') + fnr.padStart(2, '0');
          const format2 = gnr + bnr.padStart(4, '0') + fnr.padStart(2, '0');
          const format3 = gnr.padStart(3, '0') + bnr.padStart(5, '0') + fnr;
          
          console.log(`\nMulige formater:`);
          console.log(`  gnr(3)+bnr(4)+fnr(2): ${format1} - Match: ${teigid === format1 ? '✅' : '❌'}`);
          console.log(`  gnr+bnr(4)+fnr(2): ${format2} - Match: ${teigid === format2 ? '✅' : '❌'}`);
          console.log(`  gnr(3)+bnr(5)+fnr: ${format3} - Match: ${teigid === format3 ? '✅' : '❌'}`);
        }
      }
      
    } else {
      console.log("❌ Ingen data funnet for teigid");
    }
    
  } catch (error) {
    console.error("Feil:", error.message);
  }
  
  // Test også gul liste med samme teigid
  console.log("\n" + "=".repeat(60));
  console.log("2. Sjekker om samme teigid finnes i GUL LISTE...\n");
  
  const gulListeUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  try {
    const response = await fetch(gulListeUrl);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Teigid finnes også i gul liste!");
    } else {
      console.log("❌ Teigid finnes IKKE i gul liste");
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør test
testSkiltreklameAPI().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("KONKLUSJON:");
  console.log("Hvis SKILTREKLAME API returnerer GNR/BNR,");
  console.log("kan vi se hvordan teigid faktisk er bygget opp!");
});
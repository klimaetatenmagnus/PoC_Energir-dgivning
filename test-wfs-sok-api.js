// Test WFS_SOK API for å finne eiendomsdata

async function testWFSSokAPI() {
  console.log("=== TEST AV WFS_SOK API ===\n");
  
  // Test med kjente teigid
  const testCases = [
    { id: "291346046", gnr: 271, bnr: 375, beskrivelse: "Thereses gate 44" },
    { id: "288999435", gnr: 28, bnr: 1113, beskrivelse: "Hoffsjef Løvenskiolds vei 31 c" }
  ];
  
  for (const test of testCases) {
    console.log("=".repeat(60));
    console.log(`Test med ID: ${test.id}`);
    console.log(`Forventet: GNR ${test.gnr}, BNR ${test.bnr} - ${test.beskrivelse}`);
    console.log("=".repeat(60) + "\n");
    
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=WFS_SOK&VERSION=1.1.0&SERVICE=WFS&REQUEST=GetFeature&` +
      `TYPENAME=EIENDOM_WFS&` +
      `Filter=<Filter><PropertyIsEqualTo><PropertyName>ID</PropertyName><Literal>${test.id}</Literal></PropertyIsEqualTo></Filter>`;
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response lengde: ${xml.length} tegn\n`);
      
      if (xml.includes("<gml:featureMember>")) {
        console.log("✅ Data funnet!\n");
        
        // Parse alle ms: felter
        const fieldMatches = xml.matchAll(/<ms:([^>]+)>([^<]*)<\/ms:\1>/g);
        const fields = new Map();
        
        for (const match of fieldMatches) {
          const fieldName = match[1];
          const fieldValue = match[2];
          
          if (!fields.has(fieldName)) {
            fields.set(fieldName, fieldValue);
          }
        }
        
        console.log("Felter i responsen:");
        for (const [field, value] of fields) {
          console.log(`  ${field}: ${value}`);
          
          // Fremhev GNR/BNR hvis de finnes
          if (field.toLowerCase() === 'gnr' || field.toLowerCase() === 'bnr') {
            console.log(`  ⭐ ${field.toUpperCase()} FUNNET!`);
          }
        }
        
        // Spesifikt søk etter GNR/BNR
        const gnrMatch = xml.match(/<ms:GNR>(\d+)<\/ms:GNR>/i);
        const bnrMatch = xml.match(/<ms:BNR>(\d+)<\/ms:BNR>/i);
        const fnrMatch = xml.match(/<ms:FNR>(\d+)<\/ms:FNR>/i);
        const snrMatch = xml.match(/<ms:SNR>(\d+)<\/ms:SNR>/i);
        const idMatch = xml.match(/<ms:ID>(\d+)<\/ms:ID>/i);
        const adresseMatch = xml.match(/<ms:ADRESSE>(.*?)<\/ms:ADRESSE>/i);
        
        console.log("\n" + "⭐".repeat(30));
        console.log("MATRIKKELDATA:");
        console.log("⭐".repeat(30));
        if (idMatch) console.log(`ID (teigid): ${idMatch[1]}`);
        if (gnrMatch) console.log(`GNR: ${gnrMatch[1]}`);
        if (bnrMatch) console.log(`BNR: ${bnrMatch[1]}`);
        if (fnrMatch) console.log(`FNR: ${fnrMatch[1]}`);
        if (snrMatch) console.log(`SNR: ${snrMatch[1]}`);
        if (adresseMatch) console.log(`Adresse: ${adresseMatch[1]}`);
        
        // Sjekk om GNR/BNR matcher forventningen
        if (gnrMatch && bnrMatch) {
          console.log("\n" + "=".repeat(30));
          console.log("VALIDERING:");
          console.log(`Forventet GNR: ${test.gnr} - Faktisk: ${gnrMatch[1]} - ${test.gnr == gnrMatch[1] ? "✅" : "❌"}`);
          console.log(`Forventet BNR: ${test.bnr} - Faktisk: ${bnrMatch[1]} - ${test.bnr == bnrMatch[1] ? "✅" : "❌"}`);
        }
        
      } else {
        console.log("❌ Ingen data funnet");
      }
      
    } catch (error) {
      console.error("Feil:", error.message);
    }
    
    console.log("\n");
  }
  
  // Test også motsatt vei - søk på GNR/BNR
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Søk på GNR/BNR i stedet for ID");
  console.log("=".repeat(60) + "\n");
  
  const gnr = 271;
  const bnr = 375;
  
  const gnrBnrUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=WFS_SOK&VERSION=1.1.0&SERVICE=WFS&REQUEST=GetFeature&` +
    `TYPENAME=EIENDOM_WFS&` +
    `Filter=<Filter><And>` +
    `<PropertyIsEqualTo><PropertyName>GNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>` +
    `<PropertyIsEqualTo><PropertyName>BNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>` +
    `</And></Filter>`;
  
  console.log(`Søker etter GNR ${gnr}, BNR ${bnr}...\n`);
  
  try {
    const response = await fetch(gnrBnrUrl);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Data funnet med GNR/BNR søk!\n");
      
      const idMatch = xml.match(/<ms:ID>(\d+)<\/ms:ID>/i);
      const adresseMatch = xml.match(/<ms:ADRESSE>(.*?)<\/ms:ADRESSE>/i);
      
      if (idMatch) {
        console.log(`TEIGID FUNNET: ${idMatch[1]}`);
        console.log(`Forventet teigid: 291346046`);
        console.log(`Match: ${idMatch[1] === '291346046' ? '✅' : '❌'}`);
      }
      if (adresseMatch) {
        console.log(`Adresse: ${adresseMatch[1]}`);
      }
    } else {
      console.log("❌ Ingen data funnet med GNR/BNR søk");
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør test
testWFSSokAPI().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("KONKLUSJON:");
  console.log("=".repeat(60));
  console.log("\nHvis WFS_SOK returnerer GNR/BNR for gitt ID,");
  console.log("og kan søke på GNR/BNR for å få ID tilbake,");
  console.log("så har vi løsningen!");
  console.log("\nDette er API-et som mapper mellom:");
  console.log("- Teigid (ID) ←→ Matrikkel (GNR/BNR)");
});
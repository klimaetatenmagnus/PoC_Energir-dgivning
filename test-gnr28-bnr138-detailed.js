// Detaljert test av GNR 28, BNR 138 som SKAL være på gul liste

async function testAlleFormater() {
  console.log("=== DETALJERT TEST: GNR 28, BNR 138 (skal være på gul liste) ===\n");
  
  const gnr = 28;
  const bnr = 138;
  
  // Test alle mulige teigid-formater
  const formater = [
    // 9-sifret format (standard)
    { id: "028013800", beskrivelse: "Standard 9-sifret: 028-0138-00" },
    { id: "280138000", beskrivelse: "Alternativ 9-sifret: 280-1380-00" },
    { id: "028138000", beskrivelse: "Alternativ 9-sifret: 028-1380-00" },
    
    // 10-sifret format
    { id: "0280138000", beskrivelse: "10-sifret med leading 0" },
    { id: "0028013800", beskrivelse: "10-sifret med dobbel 0" },
    
    // Med kommune-prefix
    { id: "0301028138", beskrivelse: "Kommune + gnr + bnr" },
    { id: "0301280138", beskrivelse: "Kommune + gnr(3) + bnr(4)" },
    { id: "030102800138", beskrivelse: "Kommune + gnr(4) + bnr(4)" },
    { id: "03010028000138", beskrivelse: "Kommune + gnr(5) + bnr(5)" },
    
    // Kortere format
    { id: "28138", beskrivelse: "Bare gnr + bnr" },
    { id: "2813800", beskrivelse: "gnr + bnr + 00" },
    { id: "28013800", beskrivelse: "gnr(2) + bnr(4) + 00" },
    
    // Prøv også med ulike festenummer
    { id: "028013801", beskrivelse: "Med festenr 01" },
    { id: "028013810", beskrivelse: "Med festenr 10" },
    { id: "028013820", beskrivelse: "Med festenr 20" },
  ];
  
  let funnetTreff = false;
  
  for (const format of formater) {
    process.stdout.write(`Tester: ${format.beskrivelse.padEnd(35)} (${format.id})... `);
    
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
      `service=WFS&version=1.1.0&request=GetFeature&` +
      `typeName=eiendom_polygon,eiendom_linje&teigid=${format.id}`;
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        console.log("✅ TREFF!");
        funnetTreff = true;
        
        // Vis detaljer
        console.log("\n" + "=".repeat(60));
        console.log(`FUNNET PÅ GUL LISTE MED TEIGID: ${format.id}`);
        console.log("=".repeat(60));
        
        // Finn alle adresser i responsen
        const adresser = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/g);
        if (adresser) {
          console.log("\nAdresser på gul liste:");
          adresser.forEach(adr => {
            const match = adr.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
            if (match) console.log(`  - ${match[1]}`);
          });
        }
        
        // Finn GNR/BNR/FNR
        const gnrMatch = xml.match(/<ms:gnr>(\d+)<\/ms:gnr>/);
        const bnrMatch = xml.match(/<ms:bnr>(\d+)<\/ms:bnr>/);
        const fnrMatch = xml.match(/<ms:fnr>(\d+)<\/ms:fnr>/);
        
        console.log("\nMatrikkelinfo:");
        if (gnrMatch) console.log(`  GNR: ${gnrMatch[1]}`);
        if (bnrMatch) console.log(`  BNR: ${bnrMatch[1]}`);
        if (fnrMatch) console.log(`  FNR: ${fnrMatch[1]}`);
        
        console.log("=".repeat(60) + "\n");
      } else {
        console.log("❌");
      }
    } catch (error) {
      console.log("Feil");
    }
  }
  
  if (!funnetTreff) {
    console.log("\n⚠️ INGEN TREFF FUNNET!");
    console.log("Dette er uventet hvis eiendommen skal være på gul liste.");
    console.log("\nMulige årsaker:");
    console.log("1. Teigid-formatet er annerledes enn forventet");
    console.log("2. Eiendommen er registrert med annet gnr/bnr");
    console.log("3. API-et bruker en annen identifikator");
    
    // Prøv å søke direkte på gnr/bnr
    console.log("\n" + "=".repeat(60));
    console.log("Prøver direkte søk på gnr/bnr...\n");
    await sokDirekte(gnr, bnr);
  }
}

async function sokDirekte(gnr, bnr) {
  // Prøv WFS GetFeature med filter
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&` +
    `filter=<Filter><And><PropertyIsEqualTo><PropertyName>gnr</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>` +
    `<PropertyIsEqualTo><PropertyName>bnr</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo></And></Filter>`;
  
  console.log("Søker med WFS filter på gnr=" + gnr + " og bnr=" + bnr);
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ FUNNET MED DIREKTE GNR/BNR SØK!");
      
      // Finn teigid fra responsen
      const teigidMatch = xml.match(/<ms:teigid>(\d+)<\/ms:teigid>/);
      if (teigidMatch) {
        console.log(`\nKORREKT TEIGID: ${teigidMatch[1]}`);
        console.log("Dette er teigid som skal brukes!");
      }
    } else {
      console.log("❌ Ingen treff med direkte gnr/bnr søk heller");
    }
  } catch (error) {
    console.log("Feil ved direkte søk:", error.message);
  }
}

// Kjør test
testAlleFormater();
// Test GNR 1113, BNR 28

async function testEiendom() {
  console.log("=== TEST: GNR 1113, BNR 28 ===\n");
  
  const gnr = 1113;
  const bnr = 28;
  
  console.log("Tester forskjellige teigid-formater:\n");
  
  // Test forskjellige mulige formater
  const formater = [
    // Standard format jeg har brukt
    { 
      id: String(gnr).padStart(3, '0') + String(bnr).padStart(4, '0') + '00',
      beskrivelse: "gnr(3) + bnr(4) + '00' - men GNR 1113 er 4 siffer!"
    },
    // Med 4-sifret GNR
    {
      id: String(gnr).padStart(4, '0') + String(bnr).padStart(4, '0') + '00',
      beskrivelse: "gnr(4) + bnr(4) + '00'"
    },
    // Uten padding
    {
      id: String(gnr) + String(bnr) + '00',
      beskrivelse: "gnr + bnr + '00' (ingen padding)"
    },
    // Med 3-sifret BNR siden BNR er lav
    {
      id: String(gnr) + String(bnr).padStart(3, '0') + '00',
      beskrivelse: "gnr + bnr(3) + '00'"
    },
    // Prøv uten festenummer
    {
      id: String(gnr) + String(bnr).padStart(4, '0'),
      beskrivelse: "gnr + bnr(4) uten fnr"
    },
    // Oslo kommune prefix format
    {
      id: '0301' + String(gnr).padStart(5, '0') + String(bnr).padStart(4, '0'),
      beskrivelse: "kommune + gnr(5) + bnr(4)"
    },
    // Kortere varianter
    {
      id: String(gnr) + String(bnr),
      beskrivelse: "Bare gnr + bnr"
    },
    // Hvis GNR skal være 3 siffer, ta siste 3
    {
      id: '113' + String(bnr).padStart(4, '0') + '00',
      beskrivelse: "gnr(siste 3 siffer) + bnr(4) + '00'"
    },
    // Test også med andre festenummer
    {
      id: String(gnr) + String(bnr).padStart(4, '0') + '01',
      beskrivelse: "gnr + bnr(4) + '01'"
    },
    {
      id: String(gnr) + String(bnr).padStart(4, '0') + '10',
      beskrivelse: "gnr + bnr(4) + '10'"
    }
  ];
  
  let funnetTreff = false;
  
  for (const format of formater) {
    console.log(`Test: ${format.beskrivelse}`);
    console.log(`  Teigid: ${format.id}`);
    
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
      `service=WFS&version=1.1.0&request=GetFeature&` +
      `typeName=eiendom_polygon,eiendom_linje&teigid=${format.id}`;
    
    process.stdout.write(`  Resultat: `);
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        console.log("✅ TREFF!");
        funnetTreff = true;
        
        // Hent detaljer
        console.log("\n  Detaljer fra responsen:");
        
        // Sjekk om det er kulturminne eller bygning
        const navnMatch = xml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/);
        const typeMatch = xml.match(/<ms:TYPE>(.*?)<\/ms:TYPE>/);
        const kategoriMatch = xml.match(/<ms:KATEGORI>(.*?)<\/ms:KATEGORI>/);
        const glIdMatch = xml.match(/<ms:GL_ID>(.*?)<\/ms:GL_ID>/);
        const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
        
        if (navnMatch) console.log(`    Navn: ${navnMatch[1]}`);
        if (typeMatch) console.log(`    Type: ${typeMatch[1]}`);
        if (kategoriMatch) console.log(`    Kategori: ${kategoriMatch[1]}`);
        if (glIdMatch) console.log(`    GL_ID: ${glIdMatch[1]}`);
        if (adresseMatch) console.log(`    Adresse: ${adresseMatch[1]}`);
        
        console.log("\n" + "=".repeat(60));
        console.log(`FUNGERENDE TEIGID: ${format.id}`);
        console.log("=".repeat(60) + "\n");
      } else {
        console.log("❌ Ingen treff");
      }
    } catch (error) {
      console.log("Feil: " + error.message);
    }
  }
  
  if (!funnetTreff) {
    console.log("\n⚠️ INGEN TREFF for GNR 1113, BNR 28");
    console.log("Mulige årsaker:");
    console.log("1. Eiendommen er ikke på gul liste");
    console.log("2. Teigid-formatet er annerledes for 4-sifrede GNR");
    console.log("3. Feil GNR/BNR kombinasjon");
  }
}

// Kjør test
testEiendom().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("OPPSUMMERING:");
  console.log("GNR 1113 har 4 siffer, som er uvanlig.");
  console.log("Standard format (gnr3+bnr4+fnr2) fungerer ikke her.");
  console.log("Sjekk resultatene ovenfor for eventuelle treff.");
});
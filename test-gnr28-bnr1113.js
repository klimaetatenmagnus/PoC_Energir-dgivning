// Test om det kanskje er byttet om - GNR 28, BNR 1113

async function testByttetOm() {
  console.log("=== TEST: GNR 28, BNR 1113 (byttet om?) ===\n");
  
  const gnr = 28;
  const bnr = 1113;
  
  // Test standard format
  const teigid = String(gnr).padStart(3, '0') + 
                 String(bnr).padStart(4, '0') + 
                 '00';
  
  console.log(`GNR: ${gnr}`);
  console.log(`BNR: ${bnr}`);
  console.log(`Generert teigid: ${teigid}\n`);
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  console.log("Sjekker gul liste...");
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ TREFF! Eiendommen ER på gul liste!\n");
      
      // Hent detaljer
      console.log("Detaljer fra responsen:");
      
      const navnMatch = xml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/);
      const typeMatch = xml.match(/<ms:TYPE>(.*?)<\/ms:TYPE>/);
      const kategoriMatch = xml.match(/<ms:KATEGORI>(.*?)<\/ms:KATEGORI>/);
      const glIdMatch = xml.match(/<ms:GL_ID>(.*?)<\/ms:GL_ID>/);
      const vernMatch = xml.match(/<ms:VERN>(.*?)<\/ms:VERN>/);
      const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
      
      if (navnMatch) console.log(`  Navn: ${navnMatch[1]}`);
      if (typeMatch) console.log(`  Type: ${typeMatch[1]}`);
      if (kategoriMatch) console.log(`  Kategori: ${kategoriMatch[1]}`);
      if (glIdMatch) console.log(`  GL_ID: ${glIdMatch[1]}`);
      if (vernMatch) console.log(`  Vernestatus: ${vernMatch[1]}`);
      if (adresseMatch) console.log(`  Adresse: ${adresseMatch[1]}`);
      
      // Tell antall features
      const featureCount = (xml.match(/<gml:featureMember>/g) || []).length;
      console.log(`\nAntall objekter funnet: ${featureCount}`);
      
    } else {
      console.log("❌ INGEN TREFF - Eiendommen er IKKE på gul liste");
      
      // Test også med andre festenummer
      console.log("\nPrøver med andre festenummer...");
      
      for (const fnr of [1, 2, 3, 4, 5, 10, 20]) {
        const altTeigid = String(gnr).padStart(3, '0') + 
                         String(bnr).padStart(4, '0') + 
                         String(fnr).padStart(2, '0');
        
        process.stdout.write(`  FNR ${String(fnr).padStart(2, '0')} (teigid: ${altTeigid})... `);
        
        const altUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
          `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
          `service=WFS&version=1.1.0&request=GetFeature&` +
          `typeName=eiendom_polygon,eiendom_linje&teigid=${altTeigid}`;
        
        try {
          const response = await fetch(altUrl);
          const xml = await response.text();
          
          if (xml.includes("<gml:featureMember>")) {
            console.log("✅ TREFF!");
            break;
          } else {
            console.log("❌");
          }
        } catch (error) {
          console.log("Feil");
        }
      }
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør test
testByttetOm().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("\nMerk: Oslo har vanligvis 3-sifrede GNR.");
  console.log("Hvis du har 4-sifret GNR (1113), kan det være:");
  console.log("1. Fra en annen kommune enn Oslo");
  console.log("2. En skrivefeil");
  console.log("3. Et spesielt tilfelle");
});
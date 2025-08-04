// Test Lyseveien 3 med forskjellige festenummer

async function testLyseveien() {
  console.log("=== TEST: Lyseveien 3, Oslo ===");
  console.log("GNR: 28, BNR: 9570\n");
  
  const gnr = 28;
  const bnr = 9570;
  
  // Prøv forskjellige festenummer (00-99)
  const festenummerTester = [0, 1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 99];
  
  let funnetGulListe = false;
  
  for (const fnr of festenummerTester) {
    // Generer teigid: 3 siffer gnr + 4 siffer bnr + 2 siffer fnr
    const teigid = String(gnr).padStart(3, '0') + 
                   String(bnr).padStart(4, '0') + 
                   String(fnr).padStart(2, '0');
    
    process.stdout.write(`Tester festenummer ${String(fnr).padStart(2, '0')} (teigid: ${teigid})... `);
    
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
      `service=WFS&version=1.1.0&request=GetFeature&` +
      `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        console.log("✅ TREFF! På gul liste!");
        funnetGulListe = true;
        
        // Prøv å finne mer info
        const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
        if (adresseMatch) {
          console.log(`  Adresse i gul liste: ${adresseMatch[1]}`);
        }
      } else {
        console.log("❌");
      }
    } catch (error) {
      console.log("Feil:", error.message);
    }
  }
  
  if (!funnetGulListe) {
    console.log("\n📌 Ingen treff på gul liste for denne eiendommen");
    console.log("Dette betyr sannsynligvis at bygningen IKKE er på gul liste.");
  }
  
  // Test også med full Oslo-format (med kommune-prefix)
  console.log("\n" + "=".repeat(50));
  console.log("Test med alternative formater:\n");
  
  // Test med 10-sifret format (kommune + gnr + bnr)
  const altTeigid1 = "0301" + String(gnr).padStart(5, '0') + String(bnr).padStart(4, '0');
  console.log(`10-sifret format: ${altTeigid1}`);
  await testEnkelTeigid(altTeigid1);
  
  // Test med kortere format
  const altTeigid2 = String(gnr) + String(bnr) + "00";
  console.log(`\nKort format: ${altTeigid2}`);
  await testEnkelTeigid(altTeigid2);
}

async function testEnkelTeigid(teigid) {
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ TREFF på gul liste!");
    } else {
      console.log("❌ Ingen treff");
    }
  } catch (error) {
    console.log("Feil:", error.message);
  }
}

// Kjør test
testLyseveien().then(() => {
  console.log("\n" + "=".repeat(50));
  console.log("\nANBEFALING:");
  console.log("1. Start alltid med festenummer 00");
  console.log("2. Hvis ingen treff, er bygningen sannsynligvis ikke på gul liste");
  console.log("3. For de fleste eiendommer i Oslo er festenummer 00");
  console.log("\nFORMEL: teigid = gnr(3 siffer) + bnr(4 siffer) + '00'");
});
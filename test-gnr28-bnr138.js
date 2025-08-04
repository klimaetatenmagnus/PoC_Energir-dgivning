// Test GNR 28, BNR 138 uten festenummer

async function testEiendom() {
  console.log("=== TEST: GNR 28, BNR 138 ===\n");
  
  const gnr = 28;
  const bnr = 138;
  
  // Generer teigid med festenummer 00
  const teigid = String(gnr).padStart(3, '0') + 
                 String(bnr).padStart(4, '0') + 
                 '00';
  
  console.log(`Generert teigid: ${teigid}`);
  console.log(`Format: GNR(${String(gnr).padStart(3, '0')}) + BNR(${String(bnr).padStart(4, '0')}) + FNR(00)\n`);
  
  console.log("Sjekker gul liste-status...");
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response lengde: ${xml.length} tegn\n`);
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ TREFF! Bygningen ER på gul liste!");
      
      // Prøv å finne adresse og annen info fra XML
      const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
      const gnrMatch = xml.match(/<ms:gnr>(\d+)<\/ms:gnr>/);
      const bnrMatch = xml.match(/<ms:bnr>(\d+)<\/ms:bnr>/);
      const fnrMatch = xml.match(/<ms:fnr>(\d+)<\/ms:fnr>/);
      
      console.log("\nDetaljer fra gul liste:");
      if (adresseMatch) console.log(`  Adresse: ${adresseMatch[1]}`);
      if (gnrMatch) console.log(`  GNR: ${gnrMatch[1]}`);
      if (bnrMatch) console.log(`  BNR: ${bnrMatch[1]}`);
      if (fnrMatch) console.log(`  FNR: ${fnrMatch[1]}`);
      
      // Vis første del av XML for å se strukturen
      const start = xml.indexOf("<gml:featureMember>");
      const end = xml.indexOf("</gml:featureMember>", start) + 20;
      console.log("\nUtdrag fra XML-respons:");
      console.log(xml.substring(start, Math.min(end, start + 800)));
      
    } else {
      console.log("❌ INGEN TREFF - Bygningen er IKKE på gul liste");
    }
    
  } catch (error) {
    console.error("Feil ved API-kall:", error.message);
  }
  
  // Test også med andre festenummer for å være sikker
  console.log("\n" + "=".repeat(50));
  console.log("Dobbelsjekk med andre festenummer:\n");
  
  const testFnr = [1, 2, 3, 4, 5];
  for (const fnr of testFnr) {
    const altTeigid = String(gnr).padStart(3, '0') + 
                     String(bnr).padStart(4, '0') + 
                     String(fnr).padStart(2, '0');
    
    process.stdout.write(`Tester med FNR ${String(fnr).padStart(2, '0')} (teigid: ${altTeigid})... `);
    
    const altUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
      `service=WFS&version=1.1.0&request=GetFeature&` +
      `typeName=eiendom_polygon,eiendom_linje&teigid=${altTeigid}`;
    
    try {
      const response = await fetch(altUrl);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        console.log("✅ TREFF!");
      } else {
        console.log("❌");
      }
    } catch (error) {
      console.log("Feil");
    }
  }
}

// Kjør test
testEiendom().then(() => {
  console.log("\n" + "=".repeat(50));
  console.log("\nRESULTAT:");
  console.log("Teigid for GNR 28, BNR 138: 028013800");
  console.log("Sjekk resultat ovenfor for gul liste-status");
});
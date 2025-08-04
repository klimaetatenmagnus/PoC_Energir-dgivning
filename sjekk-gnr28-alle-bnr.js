// Sjekk alle mulige BNR for GNR 28 rundt 138

async function sjekkAlleBNR() {
  console.log("=== SJEKKER GNR 28 MED FORSKJELLIGE BNR RUNDT 138 ===\n");
  console.log("Kanskje BNR er registrert annerledes i gul liste?\n");
  
  const gnr = 28;
  const bnrListe = [
    // Rundt 138
    135, 136, 137, 138, 139, 140, 141,
    // Kanskje med ekstra siffer?
    1380, 1381, 1382, 1383, 1384, 1385,
    // Eller kortere?
    13, 14, 38,
    // Andre varianter
    318, 183, 381, 813, 831
  ];
  
  console.log(`Testing GNR ${gnr} med forskjellige BNR:\n`);
  
  for (const bnr of bnrListe) {
    // Test med standard format og festenummer 00
    const teigid = String(gnr).padStart(3, '0') + 
                   String(bnr).padStart(4, '0') + 
                   '00';
    
    process.stdout.write(`GNR ${gnr}, BNR ${bnr.toString().padEnd(4)} -> teigid ${teigid}... `);
    
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
      `service=WFS&version=1.1.0&request=GetFeature&` +
      `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        console.log("✅ TREFF!");
        
        // Hent detaljer
        const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
        const gnrMatch = xml.match(/<ms:gnr>(\d+)<\/ms:gnr>/);
        const bnrMatch = xml.match(/<ms:bnr>(\d+)<\/ms:bnr>/);
        const fnrMatch = xml.match(/<ms:fnr>(\d+)<\/ms:fnr>/);
        
        console.log(`\n  Detaljer:`);
        if (adresseMatch) console.log(`    Adresse: ${adresseMatch[1]}`);
        if (gnrMatch && bnrMatch) {
          console.log(`    Matrikkel: GNR ${gnrMatch[1]}, BNR ${bnrMatch[1]}${fnrMatch ? ', FNR ' + fnrMatch[1] : ''}`);
        }
        console.log();
      } else {
        console.log("❌");
      }
    } catch (error) {
      console.log("Feil");
    }
  }
  
  // Test også med det kjente eksempelet for å bekrefte at API fungerer
  console.log("\n" + "=".repeat(60));
  console.log("KONTROLLTEST med kjent eksempel (291199441):\n");
  
  const kjentTeigid = "291199441";
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${kjentTeigid}`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log(`✅ Kjent eksempel fungerer fortsatt (${kjentTeigid})`);
      
      const gnrMatch = xml.match(/<ms:gnr>(\d+)<\/ms:gnr>/);
      const bnrMatch = xml.match(/<ms:bnr>(\d+)<\/ms:bnr>/);
      const fnrMatch = xml.match(/<ms:fnr>(\d+)<\/ms:fnr>/);
      const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
      
      if (gnrMatch && bnrMatch) {
        console.log(`  GNR: ${gnrMatch[1]}`);
        console.log(`  BNR: ${bnrMatch[1]}`);
        console.log(`  FNR: ${fnrMatch?.[1] || 'ikke satt'}`);
        console.log(`  Adresse: ${adresseMatch?.[1]}`);
        
        // Analyser formatet
        const gnr = gnrMatch[1];
        const bnr = bnrMatch[1];
        const fnr = fnrMatch?.[1] || '0';
        
        console.log(`\n  Format-analyse av ${kjentTeigid}:`);
        console.log(`    Som gnr(3)+bnr(4)+fnr(2): ${gnr.padStart(3,'0')}${bnr.padStart(4,'0')}${fnr.padStart(2,'0')}`);
        console.log(`    Som gnr+bnr(4)+fnr(2): ${gnr}${bnr.padStart(4,'0')}${fnr.padStart(2,'0')}`);
        console.log(`    Faktisk teigid: ${kjentTeigid}`);
      }
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør test
sjekkAlleBNR().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("\nKONKLUSJON:");
  console.log("Hvis GNR 28, BNR 138 ikke gir treff med standard format,");
  console.log("kan det være at:");
  console.log("1. Eiendommen er registrert med annet BNR i gul liste");
  console.log("2. Det kreves spesielt festenummer");
  console.log("3. Eiendommen er faktisk ikke på gul liste i API-et");
  console.log("\nSjekk resultatene ovenfor for eventuelle treff på GNR 28.");
});
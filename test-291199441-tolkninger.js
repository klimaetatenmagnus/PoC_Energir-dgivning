// Test forskjellige tolkninger av teigid 291199441

async function analyserTeigid() {
  console.log("=== ANALYSE AV TEIGID 291199441 ===\n");
  
  const teigid = "291199441";
  console.log(`Teigid: ${teigid} (${teigid.length} siffer)\n`);
  
  // Først bekreft at dette teigid faktisk er på gul liste
  console.log("1. Bekrefte at teigid er på gul liste...");
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Bekreftet på gul liste!\n");
      
      // Prøv å finne GNR/BNR/FNR fra XML responsen
      console.log("2. Hente faktisk GNR/BNR/FNR fra API-responsen:");
      
      const gnrMatch = xml.match(/<ms:gnr>(\d+)<\/ms:gnr>/);
      const bnrMatch = xml.match(/<ms:bnr>(\d+)<\/ms:bnr>/);
      const fnrMatch = xml.match(/<ms:fnr>(\d+)<\/ms:fnr>/);
      const snrMatch = xml.match(/<ms:snr>(\d+)<\/ms:snr>/);
      const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
      
      if (gnrMatch || bnrMatch || fnrMatch || adresseMatch) {
        console.log("\nFaktiske verdier fra API:");
        if (gnrMatch) console.log(`  GNR: ${gnrMatch[1]}`);
        if (bnrMatch) console.log(`  BNR: ${bnrMatch[1]}`);
        if (fnrMatch) console.log(`  FNR: ${fnrMatch[1]}`);
        if (snrMatch) console.log(`  SNR: ${snrMatch[1]}`);
        if (adresseMatch) console.log(`  Adresse: ${adresseMatch[1]}`);
        
        // Sjekk om verdiene matcher våre antakelser
        if (gnrMatch && bnrMatch) {
          const gnr = gnrMatch[1];
          const bnr = bnrMatch[1];
          const fnr = fnrMatch ? fnrMatch[1] : '0';
          
          console.log("\n3. Sammenligne med mulige tolkninger:");
          
          // Test forskjellige formater
          const muligFormat1 = gnr.padStart(3, '0') + bnr.padStart(4, '0') + fnr.padStart(2, '0');
          const muligFormat2 = gnr + bnr + fnr;
          const muligFormat3 = gnr.padStart(4, '0') + bnr.padStart(4, '0') + fnr;
          
          console.log(`\n  Tolkning 1 (gnr3+bnr4+fnr2): ${muligFormat1}`);
          console.log(`    Matcher: ${teigid === muligFormat1 ? '✅' : '❌'}`);
          
          console.log(`\n  Tolkning 2 (gnr+bnr+fnr): ${muligFormat2}`);
          console.log(`    Matcher: ${teigid === muligFormat2 ? '✅' : '❌'}`);
          
          console.log(`\n  Tolkning 3 (gnr4+bnr4+fnr): ${muligFormat3}`);
          console.log(`    Matcher: ${teigid === muligFormat3 ? '✅' : '❌'}`);
        }
      } else {
        console.log("\n❌ Ingen GNR/BNR/FNR funnet i XML-responsen");
        console.log("API returnerer kanskje ikke disse feltene.");
      }
      
      // Vis mer av XML for manuell inspeksjon
      console.log("\n4. Første del av XML-respons for manuell analyse:");
      console.log("=" * 60);
      const start = xml.indexOf("<gml:featureMember>");
      const end = Math.min(start + 2000, xml.length);
      console.log(xml.substring(start, end));
      console.log("=" * 60);
      
    } else {
      console.log("❌ Ikke på gul liste");
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør analyse
analyserTeigid().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("\nMulige tolkninger av 291199441:");
  console.log("1. GNR 291, BNR 1994, FNR 41");
  console.log("2. GNR 2911, BNR 994, FNR 41"); 
  console.log("3. GNR 29, BNR 11994, FNR 41");
  console.log("4. Helt annet format - kanskje ikke basert på GNR/BNR");
  console.log("\nSjekk XML-output ovenfor for faktiske verdier!");
});
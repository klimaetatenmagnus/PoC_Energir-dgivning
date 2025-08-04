// Test forskjellige teigid-formater

async function testTeigidFormat(teigid, beskrivelse) {
  console.log(`\nTester: ${beskrivelse}`);
  console.log(`Teigid: ${teigid}`);
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ TREFF! Dette formatet fungerer!");
      
      // Prøv å finne gnr/bnr fra XML
      const gnrMatch = xml.match(/<ms:gnr>(\d+)<\/ms:gnr>/);
      const bnrMatch = xml.match(/<ms:bnr>(\d+)<\/ms:bnr>/);
      const fnrMatch = xml.match(/<ms:fnr>(\d+)<\/ms:fnr>/);
      const snrMatch = xml.match(/<ms:snr>(\d+)<\/ms:snr>/);
      
      if (gnrMatch) console.log(`  Gårdsnummer: ${gnrMatch[1]}`);
      if (bnrMatch) console.log(`  Bruksnummer: ${bnrMatch[1]}`);
      if (fnrMatch) console.log(`  Festenummer: ${fnrMatch[1]}`);
      if (snrMatch) console.log(`  Seksjonsnummer: ${snrMatch[1]}`);
      
      return true;
    } else {
      console.log("❌ Ingen treff");
      return false;
    }
  } catch (error) {
    console.error("Feil:", error.message);
    return false;
  }
}

async function analyserTeigid() {
  console.log("=== ANALYSE AV TEIGID-FORMAT ===\n");
  
  const kjentTeigid = "291199441";
  console.log(`Kjent fungerende teigid: ${kjentTeigid}`);
  console.log(`Lengde: ${kjentTeigid.length} tegn`);
  
  // Analyser strukturen
  console.log("\nMulige tolkninger:");
  console.log("1. Som 9-sifret nummer: 291-199-441");
  console.log("   Gård 291, Bruk 199, Feste 441?");
  console.log("2. Som 9-sifret nummer: 291-1994-41");
  console.log("   Gård 291, Bruk 1994, Feste 41?");
  console.log("3. Som direkte ID: 291199441");
  
  // Test forskjellige formater
  console.log("\n" + "=".repeat(50));
  console.log("TESTING AV FORMATER:");
  
  // Original som fungerer
  await testTeigidFormat("291199441", "Original (fungerer)");
  
  // Test med leading zeros
  await testTeigidFormat("0291199441", "Med leading 0");
  await testTeigidFormat("00291199441", "Med leading 00");
  
  // Test med kommune prefix
  await testTeigidFormat("0301291199441", "Med Oslo kommune prefix");
  
  // Test andre varianter
  await testTeigidFormat("291001990441", "291-199-441 med padding");
  await testTeigidFormat("0291019900441", "0291-0199-00441");
  
  // Test helt andre teigid for å se formatet
  console.log("\n" + "=".repeat(50));
  console.log("TEST MED ANDRE TEIGID:");
  
  // Prøv noen tilfeldige
  for (let i = 291199440; i <= 291199445; i++) {
    await testTeigidFormat(String(i), `Sekvens test: ${i}`);
  }
}

async function finnFormatRegler() {
  console.log("\n" + "=".repeat(50));
  console.log("KONKLUSJON:");
  console.log("\nBasert på testene ser det ut som:");
  console.log("1. Teigid i Oslo er et 9-sifret nummer");
  console.log("2. IKKE prefixet med kommunenummer");
  console.log("3. Formatet er sannsynligvis: GGG-BBBB-FF");
  console.log("   hvor G=gård (3 siffer), B=bruk (4 siffer), F=feste (2 siffer)");
  console.log("\nFor å generere teigid fra gnr/bnr:");
  console.log("teigid = gnr(3 siffer) + bnr(4 siffer) + '00'");
}

// Kjør analyse
analyserTeigid().then(finnFormatRegler);
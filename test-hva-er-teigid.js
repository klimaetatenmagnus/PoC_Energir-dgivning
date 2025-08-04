// La oss finne ut hva "teigid" faktisk er i API-et

async function undersokAPI() {
  console.log("=== HVA ER 'teigid' I OSLO KOMMUNE API? ===\n");
  
  // Test 1: Hva skjer hvis vi sender ugyldig teigid?
  console.log("1. Test med ugyldig teigid '123':");
  let url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=123`;
  
  try {
    let response = await fetch(url);
    let xml = await response.text();
    console.log(`  Response lengde: ${xml.length} tegn`);
    console.log(`  Inneholder features: ${xml.includes("<gml:featureMember>") ? "Ja" : "Nei"}`);
  } catch (error) {
    console.log(`  Feil: ${error.message}`);
  }
  
  // Test 2: Hva skjer med kjent fungerende verdi?
  console.log("\n2. Test med kjent fungerende verdi '291199441':");
  url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=291199441`;
  
  try {
    let response = await fetch(url);
    let xml = await response.text();
    console.log(`  Response lengde: ${xml.length} tegn`);
    console.log(`  Inneholder features: ${xml.includes("<gml:featureMember>") ? "Ja" : "Nei"}`);
    
    // Hva inneholder XML-en faktisk?
    console.log("\n3. Faktiske felter i responsen:");
    
    // Finn alle unike felt-navn i XML
    const fieldMatches = xml.matchAll(/<ms:([^>]+)>([^<]*)<\/ms:\1>/g);
    const fields = new Map();
    
    for (const match of fieldMatches) {
      const fieldName = match[1];
      const fieldValue = match[2];
      
      if (!fields.has(fieldName)) {
        fields.set(fieldName, []);
      }
      fields.get(fieldName).push(fieldValue);
    }
    
    console.log("\nAlle felter funnet i responsen:");
    for (const [field, values] of fields) {
      // Vis første unike verdi for hvert felt
      const uniqueValues = [...new Set(values)].slice(0, 3);
      console.log(`  ${field}: ${uniqueValues.join(", ")}`);
    }
    
  } catch (error) {
    console.log(`  Feil: ${error.message}`);
  }
  
  // Test 3: Er det mulig å søke på andre parametere?
  console.log("\n4. Test om vi kan søke på GL_ID i stedet:");
  url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&GL_ID=140270`;
  
  try {
    let response = await fetch(url);
    let xml = await response.text();
    console.log(`  Response med GL_ID: ${xml.length} tegn`);
    console.log(`  Inneholder features: ${xml.includes("<gml:featureMember>") ? "Ja" : "Nei"}`);
  } catch (error) {
    console.log(`  Feil: ${error.message}`);
  }
  
  // Test 4: Hva returneres UTEN teigid parameter?
  console.log("\n5. Test UTEN teigid parameter:");
  url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje`;
  
  try {
    let response = await fetch(url);
    let xml = await response.text();
    console.log(`  Response uten teigid: ${xml.length} tegn`);
    console.log(`  Inneholder features: ${xml.includes("<gml:featureMember>") ? "Ja" : "Nei"}`);
    
    // Hvis det er feil, vis feilmelding
    if (xml.includes("ServiceException") || xml.includes("Error")) {
      const errorMatch = xml.match(/<ServiceException[^>]*>([^<]+)<\/ServiceException>/);
      if (errorMatch) {
        console.log(`  Feilmelding: ${errorMatch[1]}`);
      }
    }
  } catch (error) {
    console.log(`  Feil: ${error.message}`);
  }
}

// Kjør undersøkelse
undersokAPI().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("\nHVA VI FAKTISK VET:");
  console.log("1. API-et godtar en parameter som heter 'teigid'");
  console.log("2. Verdien '291199441' gir treff");
  console.log("3. Responsen inneholder kulturminnedata, IKKE vanlige bygninger");
  console.log("4. Responsen inneholder IKKE gnr/bnr/fnr felter");
  console.log("5. 'teigid' er kanskje ikke relatert til matrikkel i det hele tatt!");
});
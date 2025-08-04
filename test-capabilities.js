// Sjekk hva som er tilgjengelig i Oslo kommune API

async function sjekkCapabilities() {
  console.log("=== SJEKKER OSLO KOMMUNE WFS CAPABILITIES ===\n");
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?service=WFS&request=GetCapabilities&version=1.1.0`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    // Finn alle FeatureTypes relatert til eiendom eller gul liste
    console.log("Søker etter eiendom/gulliste-relaterte tjenester...\n");
    
    // Finn alle FeatureType elementer
    const featureTypes = xml.matchAll(/<FeatureType>[\s\S]*?<\/FeatureType>/g);
    
    for (const match of featureTypes) {
      const content = match[0];
      
      // Sjekk om det inneholder gul/gull eller eiendom
      if (content.toLowerCase().includes('gul') || 
          content.toLowerCase().includes('gull') || 
          content.toLowerCase().includes('eiendom')) {
        
        const name = content.match(/<Name>(.*?)<\/Name>/)?.[1];
        const title = content.match(/<Title>(.*?)<\/Title>/)?.[1];
        const abstract = content.match(/<Abstract>(.*?)<\/Abstract>/)?.[1];
        
        if (name) {
          console.log(`Funnet tjeneste: ${name}`);
          if (title) console.log(`  Tittel: ${title}`);
          if (abstract) console.log(`  Beskrivelse: ${abstract}`);
          console.log();
        }
      }
    }
    
    // Test direkte DescribeFeatureType for gulliste_spatial
    console.log("\n" + "=".repeat(60));
    console.log("UNDERSØKER STRUKTUR FOR gulliste_spatial...\n");
    
    await beskrivelseFeatureType();
    
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

async function beskrivelseFeatureType() {
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&` +
    `service=WFS&version=1.1.0&` +
    `request=DescribeFeatureType&` +
    `typeName=eiendom_polygon`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    console.log("Felter i eiendom_polygon:");
    
    // Finn alle element-definisjoner
    const elements = xml.matchAll(/<xsd:element\s+name="([^"]+)"\s+type="([^"]+)"/g);
    
    for (const match of elements) {
      console.log(`  - ${match[1]} (${match[2]})`);
    }
    
  } catch (error) {
    console.error("Feil ved DescribeFeatureType:", error.message);
  }
}

async function testMedKoordinater() {
  console.log("\n" + "=".repeat(60));
  console.log("TESTER MED BBOX FOR Å FINNE EIENDOMMER...\n");
  
  // Bruk en BBOX rundt sentrum av Oslo
  const bbox = "596000,6641000,600000,6645000";  // UTM33
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon&` +
    `bbox=${bbox},EPSG:32632&` +
    `maxFeatures=5`;
  
  console.log("Henter eiendommer innenfor BBOX...");
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Fant eiendommer!\n");
      
      // Parse første eiendom for å se struktur
      const firstFeature = xml.match(/<gml:featureMember>([\s\S]*?)<\/gml:featureMember>/)?.[1];
      
      if (firstFeature) {
        const teigid = firstFeature.match(/<ms:teigid>(\d+)<\/ms:teigid>/)?.[1];
        const gnr = firstFeature.match(/<ms:gnr>(\d+)<\/ms:gnr>/)?.[1];
        const bnr = firstFeature.match(/<ms:bnr>(\d+)<\/ms:bnr>/)?.[1];
        const fnr = firstFeature.match(/<ms:fnr>(\d+)<\/ms:fnr>/)?.[1];
        const adresse = firstFeature.match(/<ms:adresse>(.*?)<\/ms:adresse>/)?.[1];
        
        console.log("Eksempel på eiendom på gul liste:");
        console.log(`  Teigid: ${teigid}`);
        console.log(`  GNR: ${gnr}`);
        console.log(`  BNR: ${bnr}`);
        console.log(`  FNR: ${fnr || 'ikke satt'}`);
        console.log(`  Adresse: ${adresse}`);
        
        if (teigid && gnr && bnr) {
          console.log("\nAnalyse av teigid-format:");
          console.log(`  Teigid: ${teigid} (${teigid.length} siffer)`);
          console.log(`  GNR ${gnr}, BNR ${bnr}, FNR ${fnr || '0'}`);
          
          // Test forskjellige formater
          const format1 = gnr.padStart(3, '0') + bnr.padStart(4, '0') + (fnr || '0').padStart(2, '0');
          const format2 = gnr + bnr.padStart(4, '0') + (fnr || '0').padStart(2, '0');
          
          console.log(`  Format 1 (gnr3+bnr4+fnr2): ${format1}`);
          console.log(`  Format 2 (gnr+bnr4+fnr2): ${format2}`);
          console.log(`  Matcher format 1: ${teigid === format1 ? '✓' : '✗'}`);
          console.log(`  Matcher format 2: ${teigid === format2 ? '✓' : '✗'}`);
        }
      }
    } else {
      console.log("❌ Ingen eiendommer funnet med BBOX");
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør alle tester
async function main() {
  await sjekkCapabilities();
  await testMedKoordinater();
}

main();
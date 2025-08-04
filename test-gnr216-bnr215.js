// Test GNR 216, BNR 215

async function finnTeigid() {
  console.log("=== FINN TEIGID FOR GNR 216, BNR 215 ===\n");
  
  const gnr = 216;
  const bnr = 215;
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=WFS_SOK&VERSION=1.1.0&SERVICE=WFS&REQUEST=GetFeature&` +
    `TYPENAME=EIENDOM_WFS&` +
    `Filter=<Filter><And>` +
    `<PropertyIsEqualTo><PropertyName>GARDSNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>` +
    `<PropertyIsEqualTo><PropertyName>BRUKSNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>` +
    `</And></Filter>`;
  
  console.log(`Søker etter GNR ${gnr}, BNR ${bnr}...\n`);
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      // Hent alle teigid
      const idMatches = [...xml.matchAll(/<ms:ID>(\d+)<\/ms:ID>/gi)];
      
      if (idMatches.length === 1) {
        const teigid = idMatches[0][1];
        console.log(`✅ TEIGID FUNNET: ${teigid}\n`);
        
        // Sjekk også om den er på gul liste
        console.log("Sjekker gul liste-status...");
        
        const gulListeUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
          `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
          `service=WFS&version=1.1.0&request=GetFeature&` +
          `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
        
        const gulResponse = await fetch(gulListeUrl);
        const gulXml = await gulResponse.text();
        
        if (gulXml.includes("<gml:featureMember>")) {
          console.log("✅ Eiendommen ER på gul liste!");
          
          // Hent navn/adresse
          const navnMatch = gulXml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/);
          if (navnMatch) {
            console.log(`Navn/adresse: ${navnMatch[1]}`);
          }
        } else {
          console.log("❌ Eiendommen er IKKE på gul liste");
        }
        
      } else if (idMatches.length > 1) {
        console.log("⚠️ Flere teigid funnet:");
        idMatches.forEach(match => {
          console.log(`  - ${match[1]}`);
        });
        console.log("\nBruk første teigid for gul liste-sjekk...");
        
        const teigid = idMatches[0][1];
        const gulListeUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
          `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
          `service=WFS&version=1.1.0&request=GetFeature&` +
          `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
        
        const gulResponse = await fetch(gulListeUrl);
        const gulXml = await gulResponse.text();
        
        if (gulXml.includes("<gml:featureMember>")) {
          console.log(`✅ Teigid ${teigid} ER på gul liste!`);
        } else {
          console.log(`❌ Teigid ${teigid} er IKKE på gul liste`);
        }
      }
    } else {
      console.log("❌ Ingen teigid funnet for GNR 216, BNR 215");
      console.log("\nMulige årsaker:");
      console.log("- Eiendommen finnes ikke");
      console.log("- Feil GNR/BNR kombinasjon");
      console.log("- Eiendommen er ikke i Oslo kommune");
    }
    
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

// Kjør test
finnTeigid().then(() => {
  console.log("\n" + "=".repeat(60));
  console.log("RESULTAT FOR GNR 216, BNR 215:");
  console.log("Se teigid ovenfor");
});
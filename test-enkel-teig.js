// Enkleste mulige test for å finne teigid

async function testOsloKommune() {
  console.log("=== TEST AV OSLO KOMMUNE EIENDOMS-API ===\n");
  
  // Test med kjent teigid fra eksempelet ditt
  const kjentTeigid = "291199441";
  
  console.log(`Test med kjent teigid: ${kjentTeigid}`);
  
  // 1. Sjekk om teigid finnes i gul liste
  const gulListeUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${kjentTeigid}`;
  
  try {
    console.log("\n1. Sjekker gul liste...");
    const response = await fetch(gulListeUrl);
    const xml = await response.text();
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response length: ${xml.length} chars`);
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Teigid finnes i gul liste!");
      
      // Vis litt av XML-responsen
      const start = xml.indexOf("<gml:featureMember>");
      const end = xml.indexOf("</gml:featureMember>", start) + 20;
      console.log("\nUtdrag fra XML:");
      console.log(xml.substring(start, Math.min(end, start + 500)));
    } else {
      console.log("❌ Teigid finnes IKKE i gul liste");
    }
  } catch (error) {
    console.error("Feil:", error);
  }
  
  // 2. Test GetCapabilities for å se hva som er tilgjengelig
  console.log("\n2. Sjekker tilgjengelige tjenester...");
  const capsUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?service=WFS&request=GetCapabilities&version=1.1.0`;
  
  try {
    const response = await fetch(capsUrl);
    const xml = await response.text();
    
    // Finn alle FeatureType som inneholder "eiendom"
    const matches = xml.match(/<FeatureType>.*?eiendom.*?<\/FeatureType>/gis);
    if (matches) {
      console.log("\nTilgjengelige eiendoms-lag:");
      matches.forEach(match => {
        const nameMatch = match.match(/<Name>(.*?)<\/Name>/);
        if (nameMatch) {
          console.log(`- ${nameMatch[1]}`);
        }
      });
    }
  } catch (error) {
    console.error("Capabilities-feil:", error);
  }
  
  // 3. Test direkte eiendomsoppslag
  console.log("\n3. Tester direkte eiendomsoppslag...");
  const eiendomUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon&` +
    `maxFeatures=1&` +
    `propertyName=teigid,adresse,gnr,bnr`;
  
  try {
    const response = await fetch(eiendomUrl);
    const xml = await response.text();
    
    console.log(`Response length: ${xml.length} chars`);
    
    // Finn første teigid i responsen
    const teigidMatch = xml.match(/<ms:teigid>(\d+)<\/ms:teigid>/);
    if (teigidMatch) {
      console.log(`\nEksempel teigid funnet: ${teigidMatch[1]}`);
      
      // Finn tilhørende adresse
      const adresseMatch = xml.match(/<ms:adresse>(.*?)<\/ms:adresse>/);
      if (adresseMatch) {
        console.log(`Adresse: ${adresseMatch[1]}`);
      }
    }
  } catch (error) {
    console.error("Eiendomsoppslag-feil:", error);
  }
}

// Funksjon for å konvertere adresse til teigid
async function adresseTilTeigid(adresse) {
  console.log(`\n=== KONVERTERING: "${adresse}" ===`);
  
  // Steg 1: Finn koordinater via Kartverket
  const kartverketUrl = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(adresse)}&kommunenummer=0301&treffPerSide=1`;
  
  try {
    const response = await fetch(kartverketUrl);
    const data = await response.json();
    
    if (data.adresser && data.adresser.length > 0) {
      const adr = data.adresser[0];
      console.log(`Fant: ${adr.adressetekst}`);
      console.log(`Koordinater: ${adr.representasjonspunkt.lat}, ${adr.representasjonspunkt.lon}`);
      
      // Steg 2: Bruk koordinatene til å finne eiendom
      // Dette krever typisk et kart-klikk eller spatial query
      // Som vi ikke kan gjøre direkte via WFS uten kompleks geometri
      
      console.log("\n⚠️ For å finne teigid fra adresse trenger vi:");
      console.log("1. En spatial database med eiendomsgrenser");
      console.log("2. Eller bruke Oslo kommunes karttjeneste interaktivt");
      console.log("3. Eller ha en adresse-til-teigid mapping");
      
      return null;
    }
  } catch (error) {
    console.error("Feil:", error);
  }
  
  return null;
}

// Kjør tester
async function main() {
  await testOsloKommune();
  
  console.log("\n" + "=".repeat(60));
  await adresseTilTeigid("Stortingsgata 10, Oslo");
}

main();
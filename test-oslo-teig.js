// Enklere test for å finne teigid i Oslo

async function finnTeigidFraAdresse(adresse) {
  console.log(`\nSøker etter: ${adresse}`);
  
  // Steg 1: Søk etter adresse via Oslo kommunes API
  const sokeUrl = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(adresse)}&kommunenummer=0301&treffPerSide=1`;
  
  try {
    const response = await fetch(sokeUrl);
    const data = await response.json();
    
    if (data.adresser && data.adresser.length > 0) {
      const adresseInfo = data.adresser[0];
      console.log(`\n✅ Fant adresse: ${adresseInfo.adressetekst}`);
      
      // Hent matrikkelinfo
      const matrikkel = adresseInfo.matrikkelenhet;
      if (matrikkel) {
        console.log(`Kommune: ${matrikkel.kommunenummer}`);
        console.log(`Gårdsnummer: ${matrikkel.gardsnummer}`);
        console.log(`Bruksnummer: ${matrikkel.bruksnummer}`);
        
        // Generer teigid for Oslo (format: kommunenr + gardsnr + bruksnr)
        // Oslo bruker 10-sifret format: 0301 + 5-sifret gård + 4-sifret bruk
        const teigid = `0301${matrikkel.gardsnummer.toString().padStart(5, '0')}${matrikkel.bruksnummer.toString().padStart(4, '0')}`;
        console.log(`\n📍 Generert teigid: ${teigid}`);
        
        return {
          teigid: teigid,
          adresse: adresseInfo.adressetekst,
          koordinater: adresseInfo.representasjonspunkt
        };
      }
    } else {
      console.log("❌ Ingen adresse funnet");
    }
  } catch (error) {
    console.error("Feil:", error);
  }
  
  return null;
}

async function sjekkGulListe(teigid) {
  const url = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms?" +
    "map=EIENDOM_TABELL&" +
    "tabell=kart.gulliste_spatial&" +
    "service=WFS&version=1.1.0&" +
    "request=GetFeature&" +
    "typeName=eiendom_polygon,eiendom_linje&" +
    "teigid=" + teigid;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Feil ved gul liste-sjekk:", error);
    return null;
  }
}

async function testKomplettFlyt(adresse) {
  console.log("\n" + "=".repeat(60));
  console.log(`TEST: ${adresse}`);
  console.log("=".repeat(60));
  
  // Finn teigid
  const teigInfo = await finnTeigidFraAdresse(adresse);
  
  if (teigInfo) {
    // Sjekk gul liste
    console.log("\n🔍 Sjekker gul liste...");
    const paaGulListe = await sjekkGulListe(teigInfo.teigid);
    
    if (paaGulListe === true) {
      console.log("✅ BYGNINGEN ER PÅ GUL LISTE!");
    } else if (paaGulListe === false) {
      console.log("❌ Bygningen er IKKE på gul liste");
    } else {
      console.log("⚠️ Kunne ikke sjekke gul liste-status");
    }
    
    return {
      ...teigInfo,
      gulListe: paaGulListe
    };
  }
  
  return null;
}

// Test med flere adresser
async function test() {
  console.log("=== TEST AV TEIGID-OPPSLAG OG GUL LISTE ===\n");
  
  const testAdresser = [
    "Stortingsgata 10, Oslo",
    "Karl Johans gate 1, Oslo", 
    "Rådhusplassen 1, Oslo",
    "Schweigaards gate 21, Oslo",
    "Trondheimsveien 2, Oslo"
  ];
  
  const resultater = [];
  
  for (const adresse of testAdresser) {
    const resultat = await testKomplettFlyt(adresse);
    if (resultat) {
      resultater.push(resultat);
    }
  }
  
  // Oppsummering
  console.log("\n" + "=".repeat(60));
  console.log("OPPSUMMERING");
  console.log("=".repeat(60));
  
  console.log("\nBygninger på gul liste:");
  resultater.filter(r => r.gulListe === true).forEach(r => {
    console.log(`✅ ${r.adresse} (teigid: ${r.teigid})`);
  });
  
  console.log("\nBygninger IKKE på gul liste:");
  resultater.filter(r => r.gulListe === false).forEach(r => {
    console.log(`❌ ${r.adresse} (teigid: ${r.teigid})`);
  });
}

// Kjør test
test();
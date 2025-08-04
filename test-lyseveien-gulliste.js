/**
 * Test for å sjekke om Lyseveien 3 er på gul liste
 * 
 * Trinn:
 * 1. Søk etter adressen via Geonorge for å finne gnr/bnr
 * 2. Bruk gnr/bnr til å finne teigid (hvis mulig)
 * 3. Sjekk gul liste med teigid
 */

// Steg 1: Søk etter adresse via Geonorge
async function sokAdresse(adresse) {
  const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(adresse)}&fuzzy=true&kommunenummer=0301`;
  
  console.log(`Søker etter: ${adresse}`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.adresser && data.adresser.length > 0) {
      const forsteAdresse = data.adresser[0];
      console.log("\n✅ Adresse funnet:");
      console.log(`- Adressetekst: ${forsteAdresse.adressetekst}`);
      console.log(`- Kommune: ${forsteAdresse.kommunenavn} (${forsteAdresse.kommunenummer})`);
      console.log(`- Gnr: ${forsteAdresse.gardsnummer}`);
      console.log(`- Bnr: ${forsteAdresse.bruksnummer}`);
      console.log(`- Matrikkelenhet: ${forsteAdresse.kommunenummer}-${forsteAdresse.gardsnummer}/${forsteAdresse.bruksnummer}`);
      
      return {
        kommunenummer: forsteAdresse.kommunenummer,
        gardsnummer: forsteAdresse.gardsnummer,
        bruksnummer: forsteAdresse.bruksnummer,
        adressetekst: forsteAdresse.adressetekst
      };
    } else {
      console.log("❌ Ingen adresse funnet");
      return null;
    }
  } catch (error) {
    console.error("Feil ved adressesøk:", error);
    return null;
  }
}

// Steg 2: Prøv å finne teigid fra gnr/bnr
// Oslo kommune bruker ofte formatet: kommunenr + gnr (4 siffer) + bnr (4 siffer)
function lagTeigid(kommunenummer, gnr, bnr) {
  // Dette er en gjetning på formatet - kan variere
  const kommuneKode = kommunenummer.slice(-2); // Siste 2 siffer av kommunenummer
  const gnrPadded = String(gnr).padStart(4, '0');
  const bnrPadded = String(bnr).padStart(4, '0');
  
  // Prøv forskjellige formater
  const muligeTeigider = [
    `${kommuneKode}${gnrPadded}${bnrPadded}`,
    `${kommunenummer}${gnrPadded}${bnrPadded}`,
    `${gnr}${bnr}`,
    `0301${gnrPadded}${bnrPadded}`, // Oslo = 0301
    `301${gnrPadded}${bnrPadded}`,   // Uten ledende 0
    `3${gnrPadded}${bnrPadded}`      // Bare 3 for Oslo
  ];
  
  return muligeTeigider;
}

// Steg 3: Sjekk gul liste
async function sjekkGulListe(teigid) {
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&` +
    `tabell=kart.gulliste_spatial&` +
    `service=WFS&` +
    `version=1.1.0&` +
    `request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&` +
    `teigid=${teigid}`;

  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      // Parse ut informasjon
      const navn = xml.match(/<ms:NAVN>([^<]*)<\/ms:NAVN>/)?.[1];
      const type = xml.match(/<ms:TYPE>([^<]*)<\/ms:TYPE>/)?.[1];
      const kategori = xml.match(/<ms:KATEGORI>([^<]*)<\/ms:KATEGORI>/)?.[1];
      const vern = xml.match(/<ms:VERN>([^<]*)<\/ms:VERN>/)?.[1];
      
      return {
        paaGulListe: true,
        navn,
        type,
        kategori,
        vern
      };
    }
    
    return { paaGulListe: false };
  } catch (error) {
    return { paaGulListe: false, error: error.message };
  }
}

// Test med alternativ metode - WFS GetFeature med BBOX
async function sokMedBbox(lat, lon) {
  // Konverter til UTM32
  const utm_x = Math.round(263000 + (lon - 10.75) * 111320 * Math.cos(lat * Math.PI / 180));
  const utm_y = Math.round(6649000 + (lat - 59.91) * 111320);
  
  // Liten boks rundt punktet
  const bbox = `${utm_x-50},${utm_y-50},${utm_x+50},${utm_y+50}`;
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=GULLISTE&` +
    `service=WFS&` +
    `version=1.1.0&` +
    `request=GetFeature&` +
    `typeName=Gul_liste&` +
    `bbox=${bbox}&` +
    `srsName=EPSG:32632`;
    
  console.log(`\nPrøver WFS med BBOX: ${bbox}`);
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    console.log("Response:", text.substring(0, 300));
  } catch (error) {
    console.log("Feil:", error.message);
  }
}

// Hovedfunksjon
async function testLyseveien3() {
  console.log("=== TESTER LYSEVEIEN 3 ===\n");
  
  // Søk etter adressen - prøv forskjellige varianter
  let adresseInfo = await sokAdresse("Lyseveien 3, Oslo");
  
  if (!adresseInfo) {
    console.log("\nPrøver uten kommune...");
    adresseInfo = await sokAdresse("Lyseveien 3");
  }
  
  if (!adresseInfo) {
    console.log("\nPrøver kun veinavn...");
    const alleAdresser = await sokAdresse("Lyseveien");
    if (alleAdresser) {
      console.log("(Fant Lyseveien, men ikke spesifikt nummer 3)");
    }
  }
  
  if (adresseInfo) {
    console.log("\n--- Prøver å finne teigid ---");
    const muligeTeigider = lagTeigid(
      adresseInfo.kommunenummer,
      adresseInfo.gardsnummer,
      adresseInfo.bruksnummer
    );
    
    console.log("Mulige teigid-formater:");
    muligeTeigider.forEach(id => console.log(`- ${id}`));
    
    // Test hver mulig teigid
    console.log("\n--- Sjekker gul liste ---");
    let funnet = false;
    
    for (const teigid of muligeTeigider) {
      console.log(`\nPrøver teigid: ${teigid}`);
      const resultat = await sjekkGulListe(teigid);
      
      if (resultat.paaGulListe) {
        console.log("✅ FUNNET PÅ GUL LISTE!");
        console.log(`- Navn: ${resultat.navn}`);
        console.log(`- Type: ${resultat.type}`);
        console.log(`- Kategori: ${resultat.kategori}`);
        console.log(`- Vernestatus: ${resultat.vern}`);
        funnet = true;
        break;
      } else if (!resultat.error) {
        console.log("- Ikke på gul liste med dette teigid");
      }
    }
    
    if (!funnet) {
      console.log("\n❌ Bygningen ble ikke funnet på gul liste");
      console.log("(Dette kan skyldes feil teigid-format)");
    }
  }
  
  // Test også med koordinater hvis vi har dem
  console.log("\n--- Alternativ metode med koordinater ---");
  // Lyseveien 3 ca koordinater (må sjekkes)
  await sokMedBbox(59.927, 10.685);
}

// Kjør test
testLyseveien3();
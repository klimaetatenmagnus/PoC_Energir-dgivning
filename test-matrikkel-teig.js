// Test av Matrikkel/Geonorge API for å finne teignummer

async function finnTeigFraAdresse(adresse) {
  console.log(`\nSøker etter teig for adresse: ${adresse}`);
  
  // 1. Først finn koordinater fra adresse via Kartverkets adressesøk
  const adresseUrl = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(adresse)}&treffPerSide=1`;
  
  try {
    const adresseResponse = await fetch(adresseUrl);
    const adresseData = await adresseResponse.json();
    
    if (adresseData.adresser && adresseData.adresser.length > 0) {
      const forsteAdresse = adresseData.adresser[0];
      const lat = forsteAdresse.representasjonspunkt.lat;
      const lon = forsteAdresse.representasjonspunkt.lon;
      
      console.log(`Fant adresse: ${forsteAdresse.adressetekst}`);
      console.log(`Koordinater: ${lat}, ${lon}`);
      console.log(`Kommune: ${forsteAdresse.kommunenavn} (${forsteAdresse.kommunenummer})`);
      
      // 2. Bruk koordinatene til å finne teig via WFS
      return await finnTeigFraKoordinater(lon, lat);
    }
  } catch (error) {
    console.error("Feil ved adressesøk:", error);
  }
  
  return null;
}

async function finnTeigFraKoordinater(lon, lat) {
  console.log(`\nSøker etter teig for koordinater: ${lon}, ${lat}`);
  
  // Oslo kommune's WFS for eiendomsteig
  const wfsUrl = "https://kart.oslo.kommune.no/wfs/wfs";
  
  // Konverter til UTM33 (EPSG:25833) som Oslo bruker
  // Dette er en grov konvertering - i produksjon bør du bruke et bibliotek
  const utmX = lon * 111320 * Math.cos(lat * Math.PI / 180) + 500000;
  const utmY = lat * 111320;
  
  // Lag en bounding box rundt punktet (ca 10 meter radius)
  const buffer = 10;
  const bbox = `${utmX - buffer},${utmY - buffer},${utmX + buffer},${utmY + buffer}`;
  
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: 'od_eiendom_teig',
    bbox: bbox,
    srsName: 'EPSG:25833',
    outputFormat: 'json'
  });
  
  try {
    const response = await fetch(`${wfsUrl}?${params.toString()}`);
    const text = await response.text();
    
    // Prøv å parse som JSON først
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Hvis det ikke er JSON, prøv å parse XML
      console.log("Respons er XML, parser...");
      
      // Finn teigid fra XML
      const teigidMatch = text.match(/<od:teigid>(\d+)<\/od:teigid>/);
      const matrikkelnrMatch = text.match(/<od:matrikkelnr>(\d+)<\/od:matrikkelnr>/);
      
      if (teigidMatch || matrikkelnrMatch) {
        console.log("\n✅ Fant teig fra XML!");
        if (teigidMatch) {
          console.log(`Teigid: ${teigidMatch[1]}`);
          return teigidMatch[1];
        }
        if (matrikkelnrMatch) {
          console.log(`Matrikkelnummer: ${matrikkelnrMatch[1]}`);
          return matrikkelnrMatch[1];
        }
      }
      
      return null;
    }
    
    if (data.features && data.features.length > 0) {
      const teig = data.features[0];
      console.log("\n✅ Fant teig!");
      console.log(`Matrikkelnummer: ${teig.properties.matrikkelnummer}`);
      console.log(`Kommune: ${teig.properties.kommunenummer}`);
      console.log(`Gårdsnummer: ${teig.properties.gardsnummer}`);
      console.log(`Bruksnummer: ${teig.properties.bruksnummer}`);
      
      // Generer teigid for Oslo kommune (hvis det er Oslo)
      if (teig.properties.kommunenummer === '0301') {
        // Oslo bruker formatet: kommunenr + gardsnr + bruksnr + festenr + seksjonsnr
        const teigid = `${teig.properties.kommunenummer}${teig.properties.gardsnummer.padStart(5, '0')}${teig.properties.bruksnummer.padStart(4, '0')}`;
        console.log(`\nGenerert teigid for Oslo: ${teigid}`);
        return teigid;
      }
      
      return teig.properties;
    } else {
      console.log("❌ Ingen teig funnet på disse koordinatene");
    }
  } catch (error) {
    console.error("Feil ved WFS-spørring:", error);
  }
  
  return null;
}

async function sjekkGulListeMedAdresse(adresse) {
  console.log("\n" + "=".repeat(50));
  console.log("KOMPLETT TEST: Fra adresse til gul liste-status");
  console.log("=".repeat(50));
  
  // Finn teig fra adresse
  const teigInfo = await finnTeigFraAdresse(adresse);
  
  if (teigInfo) {
    // Hvis vi har teigid (for Oslo), sjekk gul liste
    if (typeof teigInfo === 'string') {
      console.log(`\n🔍 Sjekker gul liste for teigid: ${teigInfo}`);
      
      const gulListeUrl = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms?" +
        "map=EIENDOM_TABELL&" +
        "tabell=kart.gulliste_spatial&" +
        "service=WFS&version=1.1.0&" +
        "request=GetFeature&" +
        "typeName=eiendom_polygon,eiendom_linje&" +
        "teigid=" + teigInfo;
      
      try {
        const response = await fetch(gulListeUrl);
        const xml = await response.text();
        
        if (xml.includes("<gml:featureMember>")) {
          console.log("✅ BYGNINGEN ER PÅ GUL LISTE!");
        } else {
          console.log("❌ Bygningen er IKKE på gul liste");
        }
      } catch (error) {
        console.error("Feil ved gul liste-sjekk:", error);
      }
    }
  }
}

// Test
async function test() {
  console.log("=== TEST AV MATRIKKEL/TEIG OPPSLAG ===\n");
  
  // Test med noen Oslo-adresser
  const testAdresser = [
    "Stortingsgata 10, Oslo",
    "Karl Johans gate 1, Oslo",
    "Rådhusplassen 1, Oslo"
  ];
  
  for (const adresse of testAdresser) {
    await sjekkGulListeMedAdresse(adresse);
    console.log("\n");
  }
}

// Kjør test
test();
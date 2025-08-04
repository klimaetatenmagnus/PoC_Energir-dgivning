// Test av direkte matrikkel-oppslag

async function finnMatrikkelFraAdresse(adresse) {
  console.log(`\nSøker etter: ${adresse}`);
  
  // Først finn adresse-ID via Kartverket
  const sokeUrl = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(adresse)}&treffPerSide=1`;
  
  try {
    const response = await fetch(sokeUrl);
    const data = await response.json();
    
    if (data.adresser && data.adresser.length > 0) {
      const adresseInfo = data.adresser[0];
      console.log(`Fant: ${adresseInfo.adressetekst}`);
      console.log(`Adressekode: ${adresseInfo.adressekode}`);
      console.log(`Objtype: ${adresseInfo.objtype}`);
      
      // Hvis vi har adressekode, kan vi bruke den til å finne matrikkelinfo
      if (adresseInfo.adressekode) {
        // Hent detaljer om adressen
        const detaljerUrl = `https://ws.geonorge.no/adresser/v1/adresser/${adresseInfo.adressekode}`;
        const detaljerResponse = await fetch(detaljerUrl);
        const detaljer = await detaljerResponse.json();
        
        console.log("\nAdressedetaljer:");
        console.log(JSON.stringify(detaljer, null, 2));
        
        // Sjekk om vi har matrikkelinfo
        if (detaljer.bruksenhetsnummer) {
          console.log(`\nBruksenhetsnummer: ${detaljer.bruksenhetsnummer}`);
        }
        
        if (detaljer.matrikkelenhet) {
          console.log("\nMatrikkelenhet funnet!");
          console.log(`Matrikkelnummer: ${detaljer.matrikkelenhet.matrikkelnummer}`);
          console.log(`Kommune: ${detaljer.matrikkelenhet.kommunenummer}`);
          console.log(`Gårdsnummer: ${detaljer.matrikkelenhet.gardsnummer}`);
          console.log(`Bruksnummer: ${detaljer.matrikkelenhet.bruksnummer}`);
          
          // Generer teigid for Oslo
          if (detaljer.matrikkelenhet.kommunenummer === '0301') {
            const teigid = generateOsloTeigid(
              detaljer.matrikkelenhet.gardsnummer,
              detaljer.matrikkelenhet.bruksnummer,
              detaljer.matrikkelenhet.festenummer || '0',
              detaljer.matrikkelenhet.seksjonsnummer || '0'
            );
            console.log(`\n📍 Generert Oslo teigid: ${teigid}`);
            return teigid;
          }
        }
        
        // Alternativ: Prøv å finne via koordinater
        if (detaljer.representasjonspunkt) {
          console.log("\nPrøver koordinat-basert søk...");
          return await finnTeigViaKoordinater(
            detaljer.representasjonspunkt.lon,
            detaljer.representasjonspunkt.lat
          );
        }
      }
    }
  } catch (error) {
    console.error("Feil:", error);
  }
  
  return null;
}

function generateOsloTeigid(gard, bruk, feste = '0', seksjon = '0') {
  // Oslo format: 0301 + 5-sifret gård + 4-sifret bruk + 4-sifret feste + 4-sifret seksjon
  // Men ofte brukes kortere format: 0301 + gård + bruk
  const kort = `0301${gard.toString().padStart(5, '0')}${bruk.toString().padStart(4, '0')}`;
  const lang = `0301${gard.toString().padStart(5, '0')}${bruk.toString().padStart(4, '0')}${feste.toString().padStart(4, '0')}${seksjon.toString().padStart(4, '0')}`;
  
  console.log(`Kort format: ${kort}`);
  console.log(`Lang format: ${lang}`);
  
  return kort; // Prøv kort format først
}

async function finnTeigViaKoordinater(lon, lat) {
  // Bruk Oslo kommunes identify-tjeneste
  const identifyUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms`;
  
  const params = new URLSearchParams({
    map: 'EIENDOM_TABELL',
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: 'eiendom_polygon',
    query_layers: 'eiendom_polygon',
    info_format: 'text/plain',
    x: '50',
    y: '50',
    width: '101',
    height: '101',
    srs: 'EPSG:4326',
    bbox: `${lon-0.0001},${lat-0.0001},${lon+0.0001},${lat+0.0001}`
  });
  
  try {
    const response = await fetch(`${identifyUrl}?${params.toString()}`);
    const text = await response.text();
    console.log("\nIdentify response:");
    console.log(text);
    
    // Parse teigid fra response
    const teigidMatch = text.match(/teigid['":\s]+(\d+)/i);
    if (teigidMatch) {
      console.log(`Fant teigid: ${teigidMatch[1]}`);
      return teigidMatch[1];
    }
  } catch (error) {
    console.error("Identify-feil:", error);
  }
  
  return null;
}

// Test
async function test() {
  const testAdresser = [
    "Stortingsgata 10, Oslo",
    "Karl Johans gate 22, Oslo"
  ];
  
  for (const adresse of testAdresser) {
    console.log("\n" + "=".repeat(60));
    const teigid = await finnMatrikkelFraAdresse(adresse);
    
    if (teigid) {
      console.log("\n🔍 Sjekker gul liste...");
      
      const gulListeUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
        `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
        `service=WFS&version=1.1.0&request=GetFeature&` +
        `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
      
      try {
        const response = await fetch(gulListeUrl);
        const xml = await response.text();
        
        if (xml.includes("<gml:featureMember>")) {
          console.log("✅ PÅ GUL LISTE!");
        } else {
          console.log("❌ Ikke på gul liste");
        }
      } catch (error) {
        console.error("Gul liste-feil:", error);
      }
    }
  }
}

test();
/**
 * Test av Gul Liste Service
 * 
 * Kjør med: node test-gul-liste-service.js
 */

// Siden vi ikke har TypeScript runtime, simulerer vi service-funksjonene her

async function finnTeigidFraGnrBnr(gnr, bnr) {
  try {
    const url = 'https://od2.pbe.oslo.kommune.no/cgi-bin/wms';
    const params = new URLSearchParams({
      map: 'WFS_SOK',
      VERSION: '1.1.0',
      SERVICE: 'WFS',
      REQUEST: 'GetFeature',
      TYPENAME: 'EIENDOM_WFS',
      Filter: `<Filter><And>` +
        `<PropertyIsEqualTo><PropertyName>GARDSNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>` +
        `<PropertyIsEqualTo><PropertyName>BRUKSNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>` +
        `</And></Filter>`
    });

    const response = await fetch(`${url}?${params}`);
    const xml = await response.text();

    const teigidMatch = xml.match(/<ms:ID>(\d+)<\/ms:ID>/i);
    if (teigidMatch) {
      return teigidMatch[1];
    }

    return null;
  } catch (error) {
    console.error('Feil ved henting av teigid:', error);
    return null;
  }
}

async function sjekkGulListeForTeigid(teigid) {
  try {
    const url = 'https://od2.pbe.oslo.kommune.no/cgi-bin/wms';
    const params = new URLSearchParams({
      map: 'EIENDOM_TABELL',
      tabell: 'kart.gulliste_spatial',
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'eiendom_polygon,eiendom_linje',
      teigid: teigid
    });

    const response = await fetch(`${url}?${params}`);
    const xml = await response.text();

    if (xml.includes('<gml:featureMember>')) {
      const navnMatch = xml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/);
      const kategoriMatch = xml.match(/<ms:KATEGORI>(.*?)<\/ms:KATEGORI>/);
      const vernMatch = xml.match(/<ms:VERN>(.*?)<\/ms:VERN>/);

      return {
        erPaaGulListe: true,
        teigid: teigid,
        navn: navnMatch ? navnMatch[1] : undefined,
        kategori: kategoriMatch ? kategoriMatch[1] : undefined,
        vernestatus: vernMatch ? vernMatch[1] : undefined
      };
    }

    return {
      erPaaGulListe: false,
      teigid: teigid
    };
  } catch (error) {
    console.error('Feil ved sjekk av gul liste:', error);
    return {
      erPaaGulListe: false,
      error: 'Kunne ikke sjekke gul liste-status'
    };
  }
}

async function hentMatrikkelDataFraAdresse(adresse) {
  try {
    const url = 'https://ws.geonorge.no/adresser/v1/sok';
    const params = new URLSearchParams({
      sok: adresse,
      kommunenummer: '0301',
      fuzzy: 'true',
      treffPerSide: '1'
    });

    const response = await fetch(`${url}?${params}`);
    const data = await response.json();
    
    if (data.adresser && data.adresser.length > 0) {
      const adresseData = data.adresser[0];
      
      // Sjekk om vi har direkte matrikkelinfo
      if (adresseData.gardsnummer && adresseData.bruksnummer) {
        return {
          kommunenummer: adresseData.kommunenummer,
          gardsnummer: adresseData.gardsnummer,
          bruksnummer: adresseData.bruksnummer,
          adressetekst: adresseData.adressetekst
        };
      }
      
      // Hvis ikke, må vi hente via adressekode
      if (adresseData.adressekode) {
        console.log(`Henter detaljer for adressekode: ${adresseData.adressekode}`);
        // Dette krever ekstra API-kall som ikke alltid returnerer matrikkelinfo
        return {
          adressetekst: adresseData.adressetekst,
          error: 'Matrikkelinfo ikke direkte tilgjengelig'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Feil ved henting av matrikkeldata:', error);
    return null;
  }
}

async function sjekkGulListe(adresse) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Sjekker gul liste for: ${adresse}`);
    console.log('='.repeat(60));
    
    // Steg 1: Hent GNR/BNR fra adresse
    console.log('\n1. Henter matrikkeldata...');
    const matrikkelData = await hentMatrikkelDataFraAdresse(adresse);
    
    if (!matrikkelData || !matrikkelData.gardsnummer) {
      console.log('❌ Kunne ikke finne matrikkeldata for adressen');
      console.log('Tips: Prøv en mer spesifikk adresse');
      return {
        erPaaGulListe: false,
        error: 'Kunne ikke finne matrikkeldata',
        adresse: adresse
      };
    }
    
    console.log(`✅ Fant adresse: ${matrikkelData.adressetekst}`);
    console.log(`   GNR: ${matrikkelData.gardsnummer}, BNR: ${matrikkelData.bruksnummer}`);
    
    // Steg 2: Finn teigid
    console.log('\n2. Finner teigid...');
    const teigid = await finnTeigidFraGnrBnr(
      matrikkelData.gardsnummer,
      matrikkelData.bruksnummer
    );
    
    if (!teigid) {
      console.log('❌ Kunne ikke finne teigid');
      return {
        erPaaGulListe: false,
        gnr: matrikkelData.gardsnummer,
        bnr: matrikkelData.bruksnummer,
        error: 'Kunne ikke finne teigid'
      };
    }
    
    console.log(`✅ Fant teigid: ${teigid}`);
    
    // Steg 3: Sjekk gul liste
    console.log('\n3. Sjekker gul liste-status...');
    const gulListeResultat = await sjekkGulListeForTeigid(teigid);
    
    if (gulListeResultat.erPaaGulListe) {
      console.log('✅ EIENDOMMEN ER PÅ GUL LISTE!');
      if (gulListeResultat.navn) {
        console.log(`   Navn: ${gulListeResultat.navn}`);
      }
      if (gulListeResultat.kategori) {
        console.log(`   Kategori: ${gulListeResultat.kategori}`);
      }
      if (gulListeResultat.vernestatus) {
        console.log(`   Vernestatus: ${gulListeResultat.vernestatus}`);
      }
    } else {
      console.log('❌ Eiendommen er IKKE på gul liste');
    }
    
    return {
      ...gulListeResultat,
      gnr: matrikkelData.gardsnummer,
      bnr: matrikkelData.bruksnummer,
      adresse: matrikkelData.adressetekst
    };
    
  } catch (error) {
    console.error('Feil i gul liste-sjekk:', error);
    return {
      erPaaGulListe: false,
      error: 'En uventet feil oppstod',
      adresse: adresse
    };
  }
}

// Test med kjente adresser
async function kjorTester() {
  console.log('=== TEST AV GUL LISTE SERVICE ===\n');
  
  const testAdresser = [
    'Thereses gate 3, Oslo',      // GNR 216, BNR 215 - På gul liste
    'Thereses gate 44, Oslo',      // GNR 217, BNR 375 - På gul liste
    'Schweigaards gate 21, Oslo',  // Test-adresse
    'Karl Johans gate 1, Oslo',    // Sentrum-adresse
  ];
  
  for (const adresse of testAdresser) {
    await sjekkGulListe(adresse);
    console.log('\n');
  }
  
  // Test også direkte med GNR/BNR
  console.log('\n' + '='.repeat(60));
  console.log('TEST MED DIREKTE GNR/BNR');
  console.log('='.repeat(60));
  
  const testGnrBnr = [
    { gnr: 216, bnr: 215, info: 'Thereses gate 3' },
    { gnr: 28, bnr: 138, info: 'Test fra tidligere' },
    { gnr: 28, bnr: 1195, info: 'Hoffsjef Løvenskiolds vei' }
  ];
  
  for (const test of testGnrBnr) {
    console.log(`\nTester GNR ${test.gnr}, BNR ${test.bnr} (${test.info})`);
    
    const teigid = await finnTeigidFraGnrBnr(test.gnr, test.bnr);
    if (teigid) {
      console.log(`Teigid: ${teigid}`);
      const gulListe = await sjekkGulListeForTeigid(teigid);
      if (gulListe.erPaaGulListe) {
        console.log(`✅ På gul liste: ${gulListe.navn || 'Ingen navn'}`);
      } else {
        console.log('❌ Ikke på gul liste');
      }
    } else {
      console.log('❌ Ingen teigid funnet');
    }
  }
}

// Kjør testene
kjorTester().catch(console.error);
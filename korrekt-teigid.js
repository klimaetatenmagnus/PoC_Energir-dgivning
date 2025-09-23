// KORREKT generering av Oslo teigid fra gårds- og bruksnummer

const infoLog = (...args) => console.warn('[korrekt-teigid]', ...args);
const successLog = (...args) => console.warn('[korrekt-teigid:success]', ...args);
const errorLog = (...args) => console.error('[korrekt-teigid:error]', ...args);

function genererOsloTeigid(gardsnummer, bruksnummer, festenummer = 0) {
  // Oslo bruker 9-sifret format: GGG-BBBB-FF
  // GGG = 3 siffer gårdsnummer
  // BBBB = 4 siffer bruksnummer  
  // FF = 2 siffer festenummer (vanligvis 00)
  
  const gard = String(gardsnummer).padStart(3, '0');
  const bruk = String(bruksnummer).padStart(4, '0');
  const feste = String(festenummer).padStart(2, '0');
  
  return gard + bruk + feste;
}

async function sjekkGulListe(gardsnummer, bruksnummer, festenummer = 0) {
  const teigid = genererOsloTeigid(gardsnummer, bruksnummer, festenummer);
  
  infoLog(`\nSjekker: Gård ${gardsnummer}, Bruk ${bruksnummer}, Feste ${festenummer}`);
  infoLog(`Generert teigid: ${teigid}`);
  
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      successLog('✅ PÅ GUL LISTE!');
      return true;
    } else {
      infoLog('❌ Ikke på gul liste');
      return false;
    }
  } catch (error) {
    errorLog('Feil ved henting av gul liste', error);
    return null;
  }
}

// Test med korrekt format
async function test() {
  infoLog('=== KORREKT TEIGID GENERERING ===');
  
  // Test med kjent eksempel: 291199441 = gård 291, bruk 1994, feste 41
  await sjekkGulListe(291, 1994, 41);
  
  // Eller hvis det er gård 291, bruk 199, feste 441 (overflow til 3 siffer)
  // Men siden feste normalt er 2 siffer, prøv andre tolkninger
  
  infoLog("\n" + "=".repeat(50));
  infoLog('Andre mulige tolkninger av 291199441:');
  
  // Test forskjellige kombinasjoner
  const tolkninger = [
    { gnr: 291, bnr: 1994, fnr: 41 },
    { gnr: 29, bnr: 1199, fnr: 441 },  // Dette vil gi feil format
    { gnr: 2911, bnr: 994, fnr: 41 },  // Dette vil gi feil format
  ];
  
  for (const t of tolkninger) {
    await sjekkGulListe(t.gnr, t.bnr, t.fnr);
  }
  
  infoLog("\n" + "=".repeat(50));
  infoLog('INTEGRASJONSKODE FOR DERES APP:\n');
  infoLog(`
// Bruk denne funksjonen med deres eksisterende gnr/bnr data:

function genererTeigid(gnr, bnr, fnr = 0) {
  // Format: 3 siffer gård + 4 siffer bruk + 2 siffer feste
  return String(gnr).padStart(3, '0') + 
         String(bnr).padStart(4, '0') + 
         String(fnr).padStart(2, '0');
}

async function erPaaGulListe(gnr, bnr, fnr = 0) {
  const teigid = genererTeigid(gnr, bnr, fnr);
  
  const response = await fetch(
    \`https://od2.pbe.oslo.kommune.no/cgi-bin/wms?map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&service=WFS&version=1.1.0&request=GetFeature&typeName=eiendom_polygon,eiendom_linje&teigid=\${teigid}\`
  );
  
  const xml = await response.text();
  return xml.includes("<gml:featureMember>");
}

// Eksempel bruk:
const gulListe = await erPaaGulListe(291, 1994, 41);
console.log(gulListe ? "På gul liste!" : "Ikke på gul liste");
  `);
  
  infoLog('\n⚠️ VIKTIG: Hvis dere ikke har festenummer, bruk 0 eller prøv verdier 00-99');
}

test();

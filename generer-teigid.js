// Generer teigid fra gårds- og bruksnummer for Oslo

function genererOsloTeigid(gardsnummer, bruksnummer, festenummer = 0, seksjonsnummer = 0) {
  // Oslo kommune = 0301
  const kommunenr = "0301";
  
  // Formater tallene med leading zeros
  const gard = String(gardsnummer).padStart(5, '0');
  const bruk = String(bruksnummer).padStart(4, '0');
  const feste = String(festenummer).padStart(4, '0');
  const seksjon = String(seksjonsnummer).padStart(4, '0');
  
  // Standard format (uten feste/seksjon hvis de er 0)
  if (festenummer === 0 && seksjonsnummer === 0) {
    return kommunenr + gard + bruk;
  }
  
  // Full format med feste/seksjon
  return kommunenr + gard + bruk + feste + seksjon;
}

async function sjekkGulListeMedGnrBnr(gardsnummer, bruksnummer) {
  // Generer teigid
  const teigid = genererOsloTeigid(gardsnummer, bruksnummer);
  console.log(`\nGenerert teigid: ${teigid}`);
  console.log(`Fra: Gård ${gardsnummer}, Bruk ${bruksnummer}`);
  
  // Sjekk gul liste
  const gulListeUrl = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&teigid=${teigid}`;
  
  try {
    const response = await fetch(gulListeUrl);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Bygningen er på gul liste!");
      return { teigid, gulListe: true };
    } else {
      console.log("❌ Bygningen er IKKE på gul liste");
      return { teigid, gulListe: false };
    }
  } catch (error) {
    console.error("Feil ved gul liste-sjekk:", error);
    return { teigid, gulListe: null, error: error.message };
  }
}

// Test med eksempler
async function test() {
  console.log("=== TEST: GENERER TEIGID FRA GÅRDS/BRUKSNUMMER ===\n");
  
  // Eksempler på gårds- og bruksnummer
  const testCases = [
    { gard: 291, bruk: 199, beskrivelse: "Kjent gul liste-eiendom" },
    { gard: 234, bruk: 74, beskrivelse: "Test eiendom 1" },
    { gard: 208, bruk: 333, beskrivelse: "Test eiendom 2" },
    { gard: 209, bruk: 1, beskrivelse: "Test eiendom 3" }
  ];
  
  for (const test of testCases) {
    console.log("\n" + "=".repeat(50));
    console.log(`Test: ${test.beskrivelse}`);
    await sjekkGulListeMedGnrBnr(test.gard, test.bruk);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("\n📌 OPPSUMMERING:");
  console.log("Hvis dere har gårds- og bruksnummer, kan dere:");
  console.log("1. Generere teigid direkte med formelen ovenfor");
  console.log("2. Sjekke gul liste-status med det genererte teigid");
  console.log("3. Ingen ekstra API-kall til Kartverket er nødvendig!");
}

// Eksempel på hvordan dette kan integreres i deres app
function lagGulListeFunksjon() {
  return `
// Integrer i deres eksisterende kode:

async function sjekkGulListe(gardsnummer, bruksnummer) {
  // Generer teigid for Oslo
  const teigid = \`0301\${String(gardsnummer).padStart(5, '0')}\${String(bruksnummer).padStart(4, '0')}\`;
  
  // Sjekk mot gul liste API
  const url = \`https://od2.pbe.oslo.kommune.no/cgi-bin/wms?map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&service=WFS&version=1.1.0&request=GetFeature&typeName=eiendom_polygon,eiendom_linje&teigid=\${teigid}\`;
  
  const response = await fetch(url);
  const xml = await response.text();
  
  return xml.includes("<gml:featureMember>");
}

// Bruk med deres eksisterende data:
const erPaaGulListe = await sjekkGulListe(gnr, bnr);
`;
}

// Kjør test
test().then(() => {
  console.log("\n" + "=".repeat(50));
  console.log("INTEGRASJONSKODE:");
  console.log(lagGulListeFunksjon());
});
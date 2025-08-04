/**
 * FUNGERENDE API FOR Å SJEKKE GUL LISTE I OSLO KOMMUNE
 * 
 * API URL: https://od2.pbe.oslo.kommune.no/cgi-bin/wms
 * Tabell: kart.gulliste_spatial
 * 
 * VIKTIG: Du trenger teigid (eiendoms-ID) for å gjøre oppslag
 */

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
    
    // Sjekk om bygningen er på gul liste
    const erPaaGulListe = xml.includes("<gml:featureMember>");
    
    if (erPaaGulListe) {
      // Parse ut informasjon om bygningen
      const info = {};
      
      // Finn alle properties
      const properties = [
        'NAVN', 'TYPE', 'KATEGORI', 'VERN', 'VERNKODE', 
        'GL_ID', 'DBID', 'REGAV', 'MAPPING'
      ];
      
      properties.forEach(prop => {
        const match = xml.match(new RegExp(`<ms:${prop}>([^<]*)</ms:${prop}>`));
        if (match) {
          info[prop] = match[1];
        }
      });
      
      return {
        paaGulListe: true,
        info: info
      };
    } else {
      return {
        paaGulListe: false,
        info: null
      };
    }
  } catch (error) {
    console.error('Feil ved API-kall:', error);
    return {
      paaGulListe: false,
      info: null,
      error: error.message
    };
  }
}

// Eksempel på bruk:
async function eksempel() {
  // Test med kjent teigid som er på gul liste
  const resultat = await sjekkGulListe("291199441");
  
  if (resultat.paaGulListe) {
    console.log("✅ Bygningen er på gul liste!");
    console.log("Navn:", resultat.info.NAVN);
    console.log("Type:", resultat.info.TYPE);
    console.log("Kategori:", resultat.info.KATEGORI);
    console.log("Vernestatus:", resultat.info.VERN);
    console.log("Registrert av:", resultat.info.REGAV);
  } else {
    console.log("❌ Bygningen er ikke på gul liste");
  }
}

// For å finne teigid fra koordinater eller adresse, må du enten:
// 1. Bruke et annet API (f.eks. matrikkelen)
// 2. Parse teigid fra kartets klikk-events
// 3. La brukeren oppgi teigid direkte

eksempel();
async function sjekkGulListeWFS(teigid) {
  const baseUrl = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
  
  const params = new URLSearchParams({
    map: "EIENDOM_TABELL",
    tabell: "kart.gulliste_spatial",
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: "eiendom_polygon,eiendom_linje",
    teigid: teigid
  });
  
  const url = `${baseUrl}?${params.toString()}`;
  console.log(`Sjekker teigid ${teigid}...`);
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    if (response.ok) {
      // Parse XML respons
      const featureCount = (text.match(/<gml:featureMember>/g) || []).length;
      
      if (featureCount > 0) {
        console.log("✅ Bygningen er på gul liste!");
        
        // Prøv å finne mer info fra XML
        const properties = text.match(/<ms:eiendom_polygon[^>]*>([\s\S]*?)<\/ms:eiendom_polygon>/);
        if (properties) {
          console.log("\nEgenskaper funnet i data:");
          // Finn alle properties
          const propMatches = properties[1].match(/<ms:([^>]+)>([^<]*)<\/ms:\1>/g) || [];
          propMatches.forEach(prop => {
            const match = prop.match(/<ms:([^>]+)>([^<]*)<\/ms:\1>/);
            if (match) {
              console.log(`- ${match[1]}: ${match[2]}`);
            }
          });
        }
        
        return true;
      } else {
        console.log("❌ Bygningen er IKKE på gul liste");
        return false;
      }
    } else {
      console.log("Feil ved API-kall:", response.status);
      return null;
    }
  } catch (error) {
    console.error("Feil:", error);
    return null;
  }
}

// Funksjon for å finne teigid basert på adresse eller koordinater
async function finnTeigid(sokeTekst) {
  // Dette er en placeholder - i virkeligheten må du enten:
  // 1. Bruke et annet API for å finne teigid fra adresse
  // 2. Hente teigid fra kartet når bruker klikker
  // 3. Ha en database med adresser og teigid
  
  console.log(`Søker etter teigid for: ${sokeTekst}`);
  console.log("(I en real implementasjon ville dette søkt i et adresseregister)");
  return null;
}

// Test funksjonen
async function test() {
  console.log("=== TEST AV GUL LISTE API ===\n");
  
  // Test med eksempel teigid
  await sjekkGulListeWFS("291199441");
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test med noen andre teigid (du må finne disse fra kartet)
  const testTeigider = [
    "291199441",  // Fra ditt eksempel
    "234074127",  // Tilfeldig test
    "234010402"   // Tilfeldig test
  ];
  
  for (const teigid of testTeigider) {
    await sjekkGulListeWFS(teigid);
    console.log();
  }
  
  // Vis hvordan man kan bruke dette i praksis
  console.log("\n=== EKSEMPEL PÅ BRUK ===");
  console.log(`
// For å sjekke om en bygning er på gul liste:

async function erBygningPaaGulListe(teigid) {
  const url = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms?" +
    "map=EIENDOM_TABELL&" +
    "tabell=kart.gulliste_spatial&" +
    "service=WFS&version=1.1.0&" +
    "request=GetFeature&" +
    "typeName=eiendom_polygon,eiendom_linje&" +
    "teigid=" + teigid;
    
  const response = await fetch(url);
  const xml = await response.text();
  
  // Sjekk om det finnes features
  return xml.includes("<gml:featureMember>");
}

// Bruk:
const paaGulListe = await erBygningPaaGulListe("291199441");
console.log(paaGulListe ? "På gul liste!" : "Ikke på gul liste");
  `);
}

test();
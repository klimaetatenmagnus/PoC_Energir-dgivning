// Analyser teigid-mønster basert på kjente eksempler

console.log("=== ANALYSE AV TEIGID-MØNSTER ===\n");

const eksempler = [
  { teigid: "291346046", gnr: 271, bnr: 375 },
  { teigid: "288999435", gnr: 28, bnr: 1113 }
];

console.log("Kjente eksempler:");
console.log("-".repeat(60));

for (const eks of eksempler) {
  console.log(`Teigid: ${eks.teigid}`);
  console.log(`GNR: ${eks.gnr}, BNR: ${eks.bnr}`);
  
  // Test om teigid inneholder GNR/BNR
  const gnrStr = String(eks.gnr);
  const bnrStr = String(eks.bnr);
  
  console.log(`\nSjekker om teigid inneholder GNR eller BNR:`);
  console.log(`  Inneholder "${gnrStr}" (GNR): ${eks.teigid.includes(gnrStr) ? "JA" : "NEI"}`);
  console.log(`  Inneholder "${bnrStr}" (BNR): ${eks.teigid.includes(bnrStr) ? "JA" : "NEI"}`);
  
  // Test standard formater
  console.log(`\nTest av standard matrikkel-formater:`);
  const format1 = String(eks.gnr).padStart(3, '0') + String(eks.bnr).padStart(4, '0') + '00';
  const format2 = String(eks.gnr).padStart(4, '0') + String(eks.bnr).padStart(4, '0');
  const format3 = String(eks.gnr) + String(eks.bnr);
  
  console.log(`  GNR(3)+BNR(4)+00: ${format1} - Match: ${eks.teigid === format1 ? "✅" : "❌"}`);
  console.log(`  GNR(4)+BNR(4): ${format2} - Match: ${eks.teigid === format2 ? "✅" : "❌"}`);
  console.log(`  GNR+BNR: ${format3} - Match: ${eks.teigid === format3 ? "✅" : "❌"}`);
  
  console.log("\n" + "-".repeat(60) + "\n");
}

console.log("=".repeat(60));
console.log("KONKLUSJON:");
console.log("=".repeat(60));

console.log(`
Basert på eksemplene:
1. Teigid 291346046 (GNR 271, BNR 375)
2. Teigid 288999435 (GNR 28, BNR 1113)

OBSERVASJONER:
- Teigid ser IKKE ut til å være basert på GNR/BNR
- Begge teigid er 9-sifrede tall
- Teigid starter med 29 eller 28 (som tilfeldigvis er like GNR 28, men ikke GNR 271!)
- Dette er sannsynligvis et helt separat ID-system

MULIGE FORKLARINGER:
1. Teigid er en sekvensiell ID som ikke har noe med matrikkel å gjøre
2. Teigid kan være en intern Oslo kommune ID
3. Teigid kan være basert på geografiske koordinater eller andre faktorer

VIKTIG: 
For å finne teigid fra GNR/BNR trenger du sannsynligvis:
- Et oppslags-API eller database som mapper GNR/BNR til teigid
- Eller bruke spatial queries med koordinater
- Eller ha en ferdig mapping-tabell
`);

// Test om de to teigid-ene faktisk finnes i gul liste
console.log("\n" + "=".repeat(60));
console.log("VERIFISERING - Sjekker om begge teigid er på gul liste:");
console.log("=".repeat(60) + "\n");

async function verifiserTeigid() {
  for (const eks of eksempler) {
    const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
      `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
      `service=WFS&version=1.1.0&request=GetFeature&` +
      `typeName=eiendom_polygon,eiendom_linje&teigid=${eks.teigid}`;
    
    console.log(`Sjekker teigid ${eks.teigid} (GNR ${eks.gnr}, BNR ${eks.bnr})...`);
    
    try {
      const response = await fetch(url);
      const xml = await response.text();
      
      if (xml.includes("<gml:featureMember>")) {
        console.log("✅ På gul liste!");
        
        // Hent navn/adresse
        const navnMatch = xml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/);
        if (navnMatch) {
          console.log(`   Navn: ${navnMatch[1]}`);
        }
      } else {
        console.log("❌ IKKE på gul liste");
      }
    } catch (error) {
      console.log("Feil: " + error.message);
    }
    console.log();
  }
}

verifiserTeigid();
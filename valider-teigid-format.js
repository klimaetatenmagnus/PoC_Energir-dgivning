/**
 * Validerer teigid-format ved å sammenligne kjent teigid med gnr/bnr
 */

// Kjent teigid som er på gul liste
const kjentTeigid = "291199441";

console.log("=== ANALYSERER TEIGID FORMAT ===\n");
console.log(`Kjent teigid på gul liste: ${kjentTeigid}`);
console.log(`Lengde: ${kjentTeigid.length} tegn`);

// Analyser formatet
if (kjentTeigid.length === 9) {
  console.log("\nMulig format (9 siffer):");
  console.log(`- Første 2-3 siffer: ${kjentTeigid.substring(0, 3)} (mulig kommunekode eller del av gnr)`);
  console.log(`- Neste 3-4 siffer: ${kjentTeigid.substring(3, 7)} (mulig gnr)`);
  console.log(`- Siste 2-3 siffer: ${kjentTeigid.substring(7)} (mulig bnr)`);
}

// Test Lyseveien 3 med flere formater
console.log("\n\n=== TESTER FLERE FORMATER FOR LYSEVEIEN 3 ===");
console.log("Gnr: 28, Bnr: 957");

const formater = [
  { format: "280957", beskrivelse: "gnr+bnr uten padding" },
  { format: "0280957", beskrivelse: "gnr(3)+bnr(4)" },
  { format: "00280957", beskrivelse: "gnr(4)+bnr(4)" },
  { format: "280000957", beskrivelse: "gnr+0000+bnr" },
  { format: "028000957", beskrivelse: "gnr(3)+000+bnr(3)" },
  { format: "280957000", beskrivelse: "gnr+bnr+000" },
  { format: "301280957", beskrivelse: "kommunekode(3)+gnr+bnr" },
  { format: "2800957", beskrivelse: "gnr+00+bnr" },
  { format: "28957", beskrivelse: "gnr+bnr minimal" }
];

async function testFormat(teigid, beskrivelse) {
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
      console.log(`✅ ${teigid} (${beskrivelse}) - FUNNET PÅ GUL LISTE!`);
      const navn = xml.match(/<ms:NAVN>([^<]*)<\/ms:NAVN>/)?.[1];
      if (navn) console.log(`   Navn: ${navn}`);
      return true;
    } else {
      console.log(`- ${teigid} (${beskrivelse}) - ikke på gul liste`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${teigid} - feil: ${error.message}`);
    return false;
  }
}

// Test alle formater
async function testAlleFormater() {
  for (const { format, beskrivelse } of formater) {
    await testFormat(format, beskrivelse);
  }
  
  // Test også om vi kan finne ut mer om det kjente teigid
  console.log("\n\n=== DOBBELTSJEKKER KJENT TEIGID ===");
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&` +
    `tabell=kart.gulliste_spatial&` +
    `service=WFS&` +
    `version=1.1.0&` +
    `request=GetFeature&` +
    `typeName=eiendom_polygon,eiendom_linje&` +
    `teigid=${kjentTeigid}`;
    
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    // Prøv å finne gnr/bnr i responsen
    console.log("\nSøker etter gnr/bnr info i XML...");
    const gnrMatch = xml.match(/[Gg][Nn][Rr][^>]*>([^<]+)</);
    const bnrMatch = xml.match(/[Bb][Nn][Rr][^>]*>([^<]+)</);
    
    if (gnrMatch) console.log(`Gnr funnet: ${gnrMatch[1]}`);
    if (bnrMatch) console.log(`Bnr funnet: ${bnrMatch[1]}`);
    
    // Vis alle properties
    const props = xml.match(/<ms:([^>]+)>([^<]*)<\/ms:\1>/g) || [];
    console.log("\nAlle properties:");
    props.forEach(prop => {
      const match = prop.match(/<ms:([^>]+)>([^<]*)<\/ms:\1>/);
      if (match && match[2]) {
        console.log(`- ${match[1]}: ${match[2]}`);
      }
    });
  } catch (error) {
    console.log("Feil:", error);
  }
}

testAlleFormater();
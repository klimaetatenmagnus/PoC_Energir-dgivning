#!/usr/bin/env tsx
// Test seksjonshåndtering - sammenlign Kapellveien 156C og 156B

import "dotenv/config";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

async function testSeksjoner() {
  console.log("🏠 Testing seksjonshåndtering for tomannsbolig\n");
  
  const adresser = [
    "Kapellveien 156C, 0493 Oslo",
    "Kapellveien 156B, 0493 Oslo"
  ];
  
  const resultater = [];
  
  for (const adresse of adresser) {
    console.log(`\n📍 Henter data for: ${adresse}`);
    console.log("=" .repeat(50));
    
    try {
      const data = await resolveBuildingData(adresse);
      
      const resultat = {
        adresse,
        gnr: data.gnr,
        bnr: data.bnr,
        snr: data.snr || "-",
        matrikkelenhetsId: data.matrikkelenhetsId,
        byggId: data.byggId,
        byggeaar: data.byggeaar,
        bruksarealM2: data.bruksarealM2,
        bygningstypeKode: data.bygningstypeKode,
        bygningstypeBeskrivelse: data.bygningstypeBeskrivelse,
        representasjonspunkt: data.representasjonspunkt ? 
          `${data.representasjonspunkt.x}, ${data.representasjonspunkt.y}` : "Mangler"
      };
      
      resultater.push(resultat);
      
      console.log(`✅ Matrikkelenhets-ID: ${resultat.matrikkelenhetsId}`);
      console.log(`✅ Bygnings-ID: ${resultat.byggId}`);
      console.log(`✅ GNR/BNR/SNR: ${resultat.gnr}/${resultat.bnr}/${resultat.snr}`);
      console.log(`✅ Byggeår: ${resultat.byggeaar}`);
      console.log(`✅ Bruksareal: ${resultat.bruksarealM2} m²`);
      console.log(`✅ Bygningstype: ${resultat.bygningstypeKode} - ${resultat.bygningstypeBeskrivelse}`);
      console.log(`✅ Koordinater: ${resultat.representasjonspunkt}`);
      
    } catch (error) {
      console.error(`❌ Feil: ${error}`);
      resultater.push({ adresse, feil: error.message });
    }
  }
  
  // Vis sammenligning
  console.log("\n\n📊 SAMMENLIGNING AV SEKSJONER:");
  console.log("=" .repeat(80));
  console.table(resultater);
  
  // Verifiser at vi får forskjellige data
  if (resultater.length === 2 && !resultater[0].feil && !resultater[1].feil) {
    console.log("\n🔍 Verifikasjon:");
    
    const harSammeGnrBnr = resultater[0].gnr === resultater[1].gnr && 
                           resultater[0].bnr === resultater[1].bnr;
    console.log(`- Samme GNR/BNR: ${harSammeGnrBnr ? '✅' : '❌'}`);
    
    const harForskjelligMatrikkelId = resultater[0].matrikkelenhetsId !== resultater[1].matrikkelenhetsId;
    console.log(`- Forskjellig matrikkelenhets-ID: ${harForskjelligMatrikkelId ? '✅' : '❌'}`);
    
    const harForskjelligByggId = resultater[0].byggId !== resultater[1].byggId;
    console.log(`- Forskjellig bygnings-ID: ${harForskjelligByggId ? '✅' : '❌'}`);
    
    const harForskjelligAreal = resultater[0].bruksarealM2 !== resultater[1].bruksarealM2;
    console.log(`- Forskjellig bruksareal: ${harForskjelligAreal ? '✅' : '❌'} (C: ${resultater[0].bruksarealM2} m², B: ${resultater[1].bruksarealM2} m²)`);
    
    const harForskjelligeKoordinater = resultater[0].representasjonspunkt !== resultater[1].representasjonspunkt;
    console.log(`- Forskjellige koordinater: ${harForskjelligeKoordinater ? '✅' : '❌'}`);
    
    if (harForskjelligMatrikkelId || harForskjelligByggId) {
      console.log("\n✅ Seksjonshåndtering fungerer korrekt - hver seksjon har egen data!");
    } else {
      console.log("\n❌ PROBLEM: Seksjonene returnerer samme data!");
    }
  }
}

testSeksjoner().catch(console.error);
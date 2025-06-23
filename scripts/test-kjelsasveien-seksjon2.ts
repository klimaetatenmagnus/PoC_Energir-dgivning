// scripts/test-kjelsasveien-seksjon2.ts
import "../loadEnv.ts";
import fetch from "node-fetch";

const ENOVA_API_KEY = process.env.ENOVA_API_KEY || "";

async function testKjelsasveienSeksjon2() {
  console.log("=== TEST KJELSÅSVEIEN 97B SEKSJON 2 ===\n");
  
  // Kjente verdier fra salgsannonsen
  const testData = {
    kommunenummer: "0301",
    gnr: 75,
    bnr: 284,
    seksjon: 2,
    forventetBRA: 95, // 92 + 3 m²
  };
  
  console.log("Test-data:");
  console.log(`  GNR/BNR: ${testData.gnr}/${testData.bnr}`);
  console.log(`  Seksjon: ${testData.seksjon}`);
  console.log(`  Forventet BRA: ${testData.forventetBRA} m²\n`);
  
  // Test Enova API med seksjonsnummer
  console.log("📋 Tester Enova API med seksjonsnummer...");
  
  try {
    const response = await fetch(
      "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Energitiltak/1.0",
          "x-api-key": ENOVA_API_KEY,
        },
        body: JSON.stringify({
          kommunenummer: testData.kommunenummer,
          gardsnummer: String(testData.gnr),
          bruksnummer: String(testData.bnr),
          bruksenhetnummer: "",
          seksjonsnummer: String(testData.seksjon),
        }),
      }
    );
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Antall attester funnet: ${data.length}`);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log("\n✅ ENERGIATTEST FUNNET!");
        
        for (const attest of data) {
          console.log("\nAttest detaljer:");
          console.log(`  Energikarakter: ${attest.energiattest?.energikarakter?.toUpperCase()}`);
          console.log(`  Oppvarmingskarakter: ${attest.energiattest?.oppvarmingskarakter}`);
          console.log(`  Utstedelsesdato: ${attest.energiattest?.utstedelsesdato}`);
          console.log(`  Attestnummer: ${attest.energiattest?.attestnummer}`);
          console.log(`  URL: ${attest.energiattest?.attestUrl}`);
          
          console.log("\nEnhet info:");
          console.log(`  Byggeår: ${attest.enhet?.bygg?.byggeår}`);
          console.log(`  Bruksareal: ${attest.enhet?.bruksareal} m²`);
          console.log(`  Bygningstype: ${attest.enhet?.bygg?.type}`);
          console.log(`  Bygningsnummer: ${attest.enhet?.bygg?.bygningsnummer}`);
          
          console.log("\nAdresse:");
          console.log(`  Gatenavn: ${attest.enhet?.adresse?.gatenavn}`);
          console.log(`  Poststed: ${attest.enhet?.adresse?.postnummer} ${attest.enhet?.adresse?.poststed}`);
          
          // Sjekk om bruksareal matcher forventet
          if (attest.enhet?.bruksareal) {
            const diff = Math.abs(attest.enhet.bruksareal - testData.forventetBRA);
            if (diff <= 5) {
              console.log(`\n✅ Bruksareal matcher forventet verdi (${attest.enhet.bruksareal} ≈ ${testData.forventetBRA})`);
            } else {
              console.log(`\n⚠️  Bruksareal avviker fra forventet (${attest.enhet.bruksareal} vs ${testData.forventetBRA})`);
            }
          }
        }
      } else {
        console.log("❌ Ingen energiattest funnet");
      }
    } else {
      console.log(`❌ API feil: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log("Response:", text);
    }
  } catch (error) {
    console.error("❌ Feil:", error.message);
  }
  
  // Test også uten seksjonsnummer for sammenligning
  console.log("\n\n=== Test uten seksjonsnummer (for sammenligning) ===");
  
  try {
    const response = await fetch(
      "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Energitiltak/1.0",
          "x-api-key": ENOVA_API_KEY,
        },
        body: JSON.stringify({
          kommunenummer: testData.kommunenummer,
          gardsnummer: String(testData.gnr),
          bruksnummer: String(testData.bnr),
          bruksenhetnummer: "",
          seksjonsnummer: "",
        }),
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Antall attester funnet uten seksjonsnummer: ${data.length}`);
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

testKjelsasveienSeksjon2().catch(console.error);
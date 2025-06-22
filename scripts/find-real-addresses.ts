// scripts/find-real-addresses.ts
// Finn faktiske adresser som eksisterer i Geonorge
import "../loadEnv.ts";
import fetch from "node-fetch";

console.log("🔍 Søker etter faktiske adresser som eksisterer...");

// Test noen helt vanlige adresser
const testAdresser = [
  "Bygdøy allé 1, Oslo",
  "Grensen 1, Oslo", 
  "Dronningens gate 1, Oslo",
  "Storgata 1, Oslo",
  "Oslo City",
  "Jernbanetorget, Oslo",
  "Oslo S",
  "Grünerløkka, Oslo",
  "Aker Brygge, Oslo"
];

async function testAdresse(adresse) {
  try {
    const url = "https://ws.geonorge.no/adresser/v1/sok?" + 
      new URLSearchParams({ sok: adresse, fuzzy: "true" })
        .toString()
        .replace(/\+/g, "%20");
    
    const response = await fetch(url, {
      headers: { "User-Agent": "Energitiltak/1.0" }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.adresser && data.adresser.length > 0) {
        console.log(`✅ "${adresse}" funnet!`);
        const adr = data.adresser[0];
        console.log(`   → ${adr.adressetekst || `${adr.adressenavn} ${adr.nummer || adr.husnummer}${adr.bokstav || ''}`}`);
        console.log(`   → Kommune ${adr.kommunenummer}, gnr=${adr.gardsnummer}, bnr=${adr.bruksnummer}`);
        return adr;
      }
    }
  } catch (e) {
    console.log(`❌ Feil for "${adresse}": ${e.message}`);
  }
  return null;
}

(async () => {
  console.log("Tester kjente steder i Oslo...\n");
  
  for (const adresse of testAdresser) {
    await testAdresse(adresse);
    console.log("");
  }
  
  // Test også en mer generell søk
  console.log("--- Generell søk etter 'Oslo' ---");
  await testAdresse("Oslo");
  
})();
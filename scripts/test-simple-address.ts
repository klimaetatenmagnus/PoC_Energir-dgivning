// scripts/test-simple-address.ts
// Test en enkel adressesøk mot testmiljøet for å se hvilke data vi får
import "../loadEnv.ts";
import fetch from "node-fetch";

console.log("🔍 Testing mot Geonorge for å finne reelle adresser...");

// Test noen kjente Oslo-adresser som definitivt eksisterer
const testAdresser = [
  "Karl Johans gate 1, 0154 Oslo",
  "Stortingsgata 1, 0161 Oslo", 
  "Akershus festning, 0150 Oslo",
  "Rådhuset Oslo, 0037 Oslo",
  "Universitetet i Oslo, 0313 Oslo"
];

(async () => {
  for (const adresse of testAdresser) {
    try {
      console.log(`\n--- Testing adresse: ${adresse} ---`);
      
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
          const adr = data.adresser[0];
          console.log(`✅ Funnet: Kommune ${adr.kommunenummer}, gnr=${adr.gardsnummer}, bnr=${adr.bruksnummer}`);
          console.log(`   Adressekode: ${adr.adressekode}`);
          console.log(`   Husnummer: ${adr.nummer || adr.husnummer}, Bokstav: ${adr.bokstav || 'ingen'}`);
        } else {
          console.log("❌ Ingen adresser funnet");
        }
      } else {
        console.log(`❌ HTTP feil: ${response.status}`);
      }
      
    } catch (e) {
      console.log(`❌ Feil: ${e.message}`);
    }
  }
  
  console.log("\n🔍 Disse kan vi så bruke til å teste mot testmiljøet...");
})();
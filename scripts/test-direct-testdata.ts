// scripts/test-direct-testdata.ts
// Test direkte mot testmiljøet uten building-info-service
import "../loadEnv.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../src/clients/BygningClient.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import fetch from "node-fetch";

const BASE_URL = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

console.log("🔍 Testing direkte mot testmiljøet...");

const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "test-script",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
  USERNAME,
  PASSWORD
);

const bygningClient = new BygningClient(
  matrikkelEndpoint(BASE_URL, "BygningService"),
  USERNAME,
  PASSWORD
);

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  PASSWORD
);

async function testAdresse(adresseSøk) {
  try {
    console.log(`\n--- Testing: ${adresseSøk} ---`);
    
    // 1) Geonorge
    const geoUrl = "https://ws.geonorge.no/adresser/v1/sok?" +
      new URLSearchParams({ sok: adresseSøk, fuzzy: "true" })
        .toString()
        .replace(/\+/g, "%20");
    
    const geoResponse = await fetch(geoUrl, {
      headers: { "User-Agent": "Energitiltak/1.0" }
    });
    
    if (!geoResponse.ok) {
      throw new Error(`Geonorge feil: ${geoResponse.status}`);
    }
    
    const geoData = await geoResponse.json();
    if (!geoData.adresser?.length) {
      throw new Error("Ingen adresser funnet i Geonorge");
    }
    
    const adr = geoData.adresser[0];
    console.log(`✅ Geonorge: Kommune ${adr.kommunenummer}, gnr=${adr.gardsnummer}, bnr=${adr.bruksnummer}`);
    
    // 2) Matrikkelenhet
    const matrikkelIds = await matrikkelClient.findMatrikkelenheter({
      kommunenummer: adr.kommunenummer,
      gnr: adr.gardsnummer,
      bnr: adr.bruksnummer,
      adressekode: adr.adressekode,
      husnummer: Number(adr.nummer ?? adr.husnummer ?? 0),
      bokstav: adr.bokstav ?? "",
    }, ctx());
    
    console.log(`✅ Matrikkelenheter funnet: ${matrikkelIds.length} (IDs: ${matrikkelIds.join(', ')})`);
    
    if (matrikkelIds.length === 0) {
      throw new Error("Ingen matrikkelenheter funnet");
    }
    
    // 3) Bygg for første matrikkelenhet
    const matrikkelenhetsId = matrikkelIds[0];
    const byggIds = await bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx());
    
    console.log(`✅ Bygg funnet: ${byggIds.length} (IDs: ${byggIds.join(', ')})`);
    
    if (byggIds.length === 0) {
      throw new Error("Ingen bygg funnet");
    }
    
    // 4) Hent byggdata
    for (let i = 0; i < Math.min(byggIds.length, 3); i++) { // Test maks 3 bygg
      const byggId = byggIds[i];
      try {
        const bygg = await storeClient.getObject(byggId);
        
        console.log(`📋 Bygg ${byggId}:`);
        console.log(`   Byggeår: ${bygg.byggeaar || 'null'}`);
        console.log(`   Bruksareal: ${bygg.bruksarealM2 || 'null'} m²`);
        console.log(`   Representasjonspunkt: ${bygg.representasjonspunkt ? 'JA' : 'NEI'}`);
        
        // Sjekk realisme
        if (bygg.byggeaar && bygg.byggeaar > 1800 && bygg.byggeaar < 2025) {
          console.log(`   🎉 REALISTISK BYGGEÅR!`);
        }
        
        if (bygg.bruksarealM2 && bygg.bruksarealM2 > 10 && bygg.bruksarealM2 < 10000) {
          console.log(`   🎉 REALISTISK BRUKSAREAL!`);
        }
        
      } catch (e) {
        console.log(`   ❌ Feil for bygg ${byggId}: ${e.message}`);
      }
    }
    
  } catch (e) {
    console.log(`❌ Feil: ${e.message}`);
  }
}

(async () => {
  // Test adressene vi fant
  await testAdresse("Jernbanetorget, Oslo");
  await testAdresse("Oslo S");
  await testAdresse("Oslo gate 1C");
  
  console.log("\n📋 KONKLUSJON om testdata:");
  console.log("Vi kan nå se om testmiljøet har realistiske verdier eller bare placeholder-data.");
})();
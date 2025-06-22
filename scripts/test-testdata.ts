// scripts/test-testdata.ts
// Utforsk testdata i testmiljøet
import "../loadEnv.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

const BASE_URL = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  PASSWORD
);

console.log("🔍 Utforsker testdata i testmiljøet...");

// Test forskjellige bygg-ID-er for å finne noen med realistiske verdier
const testIds = [
  // Noen vanlige ID-er fra testmiljøet
  510390946, // Fra samples/findByggForMatrikkelenhet.xml
  510390947,
  510390948,
  1000001,
  1000002,
  1000003,
  // Prøv Oslo-baserte ID-er
  80179071,
  80179072,
  80179073,
  80179074,
  80179075
];

(async () => {
  for (const id of testIds) {
    try {
      console.log(`\n--- Testing bygg ID: ${id} ---`);
      const bygg = await storeClient.getObject(id);
      
      console.log(`Byggeår: ${bygg.byggeaar || 'null'}`);
      console.log(`Bruksareal: ${bygg.bruksarealM2 || 'null'} m²`);
      console.log(`Representasjonspunkt: ${bygg.representasjonspunkt ? 'JA' : 'NEI'}`);
      
      if (bygg.byggeaar && bygg.byggeaar > 1800 && bygg.byggeaar < 2025) {
        console.log(`✅ REALISTISK BYGGEÅR funnet: ${bygg.byggeaar}`);
      }
      
      if (bygg.bruksarealM2 && bygg.bruksarealM2 > 10 && bygg.bruksarealM2 < 10000) {
        console.log(`✅ REALISTISK BRUKSAREAL funnet: ${bygg.bruksarealM2} m²`);
      }
      
    } catch (e) {
      console.log(`❌ Feil for ID ${id}: ${e.message}`);
    }
  }
})();
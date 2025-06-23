#!/usr/bin/env tsx
// Test kun Fallanveien 29 for debugging

import "dotenv/config";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../src/clients/BygningClient.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

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

const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "test-fallanveien",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

async function test() {
  console.log("🏢 Testing Fallanveien 29, 0495 Oslo");
  
  // 1. Finn matrikkelenhets-ID
  const ids = await matrikkelClient.findMatrikkelenheter({
    kommunenummer: "0301",
    gnr: 75,
    bnr: 812,
    adressekode: 11698,
    husnummer: 29,
    bokstav: ""
  }, ctx());
  
  console.log(`📍 Fant ${ids.length} matrikkelenhets-IDer:`, ids);
  
  if (ids.length === 0) {
    throw new Error("Ingen matrikkelenhets-ID funnet!");
  }
  
  // 2. Finn bygninger for matrikkelenheten
  const matrikkelenhetsId = ids[0];
  const byggIds = await bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx());
  
  console.log(`🏗️ Fant ${byggIds.length} bygnings-IDer for matrikkelenhet ${matrikkelenhetsId}`);
  
  // 3. Hent detaljer for hver bygning
  for (const byggId of byggIds.slice(0, 5)) { // Bare de første 5 for testing
    console.log(`\n📊 Henter data for bygg ${byggId}:`);
    const byggInfo = await storeClient.getObject(byggId);
    console.log({
      id: byggId,
      bruksarealM2: byggInfo.bruksarealM2,
      byggeaar: byggInfo.byggeaar,
      bygningstypeKodeId: byggInfo.bygningstypeKodeId,
      representasjonspunkt: byggInfo.representasjonspunkt ? "JA" : "NEI"
    });
  }
}

test().catch(console.error);
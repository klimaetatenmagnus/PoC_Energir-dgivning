#!/usr/bin/env tsx
// Test strategi for borettslag/sameier - hent alle boligbygg for gnr/bnr

import "dotenv/config";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../src/clients/BygningClient.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { shouldProcessBuildingType } from "../src/utils/buildingTypeUtils.ts";

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
  klientIdentifikasjon: "test-borettslag",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

async function testBorettslagStrategy() {
  console.log("🏢 Testing borettslag-strategi for Fallanveien 29 (0301-75/812)");
  
  // 1. Finn ALLE matrikkelenheter for gnr/bnr (uten adresse-filter)
  const alleIds = await matrikkelClient.findMatrikkelenheter({
    kommunenummer: "0301",
    gnr: 75,
    bnr: 812
  }, ctx());
  
  console.log(`\n📍 Fant ${alleIds.length} matrikkelenhets-IDer for 0301-75/812`);
  
  // 2. Samle alle unike bygg-IDer
  const alleByggIds = new Set<number>();
  
  for (const matrikkelId of alleIds) {
    const byggIds = await bygningClient.findByggForMatrikkelenhet(matrikkelId, ctx());
    byggIds.forEach(id => alleByggIds.add(id));
  }
  
  console.log(`\n🏗️ Fant totalt ${alleByggIds.size} unike bygninger på 0301-75/812`);
  
  // 3. Hent info om alle bygninger og filtrer til boligbygg
  const boligbygg = [];
  
  for (const byggId of Array.from(alleByggIds)) {
    try {
      const byggInfo = await storeClient.getObject(byggId);
      
      // Sjekk om det er boligbygg
      if (shouldProcessBuildingType(byggInfo.bygningstypeKodeId)) {
        boligbygg.push({
          id: byggId,
          bruksarealM2: byggInfo.bruksarealM2,
          byggeaar: byggInfo.byggeaar,
          bygningstypeKode: byggInfo.bygningstypeKode,
          bygningstypeKodeId: byggInfo.bygningstypeKodeId,
          bygningstypeBeskrivelse: byggInfo.bygningstypeBeskrivelse,
          representasjonspunkt: byggInfo.representasjonspunkt
        });
      }
    } catch (error) {
      console.error(`Feil ved henting av bygg ${byggId}:`, error);
    }
  }
  
  console.log(`\n🏠 Fant ${boligbygg.length} boligbygg på 0301-75/812:`);
  
  // Sorter etter bruksareal (størst først)
  boligbygg.sort((a, b) => (b.bruksarealM2 ?? 0) - (a.bruksarealM2 ?? 0));
  
  // Vis resultatene
  console.table(boligbygg.map(b => ({
    ID: b.id,
    "Areal (m²)": b.bruksarealM2,
    "Byggeår": b.byggeaar,
    "Type": `${b.bygningstypeKode} - ${b.bygningstypeBeskrivelse}`,
    "Koordinat": b.representasjonspunkt ? "Ja" : "Nei"
  })));
  
  // Sammendrag
  const totaltAreal = boligbygg.reduce((sum, b) => sum + (b.bruksarealM2 ?? 0), 0);
  console.log(`\n📊 Sammendrag for borettslaget:`);
  console.log(`- Antall boligbygg: ${boligbygg.length}`);
  console.log(`- Totalt bruksareal: ${totaltAreal} m²`);
  console.log(`- Gjennomsnittlig byggeår: ${Math.round(boligbygg.reduce((sum, b) => sum + (b.byggeaar ?? 0), 0) / boligbygg.length)}`);
}

testBorettslagStrategy().catch(console.error);
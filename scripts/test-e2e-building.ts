// scripts/test-e2e-building.ts
// -------------------------------------------------------------------
// e2e‐test: adresse → matrikkelenhet → bygg → store-boble
// Oppdatert juni 2025 for én-ID-flyten                         v2.0
// -------------------------------------------------------------------
import { strict as assert } from "assert";
import nock from "nock";
import { resolveBuildingData } from "../services/building-info-service/index.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

// Import environment
import "../loadEnv.ts";

// Test mot produksjonsmiljøet
const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  process.env.MATRIKKEL_PASSWORD!
);

/* ─── MOCKS (brukes bare når LIVE ikke er satt) ─── */
if (!process.env.LIVE) {
  nock.disableNetConnect();

  /* 1) Geonorge REST-adressesøk */
  nock("https://ws.geonorge.no")
    .get(/\/adresser\/v1\/sok/)
    .reply(
      200,
      {
        adresser: [
          {
            kommunenummer: "0301",
            adressekode: 12345,
            husnummer: "156",
            bokstav: "C",
            gardsnummer: 73,
            bruksnummer: 704,
          },
        ],
      },
      { "Content-Type": "application/json" }
    );

  /* 2) MatrikkelClient – findMatrikkelenheter */
  nock("https://prodtest.matrikkel.no")
    .post("/matrikkelapi/wsapi/v1/MatrikkelenhetServiceWS")
    .reply(
      200,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <ns:findMatrikkelenheterResponse xmlns:ns="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet">
            <ns:return>
              <item>999</item>
            </ns:return>
          </ns:findMatrikkelenheterResponse>
        </soap:Body></soap:Envelope>`
    );

  /* 3) BygningClient – bygg‐liste for matrikkelenhet 999 (flere bygg for seksjontest) */
  nock("https://prodtest.matrikkel.no")
    .post("/matrikkelapi/wsapi/v1/BygningServiceWS")
    .reply(
      200,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <findByggForMatrikkelenhetResponse xmlns="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning">
            <return>
              <item>80179071</item>
              <item>80179072</item>
              <item>80179073</item>
            </return>
          </findByggForMatrikkelenhetResponse>
        </soap:Body></soap:Envelope>`
    );

  /* 4) StoreClient – mock for alle StoreService kall */
  nock("https://prodtest.matrikkel.no")
    .persist()  // Gjenbruk for flere kall
    .post("/matrikkelapi/wsapi/v1/StoreServiceWS")
    .reply(
      200,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <getObjectResponse xmlns="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store">
            <return>
              <bruksarealM2>120</bruksarealM2>
              <byggeaar>1985</byggeaar>
              <representasjonspunkt>
                <aust>262000</aust><nord>6650000</nord>
              </representasjonspunkt>
            </return>
          </getObjectResponse>
        </soap:Body></soap:Envelope>`
    );

  /* 5) Enova Energiattest API */
  nock("https://api.data.enova.no")
    .post("/ems/offentlige-data/v1/Energiattest")
    .reply(200, []);
} else {
  console.log("🌐 LIVE – ekte HTTP-trafikk tillatt");
  nock.enableNetConnect();
}

/* ─── SELVE TESTEN ─── */
(async () => {
  console.log("=== TESTING PRODUKSJONSMILJØ ===");
  console.log("Base URL:", BASE_URL);
  console.log("Username:", USERNAME);
  
  // Test normal flyt mot produksjonsmiljø først for å få ekte bygg-ID
  console.log("\n=== Testing Kapellveien 156C (seksjon C) mot PRODUKSJONSMILJØ ===");
  let resultC = null;
  try {
    resultC = await resolveBuildingData("Kapellveien 156C, 0493 Oslo");
    console.log("SUCCESS! PRODUKSJON-resultat for seksjon C:", JSON.stringify(resultC, null, 2));
  } catch (e) {
    console.log("Feil ved normal flyt mot PRODUKSJON for seksjon C:", e.message);
    throw e; // Stop testen hvis grunnleggende flyt feiler
  }

  // Test seksjon B for sammenligning
  console.log("\n=== Testing Kapellveien 156B (seksjon B) for sammenligning ===");
  let resultB = null;
  try {
    resultB = await resolveBuildingData("Kapellveien 156B, 0493 Oslo");
    console.log("SUCCESS! PRODUKSJON-resultat for seksjon B:", JSON.stringify(resultB, null, 2));
  } catch (e) {
    console.log("Feil ved seksjon B:", e.message);
  }

  // Sammenlign seksjon B og C
  console.log("\n=== Sammenligning seksjon B vs C ===");
  if (resultB && resultC) {
    console.log("Seksjon B - matrikkelenhetsId:", resultB.matrikkelenhetsId);
    console.log("Seksjon C - matrikkelenhetsId:", resultC.matrikkelenhetsId);
    console.log("Seksjon B - byggId:", resultB.byggId);
    console.log("Seksjon C - byggId:", resultC.byggId);
    console.log("Er samme matrikkelenhet?", resultB.matrikkelenhetsId === resultC.matrikkelenhetsId);
    console.log("Er samme bygg?", resultB.byggId === resultC.byggId);
  }

  // Test direkte oppslag av ekte bygg-ID fra dataflyten for seksjon C
  console.log("\n=== Testing direkte bygg-ID oppslag for seksjon C ===");
  if (resultC && resultC.byggId) {
    try {
      const directBygg = await storeClient.getObject(resultC.byggId);
      console.log(`SUCCESS! Direkte bygg ${resultC.byggId} fra PRODUKSJON:`, JSON.stringify(directBygg, null, 2));
      
      // Sammenlign data fra begge kilder
      console.log("\n=== Datasammenligning for seksjon C ===");
      console.log("Fra resolveBuildingData - bruksarealM2:", resultC.bruksarealM2);
      console.log("Fra StoreClient.getObject - bruksarealM2:", directBygg.bruksarealM2);
      console.log("Fra resolveBuildingData - byggeaar:", resultC.byggeaar);
      console.log("Fra StoreClient.getObject - byggeaar:", directBygg.byggeaar);
      
    } catch (e) {
      console.log(`Feil ved direkte oppslag av ${resultC.byggId} i PRODUKSJON:`, e.message);
    }
  } else {
    console.log("Kan ikke teste direkte oppslag - ingen byggId fra resolveBuildingData for seksjon C");
  }

  // Test med forventet korrekt bygg-ID fra se-eiendom.kartverket.no
  console.log("\n=== Testing forventet korrekt bygg-ID 80179073 ===");
  try {
    const correctBygg = await storeClient.getObject(80179073);
    console.log("SUCCESS! Korrekt bygg 80179073 fra PRODUKSJON:", JSON.stringify(correctBygg, null, 2));
  } catch (e) {
    console.log("Feil ved oppslag av forventet bygg-ID 80179073:", e.message);
  }

  // Undersøk alle bygg tilknyttet matrikkelenheten for seksjon C
  console.log("\n=== Undersøkelse av alle bygg på matrikkelenheten for seksjon C ===");
  if (resultC && resultC.matrikkelenhetsId) {
    try {
      // Hent alle bygg-IDer for matrikkelenheten
      const bygningClient = new (await import("../src/clients/BygningClient.ts")).BygningClient(
        BASE_URL + "/BygningServiceWS",
        USERNAME,
        process.env.MATRIKKEL_PASSWORD!
      );
      const ctx = () => ({
        locale: "no_NO_B",
        brukOriginaleKoordinater: true,
        koordinatsystemKodeId: 25833,
        systemVersion: "trunk",
        klientIdentifikasjon: "test-script",
        snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
      });
      
      const allByggIds = await bygningClient.findByggForMatrikkelenhet(resultC.matrikkelenhetsId, ctx());
      console.log("Alle bygg-IDer på matrikkelenheten:", allByggIds);
      
      // Test hver bygg-ID
      for (const byggId of allByggIds) {
        try {
          const byggData = await storeClient.getObject(byggId);
          console.log(`Bygg ${byggId}:`, {
            bruksarealM2: byggData.bruksarealM2,
            byggeaar: byggData.byggeaar,
            representasjonspunkt: byggData.representasjonspunkt ? "JA" : "NEI"
          });
        } catch (e) {
          console.log(`Bygg ${byggId}: FEIL -`, e.message);
        }
      }
    } catch (e) {
      console.log("Feil ved undersøkelse av alle bygg:", e.message);
    }
  }

  if (!process.env.LIVE) {
    /* eksakte mock-verdier */
    assert.equal(resultC.gnr, 73);
    assert.equal(resultC.bnr, 704);
    assert.equal(resultC.matrikkelenhetsId, 999);
    assert.equal(resultC.byggId, 80179071);
    assert.equal(resultC.bruksarealM2, 120);
    assert.equal(resultC.byggeaar, 1985);
  } else {
    /* enkle sanity-checks i live-modus */
    assert.ok(resultC.matrikkelenhetsId > 0);
    assert.ok(resultC.byggId > 0);
    assert.ok((resultC.bruksarealM2 ?? 0) > 0);
  }

  console.log("✅  Integrasjonstesten passerte");
})();

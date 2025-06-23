// scripts/test-e2e-building.ts
// -------------------------------------------------------------------
// e2e‐test: adresse → matrikkelenhet → bygg → store-boble → energiattest
// Oppdatert juni 2025 for én-ID-flyten + Enova-integrasjon     v2.1
// -------------------------------------------------------------------
import { strict as assert } from "assert";
import nock from "nock";
import fetch from "node-fetch";
import { resolveBuildingData } from "../services/building-info-service/index.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import { cleanupSoapDumps } from "../src/utils/soapDump.ts";

// Import environment
import "../loadEnv.ts";

// Test mot produksjonsmiljøet
const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const ENOVA_API_KEY = process.env.ENOVA_API_KEY || "";

const storeClient = new StoreClient(
  matrikkelEndpoint(BASE_URL, "StoreService"),
  USERNAME,
  process.env.MATRIKKEL_PASSWORD!
);

/* ─── Energiattest-funksjon ─── */
async function fetchEnergiattest(p: {
  kommunenummer: string;
  gnr: number;
  bnr: number;
  seksjonsnummer?: number;
  bygningsnummer?: string;
}) {
  if (!ENOVA_API_KEY) {
    console.log("⚠️  ENOVA_API_KEY ikke satt - hopper over energiattest-oppslag");
    return null;
  }

  try {
    const requestBody: any = {
      kommunenummer: p.kommunenummer,
      gardsnummer: String(p.gnr),
      bruksnummer: String(p.bnr),
      bruksenhetnummer: "",
      seksjonsnummer: p.seksjonsnummer ? String(p.seksjonsnummer) : "",
    };
    
    if (p.bygningsnummer) {
      requestBody.bygningsnummer = p.bygningsnummer;
    }
    
    const response = await fetch(
      "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Energitiltak/1.0",
          "x-api-key": ENOVA_API_KEY,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log("📋 Ingen energiattest funnet");
        return null;
      }
      throw new Error(`Enova API feil: ${response.status}`);
    }

    const list = await response.json();
    if (Array.isArray(list) && list[0]) {
      const attest = list[0];
      console.log("✅ Energiattest funnet!");
      return attest;
    }
    return null;
  } catch (error) {
    console.log("❌ Feil ved henting av energiattest:", error.message);
    return null;
  }
}

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
  
  // Test flere adresser for å verifisere problemets omfang
  const testAdresser = [
    { adresse: "Kjelsåsveien 97B, 0491 Oslo", type: "tomannsbolig", forventetKode: "121" }, // Har energiattest G
    { adresse: "Fallanveien 29, 0495 Oslo", type: "boligblokk", forventetKode: "141-149" },
    { adresse: "Hesteskoen 12K, 0493 Oslo", type: "rekkehus", forventetKode: "131-139" },
    { adresse: "Kapellveien 156C, 0493 Oslo", type: "tomannsbolig", forventetKode: "121" },
    { adresse: "Kapellveien 156B, 0493 Oslo", type: "tomannsbolig", forventetKode: "121" }
  ];

  for (const test of testAdresser) {
    console.log(`\n=== Testing ${test.adresse} (${test.type}) ===`);
    let result = null;
    try {
      result = await resolveBuildingData(test.adresse);
      console.log(`SUCCESS! Resultat:`, {
        adresse: test.adresse,
        bygningstypeKodeId: result.bygningstypeKodeId,
        bygningstypeKode: result.bygningstypeKode,  // Ny: viser 3-sifret kode
        bygningstype: result.bygningstype,
        rapporteringsNivaa: result.rapporteringsNivaa,
        forventetKode: test.forventetKode,
        korrekt: result.bygningstypeKode ? test.forventetKode.includes(result.bygningstypeKode) : false
      });
      
      // Hent energiattest hvis tilgjengelig
      if (result.gnr && result.bnr) {
        console.log("\n📋 Sjekker energiattest...");
        const energiattest = await fetchEnergiattest({
          kommunenummer: test.adresse.includes("Oslo") ? "0301" : "0301", // Oslo
          gnr: result.gnr,
          bnr: result.bnr,
          seksjonsnummer: result.seksjonsnummer || undefined,
          bygningsnummer: result.bygningsnummer || undefined
        });
        
        if (energiattest) {
          console.log("✅ Energiattest funnet!");
          console.log("  - Attestnummer:", energiattest.energiattest?.attestnummer);
          console.log("  - Energikarakter:", energiattest.energiattest?.energikarakter);
          console.log("  - Oppvarmingskarakter:", energiattest.energiattest?.oppvarmingskarakter);
          console.log("  - Utstedelsesdato:", energiattest.energiattest?.utstedelsesdato);
          console.log("  - Byggeår (fra attest):", energiattest.enhet?.bygg?.byggeår);
          console.log("  - Bruksareal (fra attest):", energiattest.enhet?.bruksareal);
          console.log("  - URL:", energiattest.energiattest?.attestUrl);
          
          // Lagre energiattest i resultat for senere bruk
          result.energiattest = energiattest;
        }
      }
    } catch (e) {
      console.log(`Feil ved oppslag av ${test.adresse}:`, e.message);
      continue;
    }
  }

  // Velg første resultat for videre testing
  let resultC = null;
  try {
    resultC = await resolveBuildingData(testAdresser[0].adresse);
  } catch (e) {
    console.log("Feil ved testing:", e.message);
    throw e;
  }

  // Vis komplett rapport for alle testadresser
  console.log("\n=== KOMPLETT RAPPORT FOR ALLE TESTADRESSER ===");
  console.log("┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ Adresse                       │ GNR  │ BNR │ SNR │ Byggeår │ Areal │ Bygningstype              │ Kode │ Bygg-ID   │ Matr.enh.ID │");
  console.log("├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤");
  
  // Samle resultater for alle adresser
  const alleResultater = [];
  for (const test of testAdresser) {
    try {
      const res = await resolveBuildingData(test.adresse);
      alleResultater.push(res);
      
      // Format verdier for tabellen
      const adresse = test.adresse.padEnd(29);
      const gnr = String(res.gnr || "-").padEnd(4);
      const bnr = String(res.bnr || "-").padEnd(3);
      const snr = "-".padEnd(3); // Seksjonsnummer må hentes separat om nødvendig
      const byggeaar = String(res.byggeaar || "-").padEnd(7);
      const areal = String(res.bruksarealM2 || "-").padEnd(5);
      const bygningstype = (res.bygningstype || "-").substring(0, 25).padEnd(25);
      const kode = String(res.bygningstypeKode || res.bygningstypeKodeId || "-").padEnd(4);
      const byggId = String(res.byggId || "-").padEnd(9);
      const matrId = String(res.matrikkelenhetsId || "-").padEnd(11);
      
      console.log(`│ ${adresse} │ ${gnr} │ ${bnr} │ ${snr} │ ${byggeaar} │ ${areal} │ ${bygningstype} │ ${kode} │ ${byggId} │ ${matrId} │`);
    } catch (e) {
      console.log(`│ ${test.adresse.padEnd(29)} │ FEIL: ${e.message.padEnd(121)} │`);
    }
  }
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘");
  
  // Vis også representasjonspunkt-data
  console.log("\n=== REPRESENTASJONSPUNKT (koordinater) ===");
  console.log("┌────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ Adresse                       │ Øst (UTM33)  │ Nord (UTM33) │ EPSG       │");
  console.log("├────────────────────────────────────────────────────────────────────────────┤");
  for (let i = 0; i < alleResultater.length; i++) {
    const res = alleResultater[i];
    if (res.representasjonspunkt) {
      const adresse = testAdresser[i].adresse;
      console.log(`│ ${adresse.padEnd(29)} │ ${String(Math.round(res.representasjonspunkt.east)).padEnd(12)} │ ${String(Math.round(res.representasjonspunkt.north)).padEnd(12)} │ ${res.representasjonspunkt.epsg.padEnd(10)} │`);
    }
  }
  console.log("└────────────────────────────────────────────────────────────────────────────┘");
  
  // Vis energiattest-oversikt
  console.log("\n=== ENERGIATTEST-OVERSIKT ===");
  console.log("┌─────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ Adresse                       │ Energikarakter │ Oppvarmingskarakter │ Utstedelsesdato      │");
  console.log("├─────────────────────────────────────────────────────────────────────────────────────────────────┤");
  
  for (let i = 0; i < alleResultater.length; i++) {
    const res = alleResultater[i];
    const adresse = testAdresser[i].adresse.padEnd(29);
    
    // Hent energiattest på nytt for visning
    const energiattest = await fetchEnergiattest({
      kommunenummer: "0301",
      gnr: res.gnr,
      bnr: res.bnr
    });
    
    if (energiattest && energiattest.energiattest) {
      const karakter = (energiattest.energiattest.energikarakter || "-").toUpperCase().padEnd(14);
      const oppvarming = (energiattest.energiattest.oppvarmingskarakter || "-").padEnd(19);
      const dato = energiattest.energiattest.utstedelsesdato ? 
        new Date(energiattest.energiattest.utstedelsesdato).toLocaleDateString('nb-NO').padEnd(20) : 
        "-".padEnd(20);
      console.log(`│ ${adresse} │ ${karakter} │ ${oppvarming} │ ${dato} │`);
    } else {
      console.log(`│ ${adresse} │ Ingen attest          │ -                   │ -                    │`);
    }
  }
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────────────┘");

  // Test direkte oppslag av ekte bygg-ID fra dataflyten
  console.log("\n=== Testing direkte bygg-ID oppslag ===");
  if (resultC && resultC.byggId) {
    try {
      const directBygg = await storeClient.getObject(resultC.byggId);
      console.log(`SUCCESS! Direkte bygg ${resultC.byggId} fra PRODUKSJON:`, JSON.stringify(directBygg, null, 2));
      
      // Sammenlign data fra begge kilder
      console.log("\n=== Datasammenligning ===");
      console.log("Fra resolveBuildingData - bruksarealM2:", resultC.bruksarealM2);
      console.log("Fra StoreClient.getObject - bruksarealM2:", directBygg.bruksarealM2);
      console.log("Fra resolveBuildingData - byggeaar:", resultC.byggeaar);
      console.log("Fra StoreClient.getObject - byggeaar:", directBygg.byggeaar);
      console.log("Fra StoreClient.getObject - bygningstypeKodeId:", directBygg.bygningstypeKodeId);
      
    } catch (e) {
      console.log(`Feil ved direkte oppslag av ${resultC.byggId} i PRODUKSJON:`, e.message);
    }
  } else {
    console.log("Kan ikke teste direkte oppslag - ingen byggId fra resolveBuildingData");
  }

  // Undersøk alle bygg tilknyttet matrikkelenheten
  console.log("\n=== Undersøkelse av alle bygg på matrikkelenheten ===");
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
            bygningstypeKodeId: byggData.bygningstypeKodeId,
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
  
  // Rydd opp i gamle SOAP-dump filer (behold kun 12 nyeste)
  if (process.env.LIVE === "1") {
    await cleanupSoapDumps();
  }
  
  // Eksplisitt avslutt prosessen for å unngå timeout
  process.exit(0);
})().catch((error) => {
  console.error("❌ Test feilet:", error);
  process.exit(1);
});

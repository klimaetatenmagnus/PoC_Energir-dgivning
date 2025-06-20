// scripts/test-e2e-building.ts
// -------------------------------------------------------------------
// e2e‐test: adresse → matrikkelenhet → bygg → store-boble
// Oppdatert juni 2025 for én-ID-flyten                         v2.0
// -------------------------------------------------------------------
import { strict as assert } from "assert";
import nock from "nock";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

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

  /* 2) Matrikkel – findMatrikkelenhetIdForIdent */
  nock("https://matrikkel.mock")
    .post("/service/matrikkelenhet/MatrikkelenhetServiceWS")
    .reply(
      200,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <ns:return xmlns:ns="http://matrikkel…"><value>999</value></ns:return>
        </soap:Body></soap:Envelope>`
    );

  /* 3) BygningService – bygg‐liste for matrikkelenhet 999 */
  nock("https://matrikkel.mock")
    .post("/service/bygning/BygningServiceWS")
    .reply(
      200,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <ns:return xmlns:ns="http://matrikkel…">
            <item>80179073</item>
          </ns:return>
        </soap:Body></soap:Envelope>`
    );

  /* 4) StoreService – bygg‐boble */
  nock("https://matrikkel.mock")
    .post("/service/store/StoreServiceWS")
    .reply(
      200,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <ns:return xmlns:ns="http://matrikkel…">
            <bruksarealM2>120</bruksarealM2>
            <byggeaar>1985</byggeaar>
            <representasjonspunkt>
              <aust>262000</aust><nord>6650000</nord>
            </representasjonspunkt>
          </ns:return>
        </soap:Body></soap:Envelope>`
    );
} else {
  console.log("🌐 LIVE – ekte HTTP-trafikk tillatt");
  nock.enableNetConnect();
}

/* ─── SELVE TESTEN ─── */
(async () => {
  const result = await resolveBuildingData("Kapellveien 156C, 0493 Oslo");

  console.log("RESULTAT:", JSON.stringify(result, null, 2));

  if (!process.env.LIVE) {
    /* eksakte mock-verdier */
    assert.equal(result.gnr, 73);
    assert.equal(result.bnr, 704);
    assert.equal(result.matrikkelenhetsId, 999);
    assert.equal(result.byggId, 80179073);
    assert.equal(result.bruksarealM2, 120);
    assert.equal(result.byggeaar, 1985);
  } else {
    /* enkle sanity-checks i live-modus */
    assert.ok(result.matrikkelenhetsId > 0);
    assert.ok(result.byggId > 0);
    assert.ok((result.bruksarealM2 ?? 0) > 0);
  }

  console.log("✅  Integrasjonstesten passerte");
})();

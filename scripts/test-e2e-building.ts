import { strict as assert } from "assert";
import nock from "nock";
import { resolveBuildingData } from "../services/building-info-service/index.ts";
import type { MatrikkelContext } from "../src/clients/BygningClient.ts";

/* ─── konfig ─── */
function ctx(): MatrikkelContext {
  return {
    locale: "no_NO_B",
    brukOriginaleKoordinater: false,
    koordinatsystemKodeId: 25833,
    systemVersion: "trunk",
    klientIdentifikasjon: "test",
    snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
  };
}

/* ─── MOCKS (kjører kun uten LIVE=1) ─── */
if (!process.env.LIVE) {
  nock.disableNetConnect();
  /* 1) Adresse */
  nock("https://adresse.gov")
    .post("/AdresseServiceWS")
    .reply(200, "<xml>…gnr=73 bnr=704 kommunenummer=0301…</xml>");
  /* 2) Matrikkelenhet – findMatrikkelenheter */
  nock("https://matrikkel.gov")
    .post("/MatrikkelenhetServiceWS")
    .reply(200, "<xml><return><item><value>999</value></item></return></xml>");
  /* 3) BygningService */
  nock("https://bygning.gov")
    .post("/BygningServiceWS")
    .reply(
      200,
      "<xml><byggListe><item><byggId>80179073</byggId><bygningsnummer>80179073</bygningsnummer></item></byggListe></xml>"
    );
  /* 4) StoreServiceWS */
  nock("https://store.gov")
    .post("/StoreServiceWS")
    .reply(
      200,
      "<xml><bruksarealM2>120</bruksarealM2><byggeaar>1985</byggeaar></xml>"
    );
} else {
  console.log("🌐 LIVE – ekte HTTP-trafikk tillatt");
  nock.enableNetConnect();
}

/* ─── SELVE TESTEN ─── */
(async () => {
  const result = await resolveBuildingData("Kapellveien 156 C, 0493 Oslo");

  console.log("RESULTAT:", JSON.stringify(result, null, 2));

  /* asserter (mock-modus) */
  if (!process.env.LIVE) {
    assert.equal(result.gnr, 73);
    assert.equal(result.bnr, 704);
    assert.equal(result.bygningsnummer, "80179073");
    assert.equal((result.bygg as any).bruksarealM2, 120);
    assert.equal((result.bygg as any).byggeaar, 1985);
  } else {
    /* enkle sanity-checks i live-modus */
    assert.ok(result.bygningsnummer);
    assert.ok((result.bygg as any).bruksarealM2 > 0);
  }

  console.log("✅  Integrasjonstesten passerte");
})();

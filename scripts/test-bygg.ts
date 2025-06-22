// scripts/test-bygg.ts
// ---------------------------------------------------------------------------
// Kjør med:
// LOG_SOAP=1 node --loader ts-node/esm scripts/test-bygg.ts
// ---------------------------------------------------------------------------
import { strict as assert } from "assert";
import nock from "nock";
import { BygningClient } from "../src/clients/BygningClient.ts";
import type { MatrikkelContext } from "../src/clients/BygningClient.ts";
import 'dotenv/config'

/* ────────────── 1. Lokal ctx() med nøyaktig type ───────────── */
function ctx(): MatrikkelContext {
  return {
    locale: "no_NO_B",
    brukOriginaleKoordinater: false,
    koordinatsystemKodeId: 25833,
    systemVersion: "trunk",
    klientIdentifikasjon: "test-run",
    snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
  };
}

/* ────────────── 2. SOAP-fixture som matcher klienten ───────── */
function soap(ids: (string | number)[]): string {
  const items = ids.map((id) => `<item><byggId>${id}</byggId></item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <ns2:findByggForMatrikkelenhetResponse
         xmlns:ns2="http://matrikkel.no/wsapi/v1/BygningServiceWS">
        <return>${items}</return>
      </ns2:findByggForMatrikkelenhetResponse>
    </soap:Body>
  </soap:Envelope>`;
}

/* ────────────── 3. Mock endepunktet med nock ───────────────── */
const BASE = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1";
nock(BASE)
  .post("/BygningServiceWS")
  .reply(200, soap(["80179073", "80179073-1"]));

/* ────────────── 4. Kjør testen ─────────────────────────────── */
(async () => {
  const client = new BygningClient(BASE, "dummy", "dummy");

  const list = await client.findByggForMatrikkelenhet(284466634, ctx());

  // Fail‐safe: sørg for at vi faktisk fikk noe tilbake
  assert.ok(list.length > 0, "Forventer minst ett byggId i responsen");

  // Første element skal være laveste numeriske ID
  assert.equal(
    list[0].byggId,
    80179073,
    "Skal plukke laveste numeriske bygg-ID"
  );

  console.log("✅ test-bygg passerte");
})();

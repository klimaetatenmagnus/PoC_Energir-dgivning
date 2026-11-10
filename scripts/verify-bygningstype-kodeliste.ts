/**
 * Verifiserer ID→kode-tabellen i src/utils/buildingTypeCode.ts mot Matrikkelen.
 *
 * Matrikkelens `bygningstypeKodeId` er en intern ID, ikke den 3-sifrede
 * bygningstypekoden. Tabellen i koden er hentet slik dette skriptet gjør det:
 *   1. BygningService.findAlleBygningstypeKoder → liste med ID-er (ingen koder)
 *   2. StoreService.getObjects med BygningstypeKodeId → kodeverdi og navn per ID
 *
 * Kjøres med (krever Matrikkel-tilgang i .env):
 *   npx tsx scripts/verify-bygningstype-kodeliste.ts
 *
 * Avslutter med kode 1 hvis Matrikkelen og tabellen er uenige.
 */
import { getRuntimeConfig } from "../packages/config/src/runtime.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import { BUILDING_TYPE_ID_TO_CODE } from "../src/utils/buildingTypeCode.ts";

const config = getRuntimeConfig();
const matrikkel = config.flags.liveMode
  ? config.matrikkel.prod
  : config.matrikkel.current;

const KODER_NS =
  "http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/bygning/koder";

const matrikkelContext = (prefix: string) => `
      <${prefix}:matrikkelContext>
        <dom:locale>no_NO_B</dom:locale>
        <dom:brukOriginaleKoordinater>true</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>25833</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>trunk</dom:systemVersion>
        <dom:klientIdentifikasjon>verify-bygningstype-kodeliste</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp></dom:snapshotVersion>
      </${prefix}:matrikkelContext>`;

async function soapCall(service: string, action: string, body: string): Promise<string> {
  const response = await fetch(matrikkelEndpoint(matrikkel.baseUrl, service), {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${action}"`,
      Authorization:
        "Basic " +
        Buffer.from(`${matrikkel.username}:${matrikkel.password}`).toString("base64"),
    },
    body,
  });
  const text = await response.text();
  if (!response.ok || text.includes("<soap:Fault>")) {
    throw new Error(`SOAP-feil fra ${service}WS (${action}): HTTP ${response.status}`);
  }
  return text;
}

async function fetchIds(): Promise<number[]> {
  const xml = await soapCall(
    "BygningService",
    "findAlleBygningstypeKoder",
    `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:byg="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Body>
    <byg:findAlleBygningstypeKoder>${matrikkelContext("byg")}
    </byg:findAlleBygningstypeKoder>
  </soapenv:Body>
</soapenv:Envelope>`
  );
  return [...xml.matchAll(/<(?:\w+:)?value>(\d+)<\/(?:\w+:)?value>/g)].map((m) =>
    Number(m[1])
  );
}

async function fetchCodes(ids: number[]): Promise<Map<number, { kode: string; navn: string }>> {
  const xml = await soapCall(
    "StoreService",
    "getObjects",
    `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
                  xmlns:kod="${KODER_NS}"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body>
    <sto:getObjects>
      <sto:ids>
${ids
  .map(
    (id) =>
      `        <dom:item xsi:type="kod:BygningstypeKodeId"><dom:value>${id}</dom:value></dom:item>`
  )
  .join("\n")}
      </sto:ids>${matrikkelContext("sto")}
    </sto:getObjects>
  </soapenv:Body>
</soapenv:Envelope>`
  );

  const result = new Map<number, { kode: string; navn: string }>();
  // Hvert kodeobjekt starter med <id xsi:type="…BygningstypeKodeId"><value>N</value>
  const chunks = xml.split(/<id xsi:type="[^"]*BygningstypeKodeId">/).slice(1);
  for (const chunk of chunks) {
    const id = chunk.match(/^<value>(\d+)<\/value>/);
    const kode = chunk.match(/<(?:\w+:)?kodeverdi>([^<]*)<\/(?:\w+:)?kodeverdi>/);
    const navn = chunk.match(/<entry><key>no_NO<\/key><value>([^<]*)<\/value>/);
    if (id && kode) {
      result.set(Number(id[1]), { kode: kode[1].trim(), navn: navn?.[1] ?? "" });
    }
  }
  return result;
}

async function main() {
  const ids = await fetchIds();
  const live = await fetchCodes(ids);
  console.log(`Matrikkelen (${matrikkel.baseUrl}): ${ids.length} ID-er, ${live.size} kodeobjekter`);

  const avvik: string[] = [];
  for (const [id, { kode, navn }] of [...live].sort((a, b) => a[0] - b[0])) {
    const expected = BUILDING_TYPE_ID_TO_CODE[id];
    if (kode === "") {
      // ID 0 har tom kodeverdi og skal ikke finnes i tabellen
      if (expected !== undefined) avvik.push(`ID ${id}: tom kode i Matrikkelen, tabellen har ${expected}`);
      continue;
    }
    if (String(expected) !== kode) {
      avvik.push(`ID ${id}: Matrikkelen har ${kode} (${navn}), tabellen har ${expected ?? "ingen oppføring"}`);
    }
  }
  for (const id of Object.keys(BUILDING_TYPE_ID_TO_CODE).map(Number)) {
    if (!live.has(id)) avvik.push(`ID ${id}: finnes i tabellen, men ikke i Matrikkelen`);
  }

  if (avvik.length > 0) {
    console.error(`AVVIK (${avvik.length}):`);
    for (const linje of avvik) console.error(`  ${linje}`);
    process.exit(1);
  }
  console.log(
    `OK: alle ${Object.keys(BUILDING_TYPE_ID_TO_CODE).length} oppføringer i BUILDING_TYPE_ID_TO_CODE stemmer med Matrikkelen`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

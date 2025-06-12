// ---------------------------------------------------------------------------
// src/clients/adresseClient.ts
// Adresse (husnr + bokstav) ► matrikkelenhets-ID
// ---------------------------------------------------------------------------
import axios, { AxiosRequestConfig } from "axios";

/* ------------------------------------------------------------------ */
/* 1. Offentlig API                                                   */
/* ------------------------------------------------------------------ */

export interface ParsedAddress {
  kommunenummer: string;
  adressekode: string;
  husnummer: string;
  bokstav?: string | null;
}

/**
 * Slår opp korrekt matrikkelenhets-ID for en vegadresse.
 */
export async function findMatrikkelenhetIdForAddress(
  adr: ParsedAddress
): Promise<string> {
  /* ─── 1) AdresseServiceWS: findAdresseIdForIdent ───────────────── */
  const ctxXml = buildContextXml();

  const soapBody = `
    <adr:findAdresseIdForIdent
        xmlns:adr ="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/adresse"
        xmlns:adr1="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/adresse"
        xmlns:kom ="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/kommune"
        xmlns:dom ="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
        xmlns:xsi ="http://www.w3.org/2001/XMLSchema-instance">

      <adr:adresseIdent xsi:type="adr1:VegadresseIdent">
        <adr1:kommuneIdent>
          <kom:kommunenummer>${adr.kommunenummer}</kom:kommunenummer>
        </adr1:kommuneIdent>

        <adr1:adressekode>${adr.adressekode}</adr1:adressekode>
        <adr1:nummer>${adr.husnummer}</adr1:nummer>
        <adr1:bokstav>${adr.bokstav ?? ""}</adr1:bokstav>
      </adr:adresseIdent>

      ${ctxXml}
    </adr:findAdresseIdForIdent>`.trim();

  const { data: responseXml } = await soapPost({
    url: `${process.env.MATRIKKEL_API_BASE_URL_TEST}/AdresseServiceWS`,
    action: "findAdresseIdForIdent",
    body: soapBody,
  });

  const vegadresseId = extractTag(responseXml, "value");
  if (!vegadresseId) throw new Error("vegadresseId not found");

  /* ─── 2) StoreServiceWS: getObject(VegadresseId) ────────────────── */
  const vegadresseBubbleXml = await fetchVegadresseBubble(Number(vegadresseId));

  const matrikkelenhetId = extractIdValue(
    vegadresseBubbleXml,
    "matrikkelenhetId"
  );
  if (!matrikkelenhetId) {
    throw new Error(`matrikkelenhetId not found on Vegadresse ${vegadresseId}`);
  }
  return matrikkelenhetId;
}

/* ------------------------------------------------------------------ */
/* 2. SOAP helpers                                                    */
/* ------------------------------------------------------------------ */

async function fetchVegadresseBubble(id: number): Promise<string> {
  /* samme felter, men prefiks MÅ være sto: i Store-kallet */
  const ctxXml = `
  <sto:matrikkelContext>
    <dom:locale>no_NO_B</dom:locale>
    <dom:brukOriginaleKoordinater>true</dom:brukOriginaleKoordinater>

   
    <dom:koordinatsystemKodeId>
      <dom:value>25833</dom:value>
    </dom:koordinatsystemKodeId>

    <dom:systemVersion>trunk</dom:systemVersion>
    <dom:klientIdentifikasjon>bygg-info-service</dom:klientIdentifikasjon>

    <dom:snapshotVersion>
      <dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp>
    </dom:snapshotVersion>
  </sto:matrikkelContext>`.trim();

  const body = `
    <sto:getObject
        xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store"
        xmlns:adr1="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/adresse"
        xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <sto:id xsi:type="adr1:VegadresseId">
        <dom:value>${id}</dom:value>
      </sto:id>
      ${ctxXml}
    </sto:getObject>`.trim();

  const { data } = await soapPost({
    url: `${process.env.MATRIKKEL_API_BASE_URL_TEST}/StoreServiceWS`,
    action: "getObject",
    body: body,
  });

  return data;
}

async function soapPost(opts: { url: string; action: string; body: string }) {
  const requestXml = wrapEnvelope(opts.body);

  if (process.env.LOG_SOAP) {
    console.log(
      "\n=== SOAP REQUEST to",
      opts.action,
      "===\n",
      requestXml,
      "\n"
    );
  }

  const cfg: AxiosRequestConfig = {
    method: "POST",
    url: opts.url,
    data: requestXml,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: opts.action,
    },
    auth: {
      username:
        process.env.MATRIKKEL_USERNAME_TEST ?? process.env.MATRIKKEL_USERNAME!,
      password: process.env.MATRIKKEL_PASSWORD!,
    },
    validateStatus: (s) => s < 500,
  };

  const resp = await axios.request<string>(cfg);

  if (process.env.LOG_SOAP) {
    console.log(
      "\n=== SOAP RESPONSE from",
      opts.action,
      "===\n",
      resp.data,
      "\n"
    );
  }
  return resp;
}

function wrapEnvelope(inner: string) {
  return `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Header/>
      <soapenv:Body>${inner}</soapenv:Body>
    </soapenv:Envelope>`.trim();
}

/* ------------------------------------------------------------------ */
/* 3. XML-build & utils                                               */
/* ------------------------------------------------------------------ */

function buildContextXml() {
  return `
    <adr:matrikkelContext>
      <dom:locale>no_NO_B</dom:locale>
      <dom:brukOriginaleKoordinater>false</dom:brukOriginaleKoordinater>
      <dom:koordinatsystemKodeId><dom:value>25833</dom:value></dom:koordinatsystemKodeId>
      <dom:systemVersion>trunk</dom:systemVersion>
      <dom:klientIdentifikasjon>bygg-info-service</dom:klientIdentifikasjon>
      <dom:snapshotVersion><dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp></dom:snapshotVersion>
    </adr:matrikkelContext>`.trim();
}

/** Regex-basert tag-uttrekk som godtar valgfritt prefiks */
function extractTag(xml: string, local: string): string | undefined {
  const re = new RegExp(
    `<(?:[^\\s:>]+:)?${local}[^>]*>([^<]+)</(?:[^\\s:>]+:)?${local}>`
  );
  return re.exec(xml)?.[1].trim();
}

function extractIdValue(xml: string, local: string): string | undefined {
  const re = new RegExp(
    `<(?:[^\\s:>]+:)?${local}[^>]*>[\\s\\S]*?<value>([^<]+)</value>[\\s\\S]*?</(?:[^\\s:>]+:)?${local}>`
  );
  return re.exec(xml)?.[1].trim();
}

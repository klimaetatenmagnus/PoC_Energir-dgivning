import "dotenv/config";
import express from "express";
import fetch from "node-fetch";

// ────── Globale feilloggere ─────────────────────────────────────────────
process.on("uncaughtException", (err) =>
  console.error("❌ uncaughtException:", err)
);
process.on("unhandledRejection", (err) =>
  console.error("❌ unhandledRejection:", err)
);

const env = process.env.API_ENV ?? "test"; // default = test

// ────── 1. Miljø-spesifikke variabler ───────────────────────────────────
const BASE_URL =
  env === "prod"
    ? process.env.MATRIKKEL_API_BASE_URL_PROD!
    : process.env.MATRIKKEL_API_BASE_URL_TEST!;

const USERNAME =
  env === "prod"
    ? process.env.MATRIKKEL_USERNAME!
    : process.env.MATRIKKEL_USERNAME_TEST!;

const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

function basicAuth(u: string, p: string) {
  return "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
}

// ────── 2. Helper – injiser riktig context per tjeneste ───────────────────
function ensureContext(xml: string, service: string): string {
  if (service === "KodelisteServiceWS") {
    if (
      !xml.includes(
        'xmlns:kod="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/kodeliste"'
      )
    ) {
      xml = xml.replace(
        /<kod:getKodelister([^>]*)>/,
        `<kod:getKodelister xmlns:kod="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/kodeliste"$1>`
      );
    }
    const inner = `
      <kod:snapshotVersion>
        <dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp>
      </kod:snapshotVersion>
      <kod:matrikkelContext xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
        <dom:locale>no_NO_B</dom:locale>
        <dom:brukOriginaleKoordinater>false</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId>
          <dom:value>25833</dom:value>
        </dom:koordinatsystemKodeId>
        <dom:systemVersion>trunk</dom:systemVersion>
        <dom:klientIdentifikasjon>proxy</dom:klientIdentifikasjon>
      </kod:matrikkelContext>`;
    if (/<kod:getKodelister[^>]*\/\>/.test(xml)) {
      return xml.replace(
        /<kod:getKodelister[^>]*\/\>/,
        `<kod:getKodelister>${inner}</kod:getKodelister>`
      );
    }
    return xml.replace(/<kod:getKodelister[^>]*>/, (m) => `${m}\n${inner}`);
  }

  if (service === "MatrikkelenhetServiceWS") {
    // Legg til namespaces
    if (
      !xml.includes(
        'xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"'
      )
    ) {
      xml = xml.replace(
        /<mat:findMatrikkelenhetIdForIdent([^>]*)>/,
        `<mat:findMatrikkelenhetIdForIdent xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"$1>`
      );
    }
    if (
      !xml.includes(
        'xmlns:mid="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"'
      )
    ) {
      xml = xml.replace(
        /<mat:findMatrikkelenhetIdForIdent([^>]*)>/,
        `<mat:findMatrikkelenhetIdForIdent xmlns:mid="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"$1>`
      );
    }
    if (
      !xml.includes(
        'xmlns:kom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/kommune"'
      )
    ) {
      xml = xml.replace(
        /<mat:findMatrikkelenhetIdForIdent([^>]*)>/,
        `<mat:findMatrikkelenhetIdForIdent xmlns:kom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/kommune"$1>`
      );
    }
    // Wrap kommuneIdent
    xml = xml.replace(
      /<mid:kommuneIdent>(\d+)<\/mid:kommuneIdent>/g,
      `<mid:kommuneIdent><kom:kommunenummer>$1</kom:kommunenummer></mid:kommuneIdent>`
    );
    // Inject context
    const context = `
      <mat:matrikkelContext>
        <dom:locale>no_NO_B</dom:locale>
        <dom:brukOriginaleKoordinater>false</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId>
          <dom:value>25833</dom:value>
        </dom:koordinatsystemKodeId>
        <dom:systemVersion>trunk</dom:systemVersion>
        <dom:klientIdentifikasjon>proxy</dom:klientIdentifikasjon>
        <dom:snapshotVersion>
          <dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp>
        </dom:snapshotVersion>
      </mat:matrikkelContext>`;
    if (!xml.includes("<mat:matrikkelContext>")) {
      xml = xml.replace(
        /<mat:findMatrikkelenhetIdForIdent[^>]*>/,
        (m) => `${m}\n  ${context}`
      );
    }
    return xml;
  }

  return xml;
}

// ────── 3. Express-proxy med dynamisk tjeneste ───────────────────────────
const app = express();
app.use(express.text({ type: "text/xml" }));

app.post("/api/matrikkel/:service", async (req, res) => {
  const service = req.params.service;
  console.error("⇢ route reached for service", service);

  try {
    let xml = req.body as string;
    console.error("XML-prefix:", xml.slice(0, 120));

    xml = ensureContext(xml, service);

    const targetUrl = `${BASE_URL}/${service}`;
    console.error("→ calling", targetUrl);

    const soapAction = "";

    const t0 = Date.now();
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: soapAction,
        Authorization: basicAuth(USERNAME, PASSWORD),
      },
      body: xml,
    });

    const text = await resp.text();
    console.error(`[${env}] Matrikkel →`, resp.status, Date.now() - t0, "ms");
    res.status(resp.status).send(text);
  } catch (err) {
    console.error("❌ route error:", err);
    res.status(500).send("Proxy error");
  }
});

// ────── 4. Oppstart-logg ────────────────────────────────────────────────
console.log(
  `env=${env}`,
  "\nBASE_URL =",
  BASE_URL || "(undefined)",
  "\nUSERNAME  =",
  USERNAME || "(undefined)"
);

app.listen(3000, () =>
  console.log(`Proxy listening on http://localhost:3000  (env=${env})`)
);

// HACK: hold prosessen i live i ts-node-ESM-miljøet
setInterval(() => {}, 1 << 30);

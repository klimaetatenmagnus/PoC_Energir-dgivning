// scripts/test-ombygdaar-getBygning.ts
// -----------------------------------------------------------------------------
// Test for å verifisere om ombygdAar-feltet finnes i getBygning() response
// Tester direkte mot BygningServiceWS med kjente bygningsnummer
// -----------------------------------------------------------------------------

import axios from "axios";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { dumpSoap } from "../src/utils/soapDump.ts";

// Import environment
import "../loadEnv.ts";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: { timestamp: string };
}

const ctx: MatrikkelContext = {
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "test-ombygdaar",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
};

// Test bygningsnummer fra kjente adresser
const testBygningsnummer = [
  "80184506",  // Fra Kjelsåsveien 97B (ombygd rekkehus?)
  "286103642", // Fra Kapellveien 156B (1952-bygget)
  "453769728", // Fra Kapellveien 156C (2013-bygget - nyere)
];

function renderGetBygningRequest(bygningsnummer: string, ctx: MatrikkelContext): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:byg="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Body>
    <byg:getBygning>
      <byg:bygningsnummer>${bygningsnummer}</byg:bygningsnummer>
      <byg:matrikkelContext>
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>   
        <dom:koordinatsystemKodeId>
          <dom:value>${ctx.koordinatsystemKodeId}</dom:value>
        </dom:koordinatsystemKodeId>
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion>
          <dom:timestamp>${ctx.snapshotVersion.timestamp}</dom:timestamp>
        </dom:snapshotVersion>
      </byg:matrikkelContext>
    </byg:getBygning>
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function testGetBygning(bygningsnummer: string): Promise<void> {
  console.log(`\n=== Testing getBygning for bygningsnummer: ${bygningsnummer} ===`);
  
  const soapAction = "getBygning";
  const corrId = crypto.randomUUID();
  const xmlRequest = renderGetBygningRequest(bygningsnummer, ctx);

  const endpoint = `${BASE_URL}/service/bygning/BygningServiceWS`;
  console.log(`Endpoint: ${endpoint}`);

  try {
    // Dump request hvis LIVE
    if (process.env.LIVE === "1") {
      await dumpSoap(corrId, "request", xmlRequest);
    }

    if (process.env.LOG_SOAP === "1") {
      console.log(`\n--- SOAP Request (corrId=${corrId}) ---`);
      console.log(xmlRequest);
    }

    const resp = await axios.post(endpoint, xmlRequest, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: soapAction,
      },
      auth: { username: USERNAME, password: PASSWORD },
      timeout: 15_000,
      validateStatus: () => true,
    });

    // Dump response hvis LIVE
    const phase = resp.status >= 400 || resp.data.includes("<soap:Fault>") ? "fault" : "response";
    if (process.env.LIVE === "1") {
      await dumpSoap(corrId, phase, resp.data);
    }

    console.log(`Response status: ${resp.status}`);

    if (phase === "fault") {
      console.log("❌ SOAP Fault returned:");
      console.log(resp.data.slice(0, 1000));
      return;
    }

    // Parse XML response
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: true,
      trimValues: true,
    });
    const parsed = parser.parse(resp.data);

    // Søk etter ombygdAar i hele responsen
    const responseText = resp.data;
    const ombygdAarMatch = responseText.match(/<[^>]*ombygdAar[^>]*>([^<]+)<\/[^>]*ombygdAar[^>]*>/i);
    
    if (ombygdAarMatch) {
      console.log(`✅ FUNNET ombygdAar: ${ombygdAarMatch[1]}`);
      console.log(`   Full match: ${ombygdAarMatch[0]}`);
    } else {
      console.log("❌ ombygdAar ikke funnet i responsen");
    }

    // Søk også etter andre år-relaterte felt
    const byggeaarMatch = responseText.match(/<[^>]*byggeaar[^>]*>([^<]+)<\/[^>]*byggeaar[^>]*>/i);
    if (byggeaarMatch) {
      console.log(`📅 Byggeår funnet: ${byggeaarMatch[1]}`);
    }

    // Vis deler av responsen for debugging
    console.log("\n--- Første 2000 tegn av responsen ---");
    console.log(resp.data.slice(0, 2000));
    
    if (resp.data.length > 2000) {
      console.log("\n--- Siste 1000 tegn av responsen ---");
      console.log("..." + resp.data.slice(-1000));
    }

    // Tell opp alle XML-tagger for å se hva som finnes
    const tags = responseText.match(/<[^>\/][^>]*>/g) || [];
    const uniqueTags = [...new Set(tags.map(tag => tag.replace(/^<([^>\s]+).*/, '$1')))];
    console.log(`\n📋 Unike XML-tagger funnet (${uniqueTags.length}):`, uniqueTags.sort());

  } catch (error) {
    console.log(`❌ Feil ved testing av ${bygningsnummer}:`, error.message);
    if (error.response) {
      console.log(`HTTP Status: ${error.response.status}`);
      console.log(`Response data: ${error.response.data?.slice(0, 500)}`);
    }
  }
}

// Main test runner
(async () => {
  console.log("=== TEST: getBygning() for ombygdAar-feltet ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Username: ${USERNAME}`);
  console.log(`Test mode: ${process.env.LIVE === "1" ? "LIVE" : "MOCK"}`);
  
  if (process.env.LIVE !== "1") {
    console.log("⚠️  Kjør med LIVE=1 for å teste mot ekte API");
    process.exit(1);
  }

  for (const bygningsnummer of testBygningsnummer) {
    await testGetBygning(bygningsnummer);
    
    // Liten pause mellom kall
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n✅ Test fullført - sjekk output ovenfor for ombygdAar-resultater");
  process.exit(0);
})().catch((error) => {
  console.error("❌ Test feilet:", error);
  process.exit(1);
});
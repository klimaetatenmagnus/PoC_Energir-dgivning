// Dump full XML for manual analysis
import "../loadEnv.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import fs from "fs/promises";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
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
  klientIdentifikasjon: "test-script",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

async function dumpXml() {
  console.log("=== DUMPING XML FOR ANALYSIS ===\n");
  
  // Hent matrikkelenhet for 156B
  const ids = await matrikkelClient.findMatrikkelenheter({
    kommunenummer: "0301",
    gnr: 73,
    bnr: 704,
    bokstav: "B",
    husnummer: 156,
    adressekode: 13616
  }, ctx());
  
  if (ids.length > 0) {
    console.log(`Henter XML for matrikkelenhet ${ids[0]}...`);
    const xml = await storeClient.getObjectXml(ids[0], "MatrikkelenhetId");
    
    // Pretty print XML
    const prettyXml = xml
      .replace(/></g, ">\n<")
      .split("\n")
      .map(line => {
        // Indent based on nesting
        const depth = (line.match(/</g) || []).length - (line.match(/\/>/g) || []).length;
        return "  ".repeat(Math.max(0, depth - 1)) + line;
      })
      .join("\n");
    
    // Save to file
    const filename = `kapellveien-156b-${ids[0]}.xml`;
    await fs.writeFile(filename, prettyXml);
    console.log(`✅ Saved to ${filename}`);
    
    // Extract key info
    console.log("\n📊 KEY INFORMATION:");
    
    // Look for matrikkelnummer
    const mnrMatch = xml.match(/<matrikkelnummer>([^<]+)<\/matrikkelnummer>/);
    if (mnrMatch) {
      console.log(`Matrikkelnummer: ${mnrMatch[1]}`);
    }
    
    // Look for any field containing "seksjon"
    const seksjonRegex = /<([^>]*seksjon[^>]*)>([^<]+)<\/\1>/gi;
    let match;
    while ((match = seksjonRegex.exec(xml)) !== null) {
      console.log(`${match[1]}: ${match[2]}`);
    }
    
    // Look for bruksenhet
    if (xml.includes("bruksenhet")) {
      console.log("\n✅ XML inneholder 'bruksenhet' - dette kan være nøkkelen!");
    }
    
    // Look for eierseksjon structure
    if (xml.includes("<eierseksjon>") || xml.includes("<ns5:eierseksjon>")) {
      console.log("\n✅ XML inneholder eierseksjon-struktur!");
      
      // Extract eierseksjon content
      const eierseksjonMatch = xml.match(/<(ns\d+:)?eierseksjon[^>]*>([\s\S]*?)<\/\1eierseksjon>/);
      if (eierseksjonMatch) {
        const eierseksjonContent = eierseksjonMatch[2];
        const seksjonInEier = eierseksjonContent.match(/<(ns\d+:)?seksjonsnummer>(\d+)<\/\1seksjonsnummer>/);
        if (seksjonInEier) {
          console.log(`  → Seksjonsnummer i eierseksjon: ${seksjonInEier[2]}`);
        }
      }
    }
    
  } else {
    console.log("❌ Ingen matrikkelenheter funnet");
  }
}

dumpXml().catch(console.error);
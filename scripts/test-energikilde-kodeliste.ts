// scripts/test-energikilde-kodeliste.ts
// ─────────────────────────────────────────────────────────────────────────────
// Henter komplett kodeliste fra Matrikkelen via KodelisteServiceWS.
// Formål: Avklare hva intern kode-ID 7 betyr for energikilde, og få
// oversikt over alle kodelister inkl. oppvarming og energikilde.
//
// Kjør:  LIVE=1 npx tsx scripts/test-energikilde-kodeliste.ts
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "../loadEnv.ts";
import axios from "axios";
import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";

/* ─────────────────────────── Config ──────────────────────────── */

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;
const IS_LIVE = process.env.LIVE === "1";

const OUTPUT_DIR = path.resolve(import.meta.dirname ?? ".", "../workspace-archive");

/* ─────────────────────────── SOAP XML ────────────────────────── */

function renderGetKodelisterEnkelRequest(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/kodeliste"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Body>
    <sto:getKodelisterEnkel>
      <sto:matrikkelContext>
        <dom:locale>no_NO_B</dom:locale>
        <dom:brukOriginaleKoordinater>true</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId>
          <dom:value>25833</dom:value>
        </dom:koordinatsystemKodeId>
        <dom:systemVersion>trunk</dom:systemVersion>
        <dom:klientIdentifikasjon>kodeliste-test</dom:klientIdentifikasjon>
        <dom:snapshotVersion>
          <dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp>
        </dom:snapshotVersion>
      </sto:matrikkelContext>
    </sto:getKodelisterEnkel>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/* ─────────────────────────── Main ────────────────────────────── */

async function main() {
  if (!IS_LIVE) {
    console.error("Kjør med LIVE=1 for å gjøre faktiske API-kall.");
    process.exit(1);
  }
  if (!USERNAME || !PASSWORD) {
    console.error("Mangler MATRIKKEL_USERNAME / MATRIKKEL_PASSWORD i miljøet.");
    process.exit(1);
  }

  const endpoint = `${BASE_URL}/KodelisteServiceWS`;
  const corrId = crypto.randomUUID();

  console.log("═══════════════════════════════════════════════════");
  console.log("  KODELISTE-OPPSLAG FRA MATRIKKELEN");
  console.log("  (via KodelisteServiceWS.getKodelisterEnkel)");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Endpoint: ${endpoint}`);
  console.log(`CorrId: ${corrId}\n`);

  const xmlRequest = renderGetKodelisterEnkelRequest();

  const resp = await axios.post(endpoint, xmlRequest, {
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      SOAPAction: "getKodelisterEnkel",
    },
    auth: { username: USERNAME, password: PASSWORD },
    timeout: 30_000,
    validateStatus: () => true,
    maxContentLength: 10_000_000, // 10MB - kodelister kan være store
  });

  console.log(`HTTP ${resp.status} – responsstørrelse: ${resp.data.length} bytes`);

  if (resp.status >= 400 || resp.data.includes("<soap:Fault>")) {
    console.error("SOAP Fault mottatt!");
    console.error(resp.data.slice(0, 3000));
    process.exit(1);
  }

  // Lagre rå XML til fil
  const xmlOutFile = path.join(OUTPUT_DIR, "kodeliste-raw-response.xml");
  fs.writeFileSync(xmlOutFile, resp.data, "utf-8");
  console.log(`Rå XML lagret til: ${xmlOutFile}\n`);

  // Parse XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: true,
    trimValues: true,
  });
  const parsed = parser.parse(resp.data);

  // Lagre parsed JSON
  const jsonOutFile = path.join(OUTPUT_DIR, "kodeliste-parsed.json");
  fs.writeFileSync(jsonOutFile, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`Parsed JSON lagret til: ${jsonOutFile}\n`);

  // Naviger til bubble objects
  const envelope = parsed["soap:Envelope"] ?? parsed.Envelope ?? parsed["soapenv:Envelope"];
  const body = envelope?.["soap:Body"] ?? envelope?.Body ?? envelope?.["soapenv:Body"];

  // Finn response-noden
  const responseKeys = Object.keys(body || {});
  console.log("Response-nøkler i body:", responseKeys);

  let responseNode: Record<string, unknown> | undefined;
  for (const key of responseKeys) {
    if (key.includes("getKodelisterEnkelResponse")) {
      responseNode = body[key] as Record<string, unknown>;
      break;
    }
  }

  if (!responseNode) {
    console.error("Fant ikke getKodelisterEnkelResponse i SOAP body");
    console.log("Body:", JSON.stringify(body, null, 2).slice(0, 2000));
    process.exit(1);
  }

  const returnNode = responseNode.return ?? responseNode["ns2:return"] ?? responseNode["ns3:return"];
  if (!returnNode || typeof returnNode !== "object") {
    console.error("Fant ikke <return> i response");
    process.exit(1);
  }

  const transfer = returnNode as Record<string, unknown>;

  // Finn kodelister-IDs (prøv ulike namespace-prefixer)
  const kodelisterIds = transfer.kodelisterIds ?? transfer["ns2:kodelisterIds"] ?? transfer["ns3:kodelisterIds"];
  console.log("KodelisterIds type:", typeof kodelisterIds);

  // Finn bubbleObjects (inneholder selve kodene)
  const bubbleObjects = transfer.bubbleObjects ?? transfer["ns2:bubbleObjects"] ?? transfer["ns3:bubbleObjects"];

  if (!bubbleObjects || typeof bubbleObjects !== "object") {
    console.error("Fant ikke bubbleObjects i transfer");
    console.log("Transfer-nøkler:", Object.keys(transfer));
    process.exit(1);
  }

  // bubbleObjects inneholder en items-liste med kodelister og koder
  const bubbleObj = bubbleObjects as Record<string, unknown>;
  const items = bubbleObj.item ?? bubbleObj["ns2:item"] ?? bubbleObj["ns3:item"] ?? bubbleObj["ns4:item"];
  const itemList = Array.isArray(items) ? items : items ? [items] : [];

  // Hvis ingen items funnet, vis tilgjengelige nøkler
  if (itemList.length === 0) {
    console.log("Ingen items funnet. bubbleObjects-nøkler:", Object.keys(bubbleObj));
  }

  console.log(`Antall bubble objects: ${itemList.length}\n`);

  // Analyser objektene – finn kodelister og koder
  interface KodeInfo {
    id: number;
    kodeverdi: string;
    navn: string;
    type: string;
  }

  interface KodelisteInfo {
    id: number;
    kodeIdClass: string;
    koderIds: number[];
  }

  const kodelister: KodelisteInfo[] = [];
  const koder: KodeInfo[] = [];

  for (const item of itemList) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;

    // Sjekk xsi:type for å identifisere type
    const xsiType = rec["@_xsi:type"] as string | undefined;

    // Finn ID
    const idNode = rec.id ?? rec["dom:id"] ?? rec["ns2:id"] ?? rec["ns3:id"] ?? rec["ns4:id"];
    let id: number | undefined;
    if (idNode && typeof idNode === "object") {
      const idRec = idNode as Record<string, unknown>;
      id = Number(idRec.value ?? idRec["dom:value"] ?? idRec["ns2:value"] ?? idRec["ns3:value"] ?? idRec["ns4:value"]);
    } else if (idNode) {
      id = Number(idNode);
    }

    if (xsiType && xsiType.includes("Kodeliste")) {
      // Dette er en kodeliste
      const kodeIdClass = (rec.kodeIdClass ?? rec["ns2:kodeIdClass"] ?? rec["ns3:kodeIdClass"] ?? rec["ns4:kodeIdClass"]) as string | undefined;
      const koderIdsNode = rec.koderIds ?? rec["ns2:koderIds"] ?? rec["ns3:koderIds"] ?? rec["ns4:koderIds"];
      const koderIdsList: number[] = [];

      if (koderIdsNode && typeof koderIdsNode === "object") {
        const koderIdsRec = koderIdsNode as Record<string, unknown>;
        const koderItems = koderIdsRec.item ?? koderIdsRec["ns2:item"] ?? koderIdsRec["ns3:item"] ?? koderIdsRec["ns4:item"];
        const koderArr = Array.isArray(koderItems) ? koderItems : koderItems ? [koderItems] : [];
        for (const ki of koderArr) {
          if (ki && typeof ki === "object") {
            const kiRec = ki as Record<string, unknown>;
            const val = Number(kiRec.value ?? kiRec["dom:value"] ?? kiRec["ns2:value"] ?? kiRec["ns3:value"] ?? kiRec["ns4:value"]);
            if (Number.isFinite(val)) koderIdsList.push(val);
          } else if (ki) {
            const val = Number(ki);
            if (Number.isFinite(val)) koderIdsList.push(val);
          }
        }
      }

      if (id !== undefined) {
        kodelister.push({
          id,
          kodeIdClass: kodeIdClass ?? "?",
          koderIds: koderIdsList,
        });
      }
    } else {
      // Dette er sannsynligvis en kode
      const kodeverdi = (rec.kodeverdi ?? rec["ns2:kodeverdi"] ?? rec["ns3:kodeverdi"] ?? rec["ns4:kodeverdi"]) as string | undefined;
      const navnNode = rec.navn ?? rec["ns2:navn"] ?? rec["ns3:navn"] ?? rec["ns4:navn"];
      let navn = "";
      if (navnNode && typeof navnNode === "object") {
        const navnRec = navnNode as Record<string, unknown>;
        // Prøv ulike strukturer for navn/tekst
        const navnVal = navnRec["#text"] ?? navnRec.value ?? navnRec["dom:value"] ?? navnRec["ns2:value"] ?? navnRec["ns3:value"] ?? navnRec["ns4:value"];
        if (navnVal !== undefined) {
          navn = String(navnVal);
        } else {
          // Navnefeltet kan ha nested LocalizedString med tekst
          const firstVal = Object.values(navnRec).find((v) => typeof v === "string" && v.length > 0 && !v.startsWith("ns"));
          navn = firstVal ? String(firstVal) : JSON.stringify(navnRec);
        }
      } else if (navnNode) {
        navn = String(navnNode);
      }

      if (id !== undefined) {
        koder.push({
          id,
          kodeverdi: kodeverdi ?? "?",
          navn,
          type: xsiType ?? "?",
        });
      }
    }
  }

  console.log(`Kodelister funnet: ${kodelister.length}`);
  console.log(`Koder funnet: ${koder.length}\n`);

  // Finn energikilde- og oppvarmings-relaterte kodelister
  const energikildeKodeliste = kodelister.find(
    (kl) => kl.kodeIdClass.toLowerCase().includes("energikilde")
  );
  const oppvarmingsKodeliste = kodelister.find(
    (kl) => kl.kodeIdClass.toLowerCase().includes("oppvarming")
  );

  // Vis alle kodelister med sine koder
  console.log("═══════════════════════════════════════════════════");
  console.log("  ALLE KODELISTER");
  console.log("═══════════════════════════════════════════════════\n");

  for (const kl of kodelister) {
    const isTarget =
      kl.kodeIdClass.toLowerCase().includes("energikilde") ||
      kl.kodeIdClass.toLowerCase().includes("oppvarming");
    const marker = isTarget ? " <<<" : "";

    console.log(`  Kodeliste ID ${kl.id}: ${kl.kodeIdClass}${marker}`);
    console.log(`    Koder (${kl.koderIds.length}):`);

    for (const kodeId of kl.koderIds) {
      const kode = koder.find((k) => k.id === kodeId);
      if (kode) {
        console.log(`      ID ${kode.id}: kodeverdi="${kode.kodeverdi}" navn="${kode.navn}"`);
      } else {
        console.log(`      ID ${kodeId}: (ikke funnet i bubble objects)`);
      }
    }
    console.log();
  }

  // Spesialfokus: energikilde og oppvarming
  console.log("═══════════════════════════════════════════════════");
  console.log("  ENERGIKILDE-KODER (fokus)");
  console.log("═══════════════════════════════════════════════════\n");

  if (energikildeKodeliste) {
    console.log(`  Kodeliste: ${energikildeKodeliste.kodeIdClass} (ID ${energikildeKodeliste.id})`);
    console.log(`  Antall koder: ${energikildeKodeliste.koderIds.length}\n`);
    console.log("  ID  | Kodeverdi | Navn");
    console.log("  ----+-----------+---------------------------");
    for (const kodeId of energikildeKodeliste.koderIds) {
      const kode = koder.find((k) => k.id === kodeId);
      if (kode) {
        console.log(`  ${String(kode.id).padStart(3)} | ${kode.kodeverdi.padEnd(9)} | ${kode.navn}`);
      }
    }

    // Spesielt: kode 7
    const kode7 = koder.find((k) => k.id === 7 && energikildeKodeliste.koderIds.includes(7));
    if (kode7) {
      console.log(`\n  >>> KODE 7 ER: "${kode7.navn}" (kodeverdi="${kode7.kodeverdi}") <<<`);
    } else {
      console.log("\n  >>> Kode-ID 7 finnes IKKE i energikilde-kodelisten <<<");
      // Sjekk om noen annen kodeliste har kode 7
      const anyKode7 = koder.find((k) => k.id === 7);
      if (anyKode7) {
        console.log(`  >>> Men kode-ID 7 finnes i annen kontekst: "${anyKode7.navn}" (type=${anyKode7.type}) <<<`);
      }
    }
  } else {
    console.log("  IKKE FUNNET – søker etter alle kodelister med 'energi' i navnet...");
    for (const kl of kodelister) {
      if (kl.kodeIdClass.toLowerCase().includes("energi")) {
        console.log(`    ${kl.kodeIdClass} (ID ${kl.id})`);
      }
    }
    // Fallback: vis alle koder som kan være energikilde-relaterte
    console.log("\n  Alle koder med 'energi', 'fjernvarme', 'varme' i navn:");
    for (const k of koder) {
      if (
        k.navn.toLowerCase().includes("energi") ||
        k.navn.toLowerCase().includes("fjernvarme") ||
        k.navn.toLowerCase().includes("varme") ||
        k.navn.toLowerCase().includes("elektrisk") ||
        k.navn.toLowerCase().includes("olje") ||
        k.navn.toLowerCase().includes("gass") ||
        k.navn.toLowerCase().includes("brensel")
      ) {
        console.log(`    ID ${k.id}: kodeverdi="${k.kodeverdi}" navn="${k.navn}" type=${k.type}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  OPPVARMINGS-KODER (fokus)");
  console.log("═══════════════════════════════════════════════════\n");

  if (oppvarmingsKodeliste) {
    console.log(`  Kodeliste: ${oppvarmingsKodeliste.kodeIdClass} (ID ${oppvarmingsKodeliste.id})`);
    console.log(`  Antall koder: ${oppvarmingsKodeliste.koderIds.length}\n`);
    console.log("  ID  | Kodeverdi | Navn");
    console.log("  ----+-----------+---------------------------");
    for (const kodeId of oppvarmingsKodeliste.koderIds) {
      const kode = koder.find((k) => k.id === kodeId);
      if (kode) {
        console.log(`  ${String(kode.id).padStart(3)} | ${kode.kodeverdi.padEnd(9)} | ${kode.navn}`);
      }
    }
  } else {
    console.log("  IKKE FUNNET – søker etter alle kodelister med 'oppvarming' i navnet...");
    for (const kl of kodelister) {
      if (kl.kodeIdClass.toLowerCase().includes("oppvarming")) {
        console.log(`    ${kl.kodeIdClass} (ID ${kl.id})`);
      }
    }
  }

  // Lagre strukturert utdata
  const outputData = {
    kodelister: kodelister.map((kl) => ({
      ...kl,
      koder: kl.koderIds.map((id) => koder.find((k) => k.id === id)).filter(Boolean),
    })),
    energikildeKodeliste: energikildeKodeliste
      ? {
          ...energikildeKodeliste,
          koder: energikildeKodeliste.koderIds
            .map((id) => koder.find((k) => k.id === id))
            .filter(Boolean),
        }
      : null,
    oppvarmingsKodeliste: oppvarmingsKodeliste
      ? {
          ...oppvarmingsKodeliste,
          koder: oppvarmingsKodeliste.koderIds
            .map((id) => koder.find((k) => k.id === id))
            .filter(Boolean),
        }
      : null,
  };

  const structuredOutFile = path.join(OUTPUT_DIR, "kodeliste-strukturert.json");
  fs.writeFileSync(structuredOutFile, JSON.stringify(outputData, null, 2), "utf-8");
  console.log(`\nStrukturert data lagret til: ${structuredOutFile}`);

  console.log("\n═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal feil:", err);
  process.exit(1);
});

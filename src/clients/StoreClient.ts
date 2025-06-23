// src/clients/StoreClient.ts
// -----------------------------------------------------------------------------
//  StoreClient – henter og parser «Bygg»-data via Matrikkels StoreServiceWS
// -----------------------------------------------------------------------------

import axios, { AxiosRequestConfig } from "axios";
import { XMLParser } from "fast-xml-parser";
import proj4 from "proj4";
import { dumpSoap, type SoapPhase } from "../utils/soapDump.ts";
import { randomUUID } from "crypto";
import { mapBygningstypeId, getBygningstypeBeskrivelse } from "../utils/bygningstypeMapping.ts";
import "../../loadEnv.ts"; 

/* ─────────────────────────── Miljøflagg ─────────────────────────── */
const LOG_SOAP = process.env.LOG_SOAP === "1";
const IS_LIVE = process.env.LIVE === "1";

/* ───────────────── Koordinatsystem-definisjoner ─────────────────── */
proj4.defs("EPSG:25833", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
export const PBE_EPSG = "EPSG:32632" as const;
export type EpsgCode = "EPSG:25833" | "EPSG:32632";

/* ───────────────────── Typedefinisjoner ─────────────────────────── */
export interface RepPoint {
  east: number;
  north: number;
  epsg: EpsgCode;
  toPBE(): { east: number; north: number };
}

export interface ByggInfo {
  id: number;
  byggeaar?: number;
  bruksarealM2?: number;
  representasjonspunkt?: RepPoint;
  bygningstypeKodeId?: number;
  bygningstypeKode?: string;  // Den faktiske 3-sifrede koden
  bygningsnummer?: string;  // Bygningsnummer for Enova-oppslag
  bygningstypeBeskrivelse?: string;  // F.eks. "Rekkehus"
}

/* ──────────────────── ID-typer for getObjectXml ─────────────────── */
const ID_NS = {
  ByggId: {
    prefix: "byg",
    ns: "http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/bygning",
  },
  MatrikkelenhetId: {
    prefix: "mat",
    ns: "http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet",
  },
} as const;
type IdType = keyof typeof ID_NS;

/* ───────────────────────── Hjelpefunksjoner ─────────────────────── */

/** Rekursiv – returnerer første *rene* tall i node/streng. Ignorerer strenger som inneholder bokstaver. */
function numDeepStrict(node: unknown): number | undefined {
  if (node == null) return undefined;
  if (typeof node === "number") return node;
  if (typeof node === "string") {
    const cleaned = node.replace(/\s+/g, "").replace(",", ".");
    if (/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
    return undefined; // strengen inneholder noe annet (f.eks. «m2»)
  }
  if (typeof node === "object") {
    // typisk wrapper: { 'dom:value': '162', '@_unitCode': 'm2' }
    // prøv kjente feltnavn først, så alle verdier
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const o = node as Record<string, unknown>;
    return (
      numDeepStrict(o["dom:value"]) ||
      numDeepStrict(o.value) ||
      Object.values(o).map(numDeepStrict).find(Number.isFinite)
    );
  }
  return undefined;
}

/** Gå rekursivt i XML-treet og finn første forekomst av *localName* */
function find(node: unknown, local: string): unknown {
  if (node == null || typeof node !== "object") return undefined;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const obj = node as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (key.split(":").pop() === local) return val;
    const hit = find(val, local);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Ekstraher tall ved å prøve flere taggnavn i rekkefølge */
function extractNumber(tree: unknown, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const n = numDeepStrict(find(tree, k));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Hent representasjonspunkt fra <position><x>/<y> eller <øst>/<nord>/<aust>/<east>/<north> */
function extractRepPoint(
  tree: unknown
): { east: number; north: number } | undefined {
  const pos = find(tree, "position");
  const x = numDeepStrict(
    find(pos ?? tree, "x") ??
      find(tree, "øst") ??
      find(tree, "aust") ??
      find(tree, "east")
  );
  const y = numDeepStrict(
    find(pos ?? tree, "y") ?? find(tree, "nord") ?? find(tree, "north")
  );
  return Number.isFinite(x) && Number.isFinite(y)
    ? { east: x!, north: y! }
    : undefined;
}

/** Hent byggeår fra bygningsstatusHistorikker */
function extractByggeaar(tree: unknown): number | undefined {
  // Finn bygningsstatusHistorikker eller andre årstal-kilder
  const historikker = find(tree, "bygningsstatusHistorikker") ?? find(tree, "bygningstatusHistorikker");
  
  if (historikker && typeof historikker === "object") {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const hist = historikker as Record<string, unknown>;
    const items = hist.item ?? Object.values(hist);
    
    if (Array.isArray(items)) {
      for (const item of items) {
        const dato = find(item, "dato");
        if (dato && typeof dato === "object") {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const datoObj = dato as Record<string, unknown>;
          const dateStr = datoObj.date;
          if (typeof dateStr === "string") {
            const year = parseInt(dateStr.substring(0, 4), 10);
            if (year > 1800 && year < 2100) return year;
          }
        }
      }
    }
  }
  
  // Fallback: søk etter andre byggeår-felter
  const fallbackYear = extractNumber(tree, "byggeaar", "byggeår", "byggaar");
  
  // 1901 ser ut til å være en default-verdi i Matrikkelen
  if (fallbackYear === 1901) {
    console.log("⚠️  Byggeår 1901 kan være en default-verdi i Matrikkelen");
  }
  
  return fallbackYear;
}

/** Hent bygningstype-kode */
function extractBygningstypeKodeId(tree: unknown): number | undefined {
  // Søk spesifikt etter bygningstypeKodeId (som har nested value-struktur)
  const bygningstypeKodeId = find(tree, "bygningstypeKodeId");
  if (bygningstypeKodeId && typeof bygningstypeKodeId === "object") {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const kodeObj = bygningstypeKodeId as Record<string, unknown>;
    const value = kodeObj.value || kodeObj["dom:value"];
    if (value) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        // VIKTIG: Matrikkelen returnerer ofte bare intern kode-ID (f.eks. 8)
        // som må mappes til faktisk bygningstype-kode (f.eks. 131 for rekkehus)
        // Dette krever trolig bruk av findAlleBygningstypeKoder fra BygningService
        if (process.env.DEBUG_BYGNINGSTYPE === "1") {
          console.warn(`Mottok intern bygningstype-kode ID: ${num} - dette må mappes til 3-sifret bygningstype`);
        }
        return num;
      }
    }
  }
  
  // Fallback til andre mulige felt-navn
  const direkteKode = extractNumber(tree, 
    "bygningstypeKode", 
    "byggningstype", 
    "bygningstype",
    "bygningstypenummer",
    "bygningskode"
  );
  if (Number.isFinite(direkteKode)) return direkteKode;
  
  return undefined;
}

/** Hent bygningsnummer fra XML (unikt ID for bygget) */
function extractBygningsnummer(tree: unknown): string | undefined {
  // Bygningsnummer kan ligge under forskjellige navn/namespaces
  const bygningsnummer = find(tree, "bygningsnummer") || 
                        find(tree, "byggnummer") ||
                        find(tree, "byggNr");
  
  if (bygningsnummer) {
    if (typeof bygningsnummer === "string") {
      return bygningsnummer;
    }
    if (typeof bygningsnummer === "number") {
      return String(bygningsnummer);
    }
  }
  
  return undefined;
}

/** Hent totalt bruksareal fra etasjedata */
function extractBruksareal(tree: unknown): number | undefined {
  // Debug: sjekk om vi har ufullstendigAreal flagg
  const ufullstendig = find(tree, "ufullstendigAreal");
  if (ufullstendig === "true" || ufullstendig === true) {
    console.log("⚠️  Bygning har ufullstendigAreal=true");
  }
  
  // Prøv først etasjedata (summert fra alle etasjer)
  const etasjedata = find(tree, "etasjedata");
  if (etasjedata) {
    const totalt = extractNumber(etasjedata, "bruksarealTotalt");
    if (Number.isFinite(totalt) && totalt! > 0) {
      console.log(`✅ Fant bruksareal i etasjedata: ${totalt} m²`);
      return totalt;
    }
  }
  
  // Prøv så individuelle etasjer og summer dem
  const etasjer = find(tree, "etasjer");
  if (etasjer && typeof etasjer === "object") {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const etasjerObj = etasjer as Record<string, unknown>;
    const items = etasjerObj.item ?? Object.values(etasjerObj);
    
    if (Array.isArray(items)) {
      let totalSum = 0;
      for (const etasje of items) {
        const areal = extractNumber(etasje, "bruksarealTotalt", "bruksareal");
        if (Number.isFinite(areal)) totalSum += areal!;
      }
      if (totalSum > 0) {
        console.log(`✅ Summert bruksareal fra ${items.length} etasjer: ${totalSum} m²`);
        return totalSum;
      }
    }
  }
  
  // Sjekk alternativt areal i kommunalTilleggsdel
  const kommunalDel = find(tree, "kommunalTilleggsdel");
  if (kommunalDel) {
    const altAreal = extractNumber(kommunalDel, "alternativtArealBygning");
    if (Number.isFinite(altAreal) && altAreal! > 0) {
      console.log(`✅ Bruker alternativtArealBygning: ${altAreal} m²`);
      return altAreal;
    }
  }
  
  // Fallback til normale søk
  const fallback = extractNumber(
    tree,
    "bruksarealTotalt",
    "bruksarealM2", 
    "bruksareal",
    "bebygdAreal"
  );
  
  if (Number.isFinite(fallback) && fallback! > 0) {
    console.log(`✅ Fant bruksareal via fallback: ${fallback} m²`);
  } else {
    console.log("❌ Ingen bruksareal funnet i bygningsdata");
  }
  
  return fallback;
}

/* ─────────────────────────── StoreClient ────────────────────────── */
export class StoreClient {
  private readonly xml = new XMLParser({ ignoreAttributes: false });

  constructor(
    private readonly baseUrl: string = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1/StoreServiceWS",
    private readonly username?: string,
    private readonly password?: string
  ) {}

  /** Rå SOAP-respons for vilkårlig ID (Brukes av index.ts) */
  async getObjectXml(
    id: number | string,
    idType: IdType = "ByggId",
    ctxKoordsys = 25833
  ): Promise<string> {
    const body = buildGenericRequestXml(id, idType, ctxKoordsys);
    return this.soapCall(body, "getObject");
  }

  /** Parsed ByggInfo */
  async getObject(id: number, ctxKoordsys = 25833): Promise<ByggInfo> {
    const raw = await this.getObjectXml(id, "ByggId", ctxKoordsys);
    const tree = this.xml.parse(raw);

    // Debug: logg XML-struktur for å finne bygningstype
    if (process.env.DEBUG_BYGNINGSTYPE === "1") {
      console.log("\n=== DEBUG: Søker etter bygningstype i XML-struktur ===");
      console.log("Bygg ID:", id);
      
      // Søk etter mulige bygningstype-felt
      const muligeFelt = ["bygningstype", "bygningstypeKode", "bygningstypenummer", "bygningskode"];
      for (const felt of muligeFelt) {
        const funnet = find(tree, felt);
        if (funnet) {
          console.log(`Fant '${felt}':`, JSON.stringify(funnet, null, 2));
        }
      }
      
      // Sjekk også koder-struktur
      const koder = find(tree, "koder");
      if (koder) {
        console.log("Fant 'koder':", JSON.stringify(koder, null, 2));
      }
      
      // Vis første del av rå XML for analyse
      if (process.env.DEBUG_BYGNINGSTYPE_FULL === "1") {
        console.log("\nRå XML (første 2000 tegn):");
        console.log(raw.substring(0, 2000));
      }
      
      // Lagre XML til fil for første bygg for analyse
      if (process.env.SAVE_XML === "1" && id === 286115596) {
        const fs = await import("fs/promises");
        await fs.writeFile(`/tmp/bygg_${id}.xml`, raw);
        console.log(`XML lagret til /tmp/bygg_${id}.xml`);
      }
    }

    // Hent byggeår fra bygningsstatusHistorikker (første dato funnet)
    const byggeaar = extractByggeaar(tree);
    
    // Hent totalt bruksareal fra etasjedata (ikke bebygdAreal som er 1m²)
    const bruksarealM2 = extractBruksareal(tree);
    const repXY = extractRepPoint(tree);
    
    // Hent bygningstype-kode
    const bygningstypeKodeId = extractBygningstypeKodeId(tree);
    
    // Hent bygningsnummer (unikt ID for bygget)
    const bygningsnummer = extractBygningsnummer(tree);

    const representasjonspunkt: RepPoint | undefined = repXY
      ? {
          east: repXY.east,
          north: repXY.north,
          epsg: "EPSG:25833",
          toPBE() {
            const [x, y] = proj4("EPSG:25833", PBE_EPSG, [
              this.east,
              this.north,
            ]);
            return { east: x, north: y };
          },
        }
      : undefined;

    // Mapper intern bygningstype-ID til faktisk 3-sifret kode
    let bygningstypeKode: string | undefined;
    let bygningstypeBeskrivelse: string | undefined;
    
    if (bygningstypeKodeId && this.username && this.password) {
      try {
        bygningstypeKode = await mapBygningstypeId(
          bygningstypeKodeId,
          this.baseUrl.replace("/StoreServiceWS", ""),
          this.username,
          this.password
        );
        
        bygningstypeBeskrivelse = await getBygningstypeBeskrivelse(
          bygningstypeKodeId,
          this.baseUrl.replace("/StoreServiceWS", ""),
          this.username,
          this.password
        );
      } catch (error) {
        console.warn(`Kunne ikke mappe bygningstype-ID ${bygningstypeKodeId}:`, error);
      }
    }

    return { 
      id, 
      byggeaar, 
      bruksarealM2, 
      representasjonspunkt, 
      bygningstypeKodeId,
      bygningstypeKode,
      bygningstypeBeskrivelse,
      bygningsnummer
    };
  }

  /* ────────────────────── SOAP-helper med logging ───────────────────── */
  private async soapCall(xml: string, action: string): Promise<string> {
    const corrId = randomUUID();
    const cfg: AxiosRequestConfig = {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${action}"`,
      },
      timeout: 20_000,
      auth:
        this.username && this.password
          ? { username: this.username, password: this.password }
          : undefined,
      validateStatus: () => true,
    };

    if (LOG_SOAP)
      console.log(
        `\n===== SOAP Request » ${action} (${corrId}) =====\n${xml}\n`
      );
    if (IS_LIVE) await dumpSoap(corrId, "request", xml);

    const { data, status } = await axios.post(this.baseUrl, xml, cfg);

    const phase: SoapPhase =
      status >= 400 ||
      (typeof data === "string" && data.includes("<soap:Fault>"))
        ? "fault"
        : "response";

    if (IS_LIVE)
      await dumpSoap(
        corrId,
        phase,
        typeof data === "string" ? data : JSON.stringify(data)
      );
    if (LOG_SOAP)
      console.log(
        `===== ${
          phase === "fault" ? "SOAP Fault" : `SOAP Response (HTTP ${status})`
        } (${corrId}) =====\n`
      );

    if (phase === "fault")
      throw new Error(`SOAP fault fra StoreServiceWS (corrId=${corrId})`);
    if (status >= 400) throw new Error(`HTTP ${status} fra StoreServiceWS`);

    return String(data);
  }
}

/* ───────────────────── XML-builder for getObjectXml ────────────────── */
function buildGenericRequestXml(
  id: number | string,
  idType: IdType,
  ctxKoordsys: number
): string {
  const { prefix, ns } = ID_NS[idType];

  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store"
               xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
               xmlns:${prefix}="${ns}"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soap:Body>
    <sto:getObject>
      <sto:id xsi:type="${prefix}:${idType}">
        <dom:value>${id}</dom:value>
      </sto:id>
      <sto:matrikkelContext>
        <dom:locale>no_NO_B</dom:locale>
        <dom:brukOriginaleKoordinater>true</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${ctxKoordsys}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>trunk</dom:systemVersion>
        <dom:klientIdentifikasjon>store-client</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp></dom:snapshotVersion>
      </sto:matrikkelContext>
    </sto:getObject>
  </soap:Body>
</soap:Envelope>`;
}

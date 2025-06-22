// src/clients/StoreClient.ts
// -----------------------------------------------------------------------------
//  StoreClient – henter og parser «Bygg»-data via Matrikkels StoreServiceWS
// -----------------------------------------------------------------------------

import axios, { AxiosRequestConfig } from "axios";
import { XMLParser } from "fast-xml-parser";
import proj4 from "proj4";
import { dumpSoap, type SoapPhase } from "../utils/soapDump.ts";
import { randomUUID } from "crypto";
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
  return extractNumber(tree, "byggeaar", "byggeår", "byggaar");
}

/** Hent bygningstype-kode */
function extractBygningstypeKodeId(tree: unknown): number | undefined {
  return extractNumber(tree, "bygningstypeKodeId", "byggningstype", "bygningstype");
}

/** Hent totalt bruksareal fra etasjedata */
function extractBruksareal(tree: unknown): number | undefined {
  // Prøv først etasjedata (summert fra alle etasjer)
  const etasjedata = find(tree, "etasjedata");
  if (etasjedata) {
    const totalt = extractNumber(etasjedata, "bruksarealTotalt");
    if (Number.isFinite(totalt)) return totalt;
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
      if (totalSum > 0) return totalSum;
    }
  }
  
  // Fallback til normale søk
  return extractNumber(
    tree,
    "bruksarealTotalt",
    "bruksarealM2", 
    "bruksareal",
    "bebygdAreal"
  );
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

    // Hent byggeår fra bygningsstatusHistorikker (første dato funnet)
    const byggeaar = extractByggeaar(tree);
    
    // Hent totalt bruksareal fra etasjedata (ikke bebygdAreal som er 1m²)
    const bruksarealM2 = extractBruksareal(tree);
    const repXY = extractRepPoint(tree);
    
    // Hent bygningstype-kode
    const bygningstypeKodeId = extractBygningstypeKodeId(tree);

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

    return { id, byggeaar, bruksarealM2, representasjonspunkt, bygningstypeKodeId };
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

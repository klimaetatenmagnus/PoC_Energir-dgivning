// src/clients/StoreClient.ts – patched 2025-06-19
// -----------------------------------------------------------------------------
//  StoreClient – henter og parser bobler fra Matrikkels StoreServiceWS.
//  Endringer i denne versjonen:
//    • Robust håndtering av base-URL: godtar både ROOT og …/StoreServiceWS
//    • Mer talende SOAP-feilmeldinger (inkluderer <faultstring>)
//    • Ingen annen funksjonell endring – API signaturen er uendret
// -----------------------------------------------------------------------------

import axios, { AxiosRequestConfig } from "axios";
import { XMLParser } from "fast-xml-parser";
import proj4 from "proj4";
import { dumpSoap, type SoapPhase } from "../../src/utils/soapDump.ts";
import { randomUUID } from "crypto";

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
export type IdType = keyof typeof ID_NS;

/* ───────────────────────── Hjelpefunksjoner ─────────────────────── */
const parser = new XMLParser({ ignoreAttributes: false });

function numDeepStrict(node: unknown): number | undefined {
  if (node == null) return undefined;
  if (typeof node === "number") return node;
  if (typeof node === "string") {
    const cleaned = node.replace(/\s+/g, "").replace(",", ".");
    if (/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
    return undefined;
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    return (
      numDeepStrict(o["dom:value"]) ||
      numDeepStrict(o.value) ||
      Object.values(o).map(numDeepStrict).find(Number.isFinite)
    );
  }
  return undefined;
}

function find(node: unknown, local: string): unknown {
  if (node == null || typeof node !== "object") return undefined;
  const obj = node as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (key.split(":").pop() === local) return val;
    const hit = find(val, local);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function extractNumber(tree: unknown, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const n = numDeepStrict(find(tree, k));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

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

/* ─────────────────────────── StoreClient ────────────────────────── */
export class StoreClient {
  private readonly xml = parser;
  /** Full URL til SOAP-endpoint (garantert å ende med …/StoreServiceWS). */
  private readonly storeUrl: string;

  constructor(
    baseUrl: string = "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1", // godtar root eller full sti
    private readonly username?: string,
    private readonly password?: string
  ) {
    this.storeUrl = /StoreServiceWS$/i.test(baseUrl)
      ? baseUrl.replace(/\/$/, "")
      : baseUrl.replace(/\/$/, "") + "/StoreServiceWS";
  }

  /** Rå SOAP-respons for vilkårlig ID (brukes av resolveBuildingData) */
  async getObjectXml(
    id: number | string,
    idType: IdType = "ByggId",
    ctxKoordsys = 25833
  ): Promise<string> {
    const body = buildGenericRequestXml(id, idType, ctxKoordsys);
    return this.soapCall(body, "getObject");
  }

  /** Parse «Bygg»-boble til praktisk struktur. */
  async getObject(id: number, ctxKoordsys = 25833): Promise<ByggInfo> {
    const raw = await this.getObjectXml(id, "ByggId", ctxKoordsys);
    const tree = this.xml.parse(raw);

    const byggeaar = extractNumber(tree, "byggeaar", "byggeår", "byggaar");
    const bruksarealM2 = extractNumber(
      tree,
      "bruksarealM2",
      "bruksareal",
      "bebygdAreal"
    );
    const rep = extractRepPoint(tree);

    const representasjonspunkt: RepPoint | undefined = rep
      ? {
          east: rep.east,
          north: rep.north,
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

    return { id, byggeaar, bruksarealM2, representasjonspunkt };
  }

  /* ────────────────────── SOAP helper med logging ───────────────────── */
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

    const { data, status } = await axios.post<string>(this.storeUrl, xml, cfg);

    const body = typeof data === "string" ? data : String(data);
    const isFault = status >= 400 || body.includes("<soap:Fault>");
    const phase: SoapPhase = isFault ? "fault" : "response";

    if (IS_LIVE) await dumpSoap(corrId, phase, body);
    if (LOG_SOAP)
      console.log(
        `===== ${
          isFault ? "SOAP Fault" : `SOAP Response (HTTP ${status})`
        } (${corrId}) =====\n`
      );

    if (isFault) {
      const m = body.match(/<faultstring>([\s\S]*?)<\/faultstring>/i);
      const detail = m ? m[1].replace(/<[^>]+>/g, "").trim() : "ukjent";
      throw new Error(
        `SOAP fault fra StoreServiceWS: ${detail} (corrId=${corrId})`
      );
    }
    return body;
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
        <dom:brukOriginaleKoordinater>false</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${ctxKoordsys}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>trunk</dom:systemVersion>
        <dom:klientIdentifikasjon>store-client</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp></dom:snapshotVersion>
      </sto:matrikkelContext>
    </sto:getObject>
  </soap:Body>
</soap:Envelope>`;
}

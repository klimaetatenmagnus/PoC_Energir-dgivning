// src/clients/StoreClient.ts
// -----------------------------------------------------------------------------
//  StoreClient – henter komplette «Bygg»- og andre domeneobjekter via
//  StoreServiceWS (Matrikkel API)
// -----------------------------------------------------------------------------

import axios, { AxiosRequestConfig } from "axios";
import { XMLParser } from "fast-xml-parser";
import proj4 from "proj4";
import { dumpSoap, type SoapPhase } from "../utils/soapDump.ts";
import { randomUUID } from "crypto";

/* ─────────────────────────── Miljø ─────────────────────────── */
const LOG_SOAP = process.env.LOG_SOAP === "1";
const IS_LIVE = process.env.LIVE === "1";

/* ────────────────── Koordinatsystem-defs ───────────────────── */
proj4.defs("EPSG:25833", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
export const PBE_EPSG = "EPSG:32632" as const;
export type EpsgCode = "EPSG:25833" | "EPSG:32632";

/* ───────────────────── Domenetyper ─────────────────────────── */
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

function maybeNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/* ───────────────────── SOAP-klient ─────────────────────────── */
const DEFAULT_URL =
  "https://prodtest.matrikkel.no/matrikkelapi/wsapi/v1/StoreServiceWS";

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

export class StoreClient {
  private readonly xml = new XMLParser({ ignoreAttributes: false });

  constructor(
    private readonly baseUrl: string = DEFAULT_URL,
    private readonly username?: string,
    private readonly password?: string
  ) {}

  /* ---------- 3.1  Rå XML for vilkårlig ID ---------- */
  async getObjectXml(
    id: number | string,
    idType: IdType = "MatrikkelenhetId",
    ctxKoordsys = 25833
  ): Promise<string> {
    const body = buildGenericRequestXml(id, idType, ctxKoordsys);
    return this.soapCall(body, "getObject");
  }

  /* ---------- 3.2  Hent ByggInfo som struktur ---------- */
  async getObject(byggId: number, ctxKoordsys = 25833): Promise<ByggInfo> {
    const raw = await this.getObjectXml(byggId, "ByggId", ctxKoordsys);

    // --- A.  Regex-plukk direkte fra hele SOAP-strengen ---------------
    const rx = (tag: string, digits = "\\d+") =>
      new RegExp(
        `<[^>]*:?${tag}[^>]*>\\s*(${digits})\\s*</[^>]*:?${tag}>`,
        "i"
      );

    const byggaarRX = Number(rx("byggeaar", "\\d{3,4}").exec(raw)?.[1]);
    const braRX = Number(rx("bruksarealM2").exec(raw)?.[1]);
    const austRX = Number(rx("aust").exec(raw)?.[1]);
    const nordRX = Number(rx("nord").exec(raw)?.[1]);

    // --- B.  Fallback – rekursiv søk (skulle regex feile helt) --------
    const tree = this.xml.parse(raw);

    const find = (o: any, local: string): any => {
      if (!o || typeof o !== "object") return undefined;
      for (const [k, v] of Object.entries(o)) {
        if (k.split(":").pop() === local) return Array.isArray(v) ? v[0] : v;
        const hit = find(v, local);
        if (hit !== undefined) return hit;
      }
      return undefined;
    };

    const byggaar = Number.isFinite(byggaarRX)
      ? byggaarRX
      : Number(find(tree, "byggeaar"));
    const bra = Number.isFinite(braRX)
      ? braRX
      : Number(find(tree, "bruksarealM2"));
    const aust = Number.isFinite(austRX) ? austRX : Number(find(tree, "aust"));
    const nord = Number.isFinite(nordRX) ? nordRX : Number(find(tree, "nord"));

    // --- C.  Representasjonspunkt og retur ----------------------------
    const repPoint: RepPoint | undefined =
      Number.isFinite(aust) && Number.isFinite(nord)
        ? {
            east: aust,
            north: nord,
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

    return {
      id: byggId,
      byggeaar: Number.isFinite(byggaar) ? byggaar : undefined,
      bruksarealM2: Number.isFinite(bra) ? bra : undefined,
      representasjonspunkt: repPoint,
    };
  }

  /* ---------- 3.3  SOAP-helper m/logg & dump ---------- */
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

    if (IS_LIVE) await dumpSoap(corrId, "request", xml);
    if (LOG_SOAP)
      console.log(
        `\n===== SOAP Request (${action}, ${corrId}) =====\n${xml}\n`
      );

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
      throw new Error(`SOAP ${status} fra StoreServiceWS (corrId=${corrId})`);
    if (status >= 400) throw new Error(`HTTP ${status} fra StoreServiceWS`);

    return String(data);
  }
}

/* ────────────────── 4.  XML-builder ────────────────── */
function buildGenericRequestXml(
  id: number | string,
  idType: IdType,
  ctxKoordsys: number
): string {
  const { prefix, ns } = ID_NS[idType];

  /* transformasjon AV – schema krever likevel taggen */
  const transformBlock = `
        <dom:brukOriginaleKoordinater>true</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId>
          <dom:value>${ctxKoordsys}</dom:value>
        </dom:koordinatsystemKodeId>`;

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
        <dom:locale>no_NO_B</dom:locale>${transformBlock}
        <dom:systemVersion>trunk</dom:systemVersion>
        <dom:klientIdentifikasjon>store-client</dom:klientIdentifikasjon>
        <dom:snapshotVersion>
          <dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp>
        </dom:snapshotVersion>
      </sto:matrikkelContext>
    </sto:getObject>
  </soap:Body>
</soap:Envelope>`;
}

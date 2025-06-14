// -----------------------------------------------------------------------------
//  StoreClient – henter komplette «Bygg»-bobler via StoreServiceWS
// -----------------------------------------------------------------------------

import axios, { AxiosRequestConfig } from "axios";
import { XMLParser } from "fast-xml-parser";
import proj4 from "proj4";
import { dumpSoap } from "../utils/soapDump";

// ──────────────────────────────────────────────────────────────────────────────
// 1.  Koordinatsystem-definisjoner  (EPSG:25833 ↔ 32632)
// ──────────────────────────────────────────────────────────────────────────────
proj4.defs("EPSG:25833", "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs");
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
export const PBE_EPSG = "EPSG:32632" as const;
export type EpsgCode = "EPSG:25833" | "EPSG:32632";

// ──────────────────────────────────────────────────────────────────────────────
// 2.  Domenetyper (+ hjelpe­funksjoner)
// ──────────────────────────────────────────────────────────────────────────────
export interface RepPoint {
  east: number;
  north: number;
  epsg: EpsgCode;
  /**  Konverterer til PBE-systemet (EPSG 32632).  */
  toPBE(): { east: number; north: number };
}

export interface ByggInfo {
  id: number;
  byggeaar?: number;
  bruksarealM2?: number;
  representasjonspunkt?: RepPoint;
}

function maybeNumber(v: any): number | undefined {
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

// ──────────────────────────────────────────────────────────────────────────────
// 3.  HTTP/SOAP-klienten
// ──────────────────────────────────────────────────────────────────────────────
const DEFAULT_URL =
  process.env.STORE_BASE_URL ??
  "https://ws.geonorge.no/matrikkelapi/wsapi/v1/service/store/StoreServiceWS";

export class StoreClient {
  private readonly baseUrl: string;
  private readonly auth?: { username: string; password: string };
  private readonly xml = new XMLParser({ ignoreAttributes: false });

  constructor(
    baseUrl: string = DEFAULT_URL,
    username?: string,
    password?: string
  ) {
    this.baseUrl = baseUrl;
    if (username && password) this.auth = { username, password };
  }

  /**  Hoved-API: hent ett bygg  */
  async getObject(byggId: number, ctxKoordsys = 25833): Promise<ByggInfo> {
    const body = buildRequestXml(byggId, ctxKoordsys);
    const raw = await this.soapCall(body, "getObject");

    const parsed: any =
      this.xml.parse(raw)["soap:Envelope"]["soap:Body"][
        "ns2:getObjectResponse"
      ]?.["ns2:return"];

    if (!parsed) {
      throw new Error("Uventet SOAP-respons – mangler getObjectResponse");
    }

    const bygg = parsed["no.sk:Bygg"] ?? parsed;

    const rp = bygg?.representasjonspunkt;
    const repPoint: RepPoint | undefined =
      rp && rp.aust && rp.nord
        ? {
            east: Number(rp.aust),
            north: Number(rp.nord),
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
      byggeaar: maybeNumber(bygg.byggeaar),
      bruksarealM2: maybeNumber(bygg.bruksarealM2),
      representasjonspunkt: repPoint,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3.1  Intern SOAP-helper
  // ──────────────────────────────────────────────────────────────────────────
  private async soapCall(xml: string, action: string): Promise<string> {
    const cfg: AxiosRequestConfig = {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${action}"`,
      },
      timeout: 20_000,
    };
    if (this.auth) cfg.auth = this.auth;

    if (process.env.LOG_SOAP) dumpSoap("store", "request", xml);

    const { data, status } = await axios.post(this.baseUrl, xml, cfg);

    if (process.env.LOG_SOAP) {
      dumpSoap(
        "store",
        `http${status}`,
        typeof data === "string" ? data : JSON.stringify(data)
      );
    }

    // Både suksess og fault kan komme med HTTP 200 – sjekk derfor innholdet
    if (typeof data === "string" && data.includes("<soap:Fault>")) {
      throw new Error("SOAP Fault mottatt – detaljer i dump");
    }

    if (status >= 400) throw new Error(`HTTP ${status}`);
    return String(data);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4.  XML-builder
// ──────────────────────────────────────────────────────────────────────────────
function buildRequestXml(byggId: number, ctxKoordsys: number): string {
  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store"
               xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
               xmlns:byg="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/bygning"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soap:Body>
    <sto:getObject>
      <sto:id xsi:type="byg:ByggId">
        <dom:value>${byggId}</dom:value>
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

// -----------------------------------------------------------------------------
// src/clients/MatrikkelClient.ts
// -----------------------------------------------------------------------------
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { randomUUID } from "crypto";
import { dumpSoap } from "../utils/soapDump.ts";
import type { SoapPhase } from "../utils/soapDump.ts";
import { debugLog } from "../../services/building-info-service/logging.ts";

type SoapRecord = Record<string, unknown>;

function asRecord(value: unknown): SoapRecord | undefined {
  return typeof value === "object" && value !== null
    ? (value as SoapRecord)
    : undefined;
}

function extractNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === "object") {
    const record = value as SoapRecord;
    if ("value" in record) {
      return extractNumber(record.value);
    }
    for (const candidate of Object.values(record)) {
      const found = extractNumber(candidate);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/* ─────────────────────────── Miljø ─────────────────────────── */
const LOG = process.env.LOG_SOAP === "1";
const LIVE = process.env.LIVE === "1";

/* ───────────────────── Domene-typer ────────────────────────── */
export interface VegadresseIdent {
  kommunenummer: string;
  adressekode: number; // femsifret vegkode
  husnummer: number;
  bokstav?: string | null;
}

export interface MatrikkelehetsøkModel {
  kommunenummer: string | number;
  gardsnummer: number;
  bruksnummer: number;
}

export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: string | { timestamp: string };
}

/* ───────────────────── Klientklasse ───────────────────────── */
export class MatrikkelClient {
  constructor(
    private readonly base: string, // «…/wsapi/v1»
    private readonly user: string,
    private readonly pass: string
  ) {}

  /* ================ 1. Hjelpefunksjoner ===================== */

  private serviceUrl(svc: string): string {
    // 1) full URL sendt inn? → bruk som den er
    if (svc.includes("://")) return svc;

    // 2) base already *is* the full endpoint? → bruk base som den er
    //    (hindrer …WS/…WS-duplikat)
    if (this.base.replace(/\/$/, "").endsWith(`/${svc}`)) return this.base;

    // 3) ellers: bygg normal sti   “…/service/<domene>/<svc>”
    const root = this.base.replace(/\/$/, "");
    const domain = svc.replace(/ServiceWS$/, "").toLowerCase(); // matrikkelenhet …
    return `${root}/service/${domain}/${svc}`;
  }

  private async postSoap(
    svc: string,
    action: string,
    envelope: string
  ): Promise<string> {
    const corr = randomUUID();
    const url = this.serviceUrl(svc);

    if (LOG) {
      debugLog(`\n===== SOAP Request » ${action} (${corr}) =====`);
      debugLog(`URL: ${url}`);
      debugLog(envelope);
    }
    if (LIVE) await dumpSoap(corr, "request", envelope);

    const { data, status } = await axios.post<string>(
      url,
      envelope,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: action,
        },
        auth: { username: this.user, password: this.pass },
        timeout: 10_000,
        validateStatus: () => true,
      }
    );

    const phase: SoapPhase =
      status >= 400 || String(data).includes("<soap:Fault>")
        ? "fault"
        : "response";

    if (LOG) {
      debugLog(
        `\n===== SOAP ${
          phase === "fault" ? "Fault" : "Response"
        } (${corr}) HTTP ${status} =====\n`
      );
      debugLog(
        typeof data === "string" ? data.slice(0, 900) : data,
        typeof data === "string" && data.length > 900 ? " …" : ""
      );
    }
    if (LIVE) await dumpSoap(corr, phase, String(data));

    if (phase === "fault") {
      throw new Error(`SOAP fault (${action}) HTTP ${status}`);
    }
    return String(data);
  }

  private wrapEnv(inner: string): string {
    return `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Header/><soapenv:Body>${inner}</soapenv:Body>
      </soapenv:Envelope>`.trim();
  }

  private ctxXml(_c: MatrikkelContext): string {
    const ts =
      typeof _c.snapshotVersion === "string"
        ? _c.snapshotVersion
        : _c.snapshotVersion.timestamp;

    return `
      <mat:matrikkelContext xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
                            xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
        <dom:locale>${_c.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${_c.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${_c.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>${_c.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${_c.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>${ts}</dom:timestamp></dom:snapshotVersion>
      </mat:matrikkelContext>`.trim();
  }

  /* ================ 2. Én-ID-metoden ========================= */

  /** Returnerer **én** matrikkelenhets-ID for en vegadresse (C-oppgang osv.) */
  async findIdsForVegadresse(
    adr: VegadresseIdent,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const env = this.wrapEnv(`
    <mat:findMatrikkelenhetIdsForIdents
         xmlns:mat ="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
         xmlns:mid ="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"
         xmlns:adr ="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/adresse"
         xmlns:adr1="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/adresse"
         xmlns:kom ="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/kommune">
  
      <mat:matrikkelenhetIdentList>
        <mid:item
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:type="adr1:VegadresseIdent">
  
          <adr1:kommuneIdent>
            <kom:kommunenummer>${adr.kommunenummer}</kom:kommunenummer>
          </adr1:kommuneIdent>
  
          <adr1:adressekode>${adr.adressekode}</adr1:adressekode>
          <adr1:nummer>${adr.husnummer}</adr1:nummer>
          ${adr.bokstav ? `<adr1:bokstav>${adr.bokstav}</adr1:bokstav>` : ""}
  
        </mid:item>
      </mat:matrikkelenhetIdentList>
  
      ${this.ctxXml(ctx)}
    </mat:findMatrikkelenhetIdsForIdents>`);

    const xml = await this.postSoap(
      "MatrikkelenhetServiceWS",
      "findMatrikkelenhetIdsForIdents",
      env
    );

    return [...xml.matchAll(/<value>(\d+)<\/value>/g)].map((m) => Number(m[1]));
  }

  async getMatrikkelenheter(
    ids: number[],
    ctx: MatrikkelContext
  ): Promise<string> {
    const idXml = ids
      .map((id) => `<dom:item><dom:value>${id}</dom:value></dom:item>`)
      .join("");

    const env = this.wrapEnv(`
      <mat:getMatrikkelenheter
           xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
           xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
        <mat:matrikkelenhetIdList>${idXml}</mat:matrikkelenhetIdList>
        ${this.ctxXml(ctx)}
      </mat:getMatrikkelenheter>`);

    return this.postSoap("MatrikkelenhetServiceWS", "getMatrikkelenheter", env);
  }

  async getMatrikkelenhet(id: number, ctx: MatrikkelContext): Promise<string> {
    const env = this.wrapEnv(`
      <mat:getMatrikkelenhet
           xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
           xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
        <mat:matrikkelenhetId><dom:value>${id}</dom:value></mat:matrikkelenhetId>
        ${this.ctxXml(ctx)}
      </mat:getMatrikkelenhet>`);
    return this.postSoap("MatrikkelenhetServiceWS", "getMatrikkelenhet", env);
  }

  /* ================ 3. GNR/BNR-fallback ====================== */

  async findMatrikkelenheter(
    q: {
      kommunenummer: string;
      gnr: number;
      bnr: number;
      adressekode?: number;
      husnummer?: number;
      bokstav?: string;
    },
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const env = this.wrapEnv(`
      <mat:findMatrikkelenheter
           xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
           xmlns:mid="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet">
        <mat:matrikkelenhetsokModel>
          <mid:kommunenummer>${q.kommunenummer}</mid:kommunenummer>
          <mid:gardsnummer>${q.gnr}</mid:gardsnummer>
          <mid:bruksnummer>${q.bnr}</mid:bruksnummer>
          ${
            q.adressekode
              ? `<mid:adressekode>${q.adressekode}</mid:adressekode>`
              : ""
          }
          ${q.husnummer ? `<mid:husnummer>${q.husnummer}</mid:husnummer>` : ""}
          ${q.bokstav ? `<mid:bokstav>${q.bokstav}</mid:bokstav>` : ""}
        </mat:matrikkelenhetsokModel>
        ${this.ctxXml(ctx)}
      </mat:findMatrikkelenheter>`);

    const xml = await this.postSoap(
      "MatrikkelenhetServiceWS",
      "findMatrikkelenheter",
      env
    );

    // Enkel regex-basert parsing som matcher XML-responsen
    const matches = [...xml.matchAll(/<ns3:item><value>(\d+)<\/value><\/ns3:item>/g)];
    
    if (matches.length > 0) {
      return matches.map(m => Number(m[1])).filter(n => n > 0);
    }

    // Fallback til xml2js parsing hvis regex feiler
    const js = await parseStringPromise(xml, { explicitArray: false });

    const body =
      asRecord(js["soap:Envelope"]?.["soap:Body"]) ??
      asRecord(js.Envelope?.Body) ??
      asRecord(js["SOAP-ENV:Envelope"]?.["SOAP-ENV:Body"]);
    if (!body) return [];

    const respKey = Object.keys(body).find((k) =>
      k.endsWith("Response")
    );
    if (!respKey) return [];

    const retBlock = asRecord(body[respKey]);
    if (!retBlock) return [];

    const retKey = Object.keys(retBlock).find(
      (k) => k === "return" || k.endsWith(":return")
    );
    const ret = retKey ? retBlock[retKey] : undefined;
    if (!ret) return [];

    const retRecord = asRecord(ret);
    const rawItems = retRecord
      ? retRecord["item"] ?? retRecord["ns4:item"] ?? retRecord["ns2:item"]
      : undefined;
    const items = Array.isArray(rawItems)
      ? rawItems
      : rawItems !== undefined
      ? [rawItems]
      : [];

    return items
      .map(extractNumber)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  }

  /* ================ 4. getMatrikkelenhet (detaljer) =========== */
  //  (om du allerede hadde en implementasjon, la den stå uendret)
}

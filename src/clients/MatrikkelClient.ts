// -----------------------------------------------------------------------------
// src/clients/MatrikkelClient.ts
// -----------------------------------------------------------------------------
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { randomUUID } from "crypto";
import { dumpSoap } from "../utils/soapDump.ts";
import type { SoapPhase } from "../utils/soapDump.ts";

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

  private serviceUrl(pathOrSvc: string): string {
    if (pathOrSvc.includes("://")) return pathOrSvc;
    const root = this.base.replace(/\/$/, "");
    return `${root}/${pathOrSvc}`; //  ← ikke «/service/matrikkelenhet/…»
  }

  private async postSoap(
    svc: string,
    action: string,
    envelope: string
  ): Promise<string> {
    const corr = randomUUID();

    if (LOG) {
      console.log(`\n===== SOAP Request » ${action} (${corr}) =====\n`);
      console.log(envelope);
    }
    if (LIVE) await dumpSoap(corr, "request", envelope);

    const { data, status } = await axios.post<string>(
      this.serviceUrl(svc),
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
      console.log(
        `\n===== SOAP ${
          phase === "fault" ? "Fault" : "Response"
        } (${corr}) HTTP ${status} =====\n`
      );
      console.log(
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
    const extra = `
      ${
        q.adressekode
          ? `<mid:adressekode>${q.adressekode}</mid:adressekode>`
          : ""
      }
      ${q.husnummer ? `<mid:husnummer>${q.husnummer}</mid:husnummer>` : ""}
      ${q.bokstav ? `<mid:bokstav>${q.bokstav}</mid:bokstav>` : ""}`;

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

    const js = await parseStringPromise(xml, { explicitArray: false });

    const bodyAny =
      js["soap:Envelope"]?.["soap:Body"] ??
      js.Envelope?.Body ??
      js["SOAP-ENV:Envelope"]?.["SOAP-ENV:Body"];
    if (!bodyAny) return [];

    const body = bodyAny as Record<string, any>;
    const respKey = (Object.keys(body) as string[]).find((k) =>
      k.endsWith("Response")
    );
    if (!respKey) return [];

    const retBlock = body[respKey];
    const retKey = (Object.keys(retBlock) as string[]).find(
      (k) => k === "return" || k.endsWith(":return")
    );
    const ret = retKey ? retBlock[retKey] : undefined;
    if (!ret) return [];

    const items = Array.isArray(ret.item)
      ? ret.item
      : ret.item
      ? [ret.item]
      : Array.isArray(ret["ns4:item"])
      ? ret["ns4:item"]
      : ret["ns4:item"]
      ? [ret["ns4:item"]]
      : [];

    return (
      items
        .map((it: any) => Number(it?.value ?? it))
        //     ▼─────────────── type-annotasjon
        .filter((n: number): n is number => Number.isFinite(n) && n > 0)
    );
  }

  /* ================ 4. getMatrikkelenhet (detaljer) =========== */
  //  (om du allerede hadde en implementasjon, la den stå uendret)
}

// src/clients/MatrikkelClient.ts
// -----------------------------------------------------------------------------
// Matrikkel-klient  –  findMatrikkelenheter | getMatrikkelenhet
// Skriver alltid SOAP-dump til ./soap-dumps   (kan overstyres med env SOAP_DUMP_DIR)
// -----------------------------------------------------------------------------

import axios from "axios";
import { parseStringPromise } from "xml2js";
import { randomUUID } from "crypto";
import { dumpSoap, SoapPhase } from "../utils/soapDump";

/* ────────────────── Miljø ────────────────── */
const LOG_SOAP = process.env.LOG_SOAP === "1";

/* ────────────────── Typer ────────────────── */
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

/* ────────────────── Klient ────────────────── */
export class MatrikkelClient {
  constructor(
    private readonly base: string,
    private readonly user: string,
    private readonly pass: string
  ) {}

  /* ---------- felles HTTP-wrapper m/ dumping ---------- */
  private async call(
    svc: string,
    action: string,
    xml: string
  ): Promise<string> {
    const corr = randomUUID();

    /* 1. logg + dump request */
    if (LOG_SOAP) {
      console.log(
        `\n===== SOAP Request to ${svc} (action=${action}, corrId=${corr}) =====\n`
      );
      console.log(xml);
    }
    await dumpSoap(corr, "request", xml);

    /* 2. HTTP-post */
    const r = await axios.post(`${this.base}/${svc}`, xml, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: action,
      },
      auth: { username: this.user, password: this.pass },
      validateStatus: () => true, // vi håndterer evt. feil selv
    });

    /* 3. logg + dump response/fault */
    const phase: SoapPhase = r.status >= 400 ? "fault" : "response";
    if (LOG_SOAP) {
      console.log(
        `\n===== SOAP ${
          phase === "fault" ? "Fault" : "Response"
        } from ${svc} (HTTP ${r.status}, corrId=${corr}) =====\n`
      );
      console.log(r.data);
    }
    await dumpSoap(corr, phase, String(r.data));

    /* 4. kast feil hvis nødvendig */
    if (r.status >= 400 || /<soap:Fault/i.test(String(r.data))) {
      const snippet = String(r.data).slice(0, 120).replace(/\s+/g, " ");
      throw new Error(
        `SOAP ${r.status} ${r.statusText} (corrId=${corr}): ${snippet}`
      );
    }
    return String(r.data);
  }

  /* ---------- findMatrikkelenheter ---------- */
  async findMatrikkelenheter(
    q: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const env = this.xmlFindMatrikkelenheter(q, ctx);
    const xml = await this.call(
      "MatrikkelenhetServiceWS",
      "findMatrikkelenheter",
      env
    );

    const js = await parseStringPromise(xml, { explicitArray: false });

    const body =
      js["soap:Envelope"]?.["soap:Body"] ??
      js.Envelope?.Body ??
      js["SOAP-ENV:Envelope"]?.["SOAP-ENV:Body"];

    const respKey =
      body && Object.keys(body).find((k) => k.endsWith("Response"));
    const ret = respKey && body[respKey]?.return;

    if (!ret) return [];

    const items = Array.isArray(ret.item) ? ret.item : [ret.item];

    return items
      .map((it: any) => Number(it?.value ?? it))
      .filter((n: number): n is number => Number.isFinite(n) && n > 0);
  }

  /* ---------- getMatrikkelenhet (seksjons- & bygningsnummer) ---------- */
  async getMatrikkelenhet(
    id: number,
    ctx: MatrikkelContext
  ): Promise<{
    id: number;
    seksjonsnummer: number | null;
    bygningsnummer: string | null;
  }> {
    const env = this.xmlGetMatrikkelenhet(id, ctx);
    const xml = await this.call(
      "MatrikkelenhetServiceWS",
      "findMatrikkelenhet",
      env
    );

    const js = await parseStringPromise(xml, { explicitArray: false });
    const body = js["soap:Envelope"]["soap:Body"];
    const respKey = Object.keys(body).find((k) => k.endsWith("Response"))!;
    const me = body[respKey]["return"] ?? body[respKey]["ns4:return"];

    return {
      id,
      seksjonsnummer:
        Number(me?.seksjonsnummer ?? me?.["ns4:seksjonsnummer"] ?? null) ||
        null,
      bygningsnummer: me?.bygningsnummer ?? me?.["ns4:bygningsnummer"] ?? null,
    };
  }

  /* ---------- XML-generatorer ---------- */
  private xmlFindMatrikkelenheter(
    q: MatrikkelehetsøkModel,
    c: MatrikkelContext
  ) {
    const k = String(q.kommunenummer).padStart(4, "0");
    const ts =
      typeof c.snapshotVersion === "string"
        ? c.snapshotVersion
        : c.snapshotVersion.timestamp;

    return `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
                  xmlns:mid="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Header/>
  <soapenv:Body>
    <mat:findMatrikkelenheter>
      <mat:matrikkelenhetsokModel>
        <mid:kommunenummer>${k}</mid:kommunenummer>
        <mid:gardsnummer>${q.gardsnummer}</mid:gardsnummer>
        <mid:bruksnummer>${q.bruksnummer}</mid:bruksnummer>
      </mat:matrikkelenhetsokModel>

      <mat:matrikkelContext>
        <dom:locale>${c.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${c.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${c.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>${c.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${c.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>${ts}</dom:timestamp></dom:snapshotVersion>
      </mat:matrikkelContext>
    </mat:findMatrikkelenheter>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private xmlGetMatrikkelenhet(id: number, c: MatrikkelContext) {
    const ts =
      typeof c.snapshotVersion === "string"
        ? c.snapshotVersion
        : c.snapshotVersion.timestamp;

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header/>
  <soapenv:Body>
    <mat:findMatrikkelenhet>
      <mat:matrikkelenhetIdent xsi:type="dom:MatrikkelenhetIdent">
        <dom:value>${id}</dom:value>
      </mat:matrikkelenhetIdent>

      <mat:matrikkelContext>
        <dom:locale>${c.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${c.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${c.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>${c.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${c.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>${ts}</dom:timestamp></dom:snapshotVersion>
      </mat:matrikkelContext>
    </mat:findMatrikkelenhet>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

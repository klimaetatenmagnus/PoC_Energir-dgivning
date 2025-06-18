// src/clients/BygningClient.ts
// ------------------------------------------------------------------
// Klient mot Matrikkels BygningServiceWS
// ------------------------------------------------------------------
console.log("<<<<< BygningClient.ts lastet – robust id-parsing (v6) >>>>>");

import axios, { AxiosResponse } from "axios";
import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { dumpSoap, SoapPhase } from "../utils/soapDump.ts";

/* ────────────── felles typer ─────────────────────────────── */
export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId?: number; // valgfri
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: { timestamp: string };
}

/* ────────────── klientklasse ─────────────────────────────── */
export class BygningClient {
  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {}

  /* ---------- public: hent liste med bygg-ID-er -------------- */
  async findByggForMatrikkelenhet(
    matrikkelenhetsId: number,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const soapAction = "findByggForMatrikkelenhet";
    const corrId = crypto.randomUUID();
    const xmlRequest = this.renderRequest(matrikkelenhetsId, ctx);

    /* — dump + ev. logg av request — */
    const isLive = process.env.LIVE === "1";
    if (isLive) {
      await dumpSoap(corrId, "request", xmlRequest);
    }
    if (process.env.LOG_SOAP === "1") {
      console.log(
        `\n===== SOAP Request (${soapAction}, corrId=${corrId}) =====\n`
      );
      console.log(xmlRequest, "\n");
    }

    /* — kall webservicen — */
    const resp: AxiosResponse<string> = await axios.post(
      `${this.baseUrl}/BygningServiceWS`,
      xmlRequest,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: soapAction,
        },
        auth: { username: this.username, password: this.password },
        timeout: 10_000,
        validateStatus: () => true, // vi håndterer fault under
      }
    );

    /* — dump respons eller fault — */
    const phase =
      resp.status >= 400 || resp.data.includes("<soap:Fault>")
        ? ("fault" as const)
        : ("response" as const);
    if (isLive) {
      await dumpSoap(corrId, phase, resp.data);
    }

    /* — ev. konsoll-logg av responsen — */
    if (process.env.LOG_SOAP === "1") {
      const tag =
        phase === "fault"
          ? "SOAP Fault"
          : `SOAP Response (HTTP ${resp.status})`;
      console.log(`===== ${tag}, corrId=${corrId}) =====\n`);
      console.log(
        resp.data.slice(0, 1200),
        resp.data.length > 1200 ? "…" : "",
        "\n"
      );
    }

    /* — fault-håndtering — */
    if (phase === "fault") {
      throw new Error(
        `SOAP ${resp.status} fra BygningServiceWS (corrId=${corrId})`
      );
    }

    /* — XML → JS — */
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: true,
      trimValues: true,
    });
    const parsed = parser.parse(resp.data) as Record<string, unknown>;

    /* — finn <return>-noden — */
    const body =
      (parsed["soap:Envelope"] as any)?.["soap:Body"] ??
      (parsed.Envelope as any)?.Body ??
      (parsed["soapenv:Envelope"] as any)?.["soapenv:Body"];

    if (!body) throw new Error("SOAP-body mangler");

    const respKey = Object.keys(body).find((k) =>
      k.endsWith("findByggForMatrikkelenhetResponse")
    );
    const retBlock = respKey ? (body as any)[respKey] : undefined;
    const ret = retBlock?.return ?? retBlock?.["ns2:return"];

    if (!ret) return []; // ingen bygg assosiert med matrikkelenheten

    /* — <item>-liste → number[] — */
    const rawItems = Array.isArray(ret.item)
      ? ret.item
      : ret.item
      ? [ret.item]
      : [];

    const extractNumber = (v: unknown): number | undefined => {
      if (v == null) return;
      if (typeof v === "string" || typeof v === "number") {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      }
      if (typeof v === "object") {
        for (const val of Object.values(v)) {
          const n = extractNumber(val);
          if (n !== undefined) return n;
        }
      }
      return;
    };

    return rawItems
      .map(extractNumber) // (number | undefined)[]
      .filter(
        //  ↓↓↓  legg på type her
        (n: number | undefined): n is number => typeof n === "number"
      );
  }

  /* ---------- private helper: bygg SOAP-request -------------- */
  private renderRequest(id: number, ctx: MatrikkelContext): string {
    const koordinatXml = ctx.koordinatsystemKodeId
      ? `
        <dom:koordinatsystemKodeId>
          <dom:value>${ctx.koordinatsystemKodeId}</dom:value>
        </dom:koordinatsystemKodeId>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Body>
    <sto:findByggForMatrikkelenhet>
      <sto:matrikkelenhetId>
        <dom:value>${id}</dom:value>
      </sto:matrikkelenhetId>

      <sto:matrikkelContext>
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        ${koordinatXml}
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion>
          <dom:timestamp>${ctx.snapshotVersion.timestamp}</dom:timestamp>
        </dom:snapshotVersion>
      </sto:matrikkelContext>
    </sto:findByggForMatrikkelenhet>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

// src/clients/BygningClient.ts
// -------------------------------------------------------------
// Klient mot Matrikkels BygningServiceWS
// Henter alle bygg for en matrikkelenhets-ID
// -------------------------------------------------------------
console.log("<<<<< BygningClient.ts lastet – robust id-parsing (v2) >>>>>");

import axios, { AxiosResponse } from "axios";
import { XMLParser } from "fast-xml-parser";

/* ────────────── felles typer ─────────────────────────────── */
export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  /** Valgfri – sendes bare om den er definert */
  koordinatsystemKodeId?: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  /** Påkrevd objekt – følger samme form i alle klienter */
  snapshotVersion: { timestamp: string };
}

export interface ByggInfoMinimal {
  byggId: number;
}

/* ────────────── klientklasse ─────────────────────────────── */
export class BygningClient {
  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {}

  /* ---------- public: finn bygg for matrikkelenhet ---------- */
  async findByggForMatrikkelenhet(
    matrikkelenhetsId: number,
    ctx: MatrikkelContext
  ): Promise<ByggInfoMinimal[]> {
    /* SOAPAction må kun være operasjons-navnet – ikke full URI */
    const soapAction = "findByggForMatrikkelenhet";

    const xmlRequest = this.renderRequest(matrikkelenhetsId, ctx);

    /* ---- kall tjenesten ------------------------------------ */
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
        validateStatus: (s) => s < 500,
      }
    );

    /* ---- XML → JS ------------------------------------------ */
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: true,
      trimValues: true,
    });
    const parsed = parser.parse(resp.data) as Record<string, unknown>;

    /* ---- naviger til <return> ------------------------------ */
    const body =
      (parsed["soap:Envelope"] as any)?.["soap:Body"] ??
      (parsed.Envelope as any)?.Body ??
      (parsed["soapenv:Envelope"] as any)?.["soapenv:Body"];
    if (!body) throw new Error("SOAP-body mangler");

    const respKey = Object.keys(body).find((k) =>
      k.endsWith("findByggForMatrikkelenhetResponse")
    );

    const ret = respKey
      ? (body as any)[respKey].return ?? (body as any)[respKey]["ns2:return"]
      : null;
    if (!ret) return []; // ingen bygg

    /* ---- item[] → byggId[] -------------------------------- */
    const items: unknown[] = Array.isArray(ret.item)
      ? ret.item
      : ret.item
      ? [ret.item]
      : [];

    const extractNumber = (o: unknown): number | undefined => {
      if (o == null) return;
      if (typeof o === "string" || typeof o === "number") {
        const n = Number(o);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      }
      if (typeof o === "object") {
        for (const v of Object.values(o as Record<string, unknown>)) {
          const n = extractNumber(v);
          if (n !== undefined) return n;
        }
      }
      return;
    };

    const byggIds: number[] = items
      .map((item: unknown): number | undefined => extractNumber(item))
      .filter((id): id is number => typeof id === "number");

    return byggIds.map(
      (id): ByggInfoMinimal => ({
        byggId: id,
      })
    );
  }

  /* ---------- private helper: bygg SOAP-request ------------ */
  private renderRequest(id: number, ctx: MatrikkelContext): string {
    /* bygg <dom:koordinatsystemKodeId> bare hvis feltet finnes  */
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

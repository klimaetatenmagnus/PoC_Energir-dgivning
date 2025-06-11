// src/clients/MatrikkelClient.ts
// ---------------------------------------------------------------------------
// Klient for Matrikkel‑API (Adresse‑, Matrikkelenhet‑ og StoreService).
// 2025‑06: oppdatert med robust XML‑parser som henter alle matrikkelenhets‑ID‑er
// via <item><value>…</value></item> og korrekt namespace‑/wrapper‑struktur
// i <matrikkelContext>.
// ---------------------------------------------------------------------------

import axios from "axios";
import { parseStringPromise } from "xml2js"; // <- ny, for enkel ID‑høsting
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/* ──────────────── Miljø‑konfig ───────────────────────────────────────── */
const SOAP_DUMP_DIR = process.env.SOAP_DUMP_DIR ?? "./soap-dumps";
const LOG_SOAP = process.env.LOG_SOAP === "1";

async function dumpSoap(
  stage: "request" | "response",
  service: string,
  xml: string,
  corrId: string
) {
  if (!LOG_SOAP) return;
  const dir = path.join(SOAP_DUMP_DIR, new Date().toISOString().slice(0, 10));
  await fs.mkdir(dir, { recursive: true });
  const file = `${Date.now()}_${corrId}_${stage}_${service}.xml`;
  await fs.writeFile(path.join(dir, file), xml);
}

/* ──────────────── Domene‑typer ───────────────────────────────────────── */
export interface VegadresseSøkModel {
  kommunenummer: number | string;
  adressenavn: string;
  husnummer: string | number;
  husbokstav?: string | null;
  postnummer?: string | null;
}

export interface MatrikkelehetsøkModel {
  kommunenummer: number | string;
  gardsnummer: number;
  bruksnummer: number;
}

export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number; // EPSG‑kode
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: string; // ISO ts
}

/* ──────────────── Klientklasse ──────────────────────────────────────── */
export class MatrikkelClient {
  constructor(
    private baseUrl: string,
    private username: string,
    private password: string
  ) {}

  /* ---------- Felles HTTP‑wrapper ------------------------------------ */
  private async call(service: string, soapAction: string, xml: string) {
    const corrId = randomUUID();
    await dumpSoap("request", service, xml, corrId);

    const res = await axios.post(`${this.baseUrl}/${service}`, xml, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: soapAction,
      },
      auth: { username: this.username, password: this.password },
      validateStatus: () => true,
    });
    await dumpSoap("response", service, res.data as string, corrId);

    if (res.status >= 400) {
      const e: Error & {
        corrId?: string;
        httpStatus?: number;
        responseSnippet?: string;
      } = new Error(`SOAP ${res.status} ${res.statusText} (corrId=${corrId})`);
      e.corrId = corrId;
      e.httpStatus = res.status;
      e.responseSnippet = (res.data as string).slice(0, 512);
      throw e;
    }
    return res.data as string;
  }

  /* ------------------------------------------------------------------ */
  /* ---------------- Matrikkelenhets‑oppslag ------------------------- */
  /* ------------------------------------------------------------------ */

  /**
   * Returnerer alle Matrikkelenhets‑ID‑er som matcher gnr/bnr (og kommune).
   */
  async findMatrikkelenheter(
    søk: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const envelope = this.renderFindMatrikkelenheterXml(søk, ctx);
    const xml = await this.call(
      "MatrikkelenhetServiceWS",
      "findMatrikkelenheter",
      envelope
    );
    return await this.parseMatrikkelenhetsResponse(xml);
  }

  /**
   * Parser <item><value>…</value></item> → number[] uansett prefix.
   */
  private async parseMatrikkelenhetsResponse(xml: string): Promise<number[]> {
    const js = await parseStringPromise(xml, { explicitArray: false });

    // Naviger: Envelope → Body → *Response → return → item
    const body = js["soap:Envelope"]?.["soap:Body"] ?? js.Envelope?.Body;
    if (!body) return [];

    const respKey = Object.keys(body).find((k) => k.endsWith("Response"));
    if (!respKey) return [];

    const itemContainer = body[respKey]["ns3:return"] ?? body[respKey].return;
    if (!itemContainer) return [];
    const itemsRaw = itemContainer["ns4:item"] ?? itemContainer.item;
    const arr = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

    return arr
      .map((it: any) => Number(it.value))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  async getMatrikkelenhet(id: number, ctx: MatrikkelContext) {
    // NB: ny XML-bygger + SOAPAction = findMatrikkelenhet
    const envelope = this.renderFindMatrikkelenhetXml(id, ctx);
    const xml = await this.call(
      "MatrikkelenhetServiceWS",
      "findMatrikkelenhet",
      envelope
    );

    const js = await parseStringPromise(xml, { explicitArray: false });
    // soap:Envelope → soap:Body → ns3:findMatrikkelenhetResponse → ns4:return
    const me =
      js["soap:Envelope"]["soap:Body"]["ns3:findMatrikkelenhetResponse"][
        "ns4:return"
      ];

    return {
      id,
      seksjonsnummer: Number(me["ns4:seksjonsnummer"] ?? 0),
      bygningsnummer: me["ns4:bygningsnummer"],
    } as const;
  }

  /* ------------------------------------------------------------------ */
  /* ---------------- XML‑renderere ----------------------------------- */
  /* ------------------------------------------------------------------ */
  private renderFindMatrikkelenheterXml(
    s: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ) {
    const kommune = String(s.kommunenummer).padStart(4, "0");
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"
                  xmlns:ctx="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Header/>
  <soapenv:Body>
    <mat:findMatrikkelenheter>
      <mat:matrikkelenhetsokModel>
        <dom:kommunenummer>${kommune}</dom:kommunenummer>
        <dom:gardsnummer>${s.gardsnummer}</dom:gardsnummer>
        <dom:bruksnummer>${s.bruksnummer}</dom:bruksnummer>
      </mat:matrikkelenhetsokModel>
${this.renderContext(ctx)}
    </mat:findMatrikkelenheter>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private renderContext(ctx: MatrikkelContext): string {
    return `
          <mat:matrikkelContext>
            <ctx:locale>${ctx.locale}</ctx:locale>
            <ctx:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</ctx:brukOriginaleKoordinater>
            <ctx:koordinatsystemKodeId>
              <ctx:value>${ctx.koordinatsystemKodeId}</ctx:value>
            </ctx:koordinatsystemKodeId>
            <ctx:systemVersion>${ctx.systemVersion}</ctx:systemVersion>
            <ctx:klientIdentifikasjon>${ctx.klientIdentifikasjon}</ctx:klientIdentifikasjon>
            <ctx:snapshotVersion>
              <ctx:timestamp>${ctx.snapshotVersion}</ctx:timestamp>
            </ctx:snapshotVersion>
          </mat:matrikkelContext>`;
  }

  private renderGetMatrikkelenhetXml(id: number, ctx: MatrikkelContext) {
    return `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/MatrikkelenhetService"
                    xmlns:ctx="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
    <soapenv:Header/>
    <soapenv:Body>
      <mat:getMatrikkelenhet>
        <mat:matrikkelenhetId>${id}</mat:matrikkelenhetId>
  ${this.renderContext(ctx)}
      </mat:getMatrikkelenhet>
    </soapenv:Body>
  </soapenv:Envelope>`;
  }

  private renderFindMatrikkelenhetXml(id: number, ctx: MatrikkelContext) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
                  xmlns:ctx="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Header/>
  <soapenv:Body>
    <mat:findMatrikkelenhet>
      <mat:id xsi:type="dom:MatrikkelenhetId">
        <dom:value>${id}</dom:value>
      </mat:id>
${this.renderContext(ctx)}
    </mat:findMatrikkelenhet>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /* ---- AdresseService‑XML‑bygger (uendret) ------------------------- */
  private renderFindBruksenheterXml(
    s: VegadresseSøkModel,
    ctx: MatrikkelContext
  ): string {
    const kommune = String(s.kommunenummer).padStart(4, "0");
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:adr="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/adresse"
                  xmlns:mid="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Header/>
  <soapenv:Body>
    <adr:findBruksenheterForVegadresseIKommune>
      <adr:kommunenummer>${kommune}</adr:kommunenummer>
      <adr:adressenavn>${s.adressenavn}</adr:adressenavn>
      <adr:husnummer>${s.husnummer}</adr:husnummer>
      ${s.husbokstav ? `<adr:husbokstav>${s.husbokstav}</adr:husbokstav>` : ""}
      ${s.postnummer ? `<adr:postnummer>${s.postnummer}</adr:postnummer>` : ""}
      ${this.renderContext(ctx)}
    </adr:findBruksenheterForVegadresseIKommune>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

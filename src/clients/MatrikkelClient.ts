// src/clients/MatrikkelClient.ts
// ----------------------------------------------------------------------------
// Klient for Matrikkel SOAP‑API. Robust mot navne‑rom‑prefikser, ulike
// elementvarianter og SOAP‑Fault‑tilbakemeldinger.
// ----------------------------------------------------------------------------

import axios from "axios";
import { XMLParser } from "fast-xml-parser";

// ------------------------------ Typer ------------------------------

export interface MatrikkelehetsøkModel {
  kommunenummer: number | string;
  status: string;
  gardsnummer: number;
  bruksnummer: number;
}

export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number; // EPSG‑kode, e.g. 25833
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: string; // ISO‑ts, f.eks. 9999‑01‑01T00:00:00+01:00
}

// --------------------------- Klientklasse ---------------------------

export class MatrikkelClient {
  constructor(
    private baseUrl: string,
    private username: string,
    private password: string
  ) {}

  // -------------------------- SOAP‑kall ----------------------------

  async findMatrikkelenheter(
    søk: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const xmlRequest = this.renderFindMatrikkelenheterXml(søk, ctx);

    const res = await axios.post(
      `${this.baseUrl}/MatrikkelenhetServiceWS`,
      xmlRequest,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: "findMatrikkelenheter",
        },
        auth: { username: this.username, password: this.password },
      }
    );

    // ── 1. Parse XML til JS‑objekt ────────────────────────────────
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const json = parser.parse(res.data) as any;

    const envelope = json["soap:Envelope"] ?? json.Envelope;
    const body = envelope?.["soap:Body"] ?? envelope?.Body;
    if (!body) throw new Error("Uventet SOAP‑struktur (mangler Body)");

    // ── 2. Fault‑håndtering ───────────────────────────────────────
    if (body["soap:Fault"] || body.Fault) {
      const fault = body["soap:Fault"] ?? body.Fault;
      throw new Error(
        `Matrikkel-feil: ${
          fault.faultstring ?? fault["faultstring"] ?? "ukjent"
        }`
      );
    }

    // ── 3. Response‑nøkkel uavhengig av prefiks ──────────────────
    const respKey = Object.keys(body).find((k) =>
      k.endsWith("findMatrikkelenheterResponse")
    );
    if (!respKey) throw new Error("Uventet SOAP‑struktur (mangler Response)");

    const response = body[respKey];

    // ── 4. return‑element uavhengig av prefiks ───────────────────
    const retKey = Object.keys(response).find(
      (k) => k === "return" || k.endsWith(":return")
    );
    const itemContainer = retKey ? response[retKey] : response;

    // ── 5. item‑element uavhengig av prefiks ──────────────────────
    const itemKey = Object.keys(itemContainer).find(
      (k) => k === "item" || k.endsWith(":item")
    );
    const itemsRaw = itemKey ? itemContainer[itemKey] : itemContainer;

    // ── 6. Verdiekstraksjon ───────────────────────────────────────
    if (!itemsRaw) return [];

    const extractValue = (node: any): string => {
      if (typeof node === "string") return node.trim();
      return (
        node["#text"] ??
        node.value ??
        node["dom:value"] ??
        Object.values(node).find((v) => typeof v === "string") ??
        ""
      )
        .toString()
        .trim();
    };

    const idStrings: string[] = Array.isArray(itemsRaw)
      ? itemsRaw.map(extractValue)
      : [extractValue(itemsRaw)];

    return idStrings
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  // ----------------------- XML‑bygger -----------------------------

  private renderFindMatrikkelenheterXml(
    søk: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ): string {
    const kommune = String(søk.kommunenummer).padStart(4, "0");
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
  xmlns:mid="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"
  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Header/>
  <soapenv:Body>
    <mat:findMatrikkelenheter>
      <mat:matrikkelenhetsokModel>
        <mid:kommunenummer>${kommune}</mid:kommunenummer>
        <mid:status>${søk.status}</mid:status>
        <mid:gardsnummer>${søk.gardsnummer}</mid:gardsnummer>
        <mid:bruksnummer>${søk.bruksnummer}</mid:bruksnummer>
      </mat:matrikkelenhetsokModel>
      <mat:matrikkelContext>
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId>
          <dom:value>${ctx.koordinatsystemKodeId}</dom:value>
        </dom:koordinatsystemKodeId>
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion>
          <dom:timestamp>${ctx.snapshotVersion}</dom:timestamp>
        </dom:snapshotVersion>
      </mat:matrikkelContext>
    </mat:findMatrikkelenheter>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

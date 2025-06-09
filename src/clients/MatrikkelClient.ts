// src/clients/MatrikkelClient.ts
// ---------------------------------------------------------------------------
// Klient for Matrikkel SOAP‑API.
//   • AdresseServiceWS.findBruksenheterForVegadresseIKommune → gnr / bnr / (snr)
//   • MatrikkelenhetServiceWS.findMatrikkelenheter           → matrikkelenhets‑ID
//   • StoreServiceWS.getObject                               → detaljer om matrikkelenhet
// ---------------------------------------------------------------------------

import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// ------------------------------ Miljø‑konfig ------------------------------
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

// ------------------------------ Typer ------------------------------
export interface VegadresseSøkModel {
  kommunenummer: number | string;
  adressenavn: string; // Kapellveien
  husnummer: string | number; // 156
  husbokstav?: string | null; // C
  postnummer?: string | null; // 0493
}

export interface MatrikkelehetsøkModel {
  kommunenummer: number | string;
  status: string; // ALLE | BESTAENDE …
  gardsnummer: number;
  bruksnummer: number;
}

export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number; // EPSG‑kode, f.eks. 25832
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

  // ---- Felles HTTP‑wrapper ------------------------------------------------
  private async call(
    servicePath: string,
    soapAction: string,
    xml: string
  ): Promise<string> {
    const corrId = randomUUID();
    await dumpSoap("request", servicePath, xml, corrId);

    const res = await axios.post(`${this.baseUrl}/${servicePath}`, xml, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: soapAction,
      },
      auth: { username: this.username, password: this.password },
      validateStatus: () => true,
    });

    await dumpSoap("response", servicePath, res.data as string, corrId);

    if (res.status >= 400) {
      const err: Error & {
        corrId: string;
        httpStatus: number;
        responseSnippet: string;
      } = new Error(
        `SOAP ${res.status} ${res.statusText} (corrId=${corrId})`
      ) as any;
      err.corrId = corrId;
      err.httpStatus = res.status;
      err.responseSnippet = (res.data as string).slice(0, 512);
      throw err;
    }

    return res.data as string;
  }

  // -------------------------------------------------------------------
  // ---------------- Adresse‑oppslag  ---------------------------------
  // -------------------------------------------------------------------

  /**
   * Offentlig API‑metode som matcher kravet:
   * Returnerer ett element pr seksjon hvis seksjonsnummere finnes, ellers ett.
   */
  async findBruksenheterForVegadresseIKommune(
    adr: VegadresseSøkModel,
    ctx: MatrikkelContext
  ): Promise<
    { gardsnummer: number; bruksnummer: number; seksjonsnummer?: number }[]
  > {
    const res = await this.#findGnrBnrForVegadresse(adr, ctx);
    if (!res) return [];
    const { gnr, bnr, seksjonsnummere } = res;

    if (!seksjonsnummere.length) {
      return [{ gardsnummer: gnr, bruksnummer: bnr }];
    }
    return seksjonsnummere.map((snr) => ({
      gardsnummer: gnr,
      bruksnummer: bnr,
      seksjonsnummer: Number(snr),
    }));
  }

  /** Intern: kaller AdresseService og parser første respons */
  async #findGnrBnrForVegadresse(
    søk: VegadresseSøkModel,
    ctx: MatrikkelContext
  ): Promise<{ gnr: number; bnr: number; seksjonsnummere: string[] } | null> {
    const xmlReq = this.renderFindBruksenheterXml(søk, ctx);
    const xmlResp = await this.call(
      "AdresseServiceWS",
      "findBruksenheterForVegadresseIKommune",
      xmlReq
    );

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const json = parser.parse(xmlResp) as any;
    const body =
      (json["soap:Envelope"] ?? json.Envelope)?.["soap:Body"] ??
      json.Envelope?.Body;
    if (!body) return null;
    if (body["soap:Fault"] || body.Fault) return null;

    const respKey = Object.keys(body).find((k) =>
      k.endsWith("findBruksenheterForVegadresseIKommuneResponse")
    );
    if (!respKey) return null;

    const items = body[respKey]?.return ?? body[respKey];
    const first = Array.isArray(items) ? items[0] : items;
    if (!first) return null;

    const gnr = Number(first?.gardsnummer ?? first?.["mid:gardsnummer"] ?? 0);
    const bnr = Number(first?.bruksnummer ?? first?.["mid:bruksnummer"] ?? 0);

    const seksjons = (first?.matrikkelenhetListe ??
      first?.["mid:matrikkelenhetListe"] ??
      []) as any[];
    const seksjonsnummere: string[] = (seksjons || [])
      .map((m) =>
        String(m?.seksjonsnummer ?? m?.["mid:seksjonsnummer"] ?? "").trim()
      )
      .filter(Boolean);

    if (!gnr || !bnr) return null;
    return { gnr, bnr, seksjonsnummere };
  }

  // -------------------------------------------------------------------
  // ---------------- Matrikkelenhet‑oppslag ----------------------------
  // -------------------------------------------------------------------
  async findMatrikkelenheter(
    søk: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const xmlRequest = this.renderFindMatrikkelenheterXml(søk, ctx);
    const xmlResp = await this.call(
      "MatrikkelenhetServiceWS",
      "findMatrikkelenheter",
      xmlRequest
    );

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const json = parser.parse(xmlResp) as any;
    const body =
      (json["soap:Envelope"] ?? json.Envelope)?.["soap:Body"] ??
      json.Envelope?.Body;
    if (!body) throw new Error("Uventet SOAP‑struktur (mangler Body)");
    if (body["soap:Fault"] || body.Fault) {
      const fault = body["soap:Fault"] ?? body.Fault;
      throw new Error(
        `Matrikkel‑feil: ${
          fault.faultstring ?? fault["faultstring"] ?? "ukjent"
        }`
      );
    }

    const respKey = Object.keys(body).find((k) =>
      k.endsWith("findMatrikkelenheterResponse")
    );
    if (!respKey) throw new Error("Uventet SOAP‑struktur (mangler Response)");

    const itemContainer = body[respKey]?.return ?? body[respKey];
    const itemsRaw = itemContainer?.item ?? itemContainer;
    if (!itemsRaw) return [];

    const toVal = (n: any) =>
      typeof n === "string"
        ? n.trim()
        : String(n["#text"] ?? n.value ?? "").trim();
    const idStrings: string[] = Array.isArray(itemsRaw)
      ? itemsRaw.map(toVal)
      : [toVal(itemsRaw)];
    return idStrings.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  }

  // ----------------------- XML‑byggere -----------------------------
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

  /** Felles kontekst‑fragment som kan gjenbrukes i flere SOAP‑kall */
  private renderContext(ctx: MatrikkelContext): string {
    return `      <mat:matrikkelContext>\n        <dom:locale>${ctx.locale}</dom:locale>\n        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>\n        <dom:koordinatsystemKodeId><dom:value>${ctx.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>\n        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>\n        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>\n        <dom:snapshotVersion><dom:timestamp>${ctx.snapshotVersion}</dom:timestamp></dom:snapshotVersion>\n      </mat:matrikkelContext>`;
  }
}

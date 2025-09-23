// src/clients/BygningClient.ts
// ------------------------------------------------------------------
// Klient mot Matrikkels BygningServiceWS
// ------------------------------------------------------------------

import axios, { AxiosResponse } from "axios";
import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { dumpSoap } from "../utils/soapDump.ts";
import "../../loadEnv.ts";
import { debugLog } from "../../services/building-info-service/logging.ts";

debugLog("<<<<< BygningClient.ts lastet – robust id-parsing (v6) >>>>>");

type SoapRecord = Record<string, unknown>;

function valueAsRecord(value: unknown): SoapRecord | undefined {
  return typeof value === "object" && value !== null
    ? (value as SoapRecord)
    : undefined;
}

function extractSoapBody(parsed: SoapRecord): SoapRecord | undefined {
  const envelope =
    valueAsRecord(parsed["soap:Envelope"]) ??
    valueAsRecord(parsed.Envelope) ??
    valueAsRecord(parsed["soapenv:Envelope"]);

  if (!envelope) {
    return undefined;
  }

  return (
    valueAsRecord(envelope["soap:Body"]) ??
    valueAsRecord((envelope as SoapRecord).Body) ??
    valueAsRecord(envelope["soapenv:Body"])
  );
}

/* ────────────── felles typer ─────────────────────────────── */
export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId?: number; // valgfri
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: { timestamp: string };
}

export interface BygningstypeKode {
  id: number;          // intern ID (f.eks. 8)
  kodeverdi: string;   // faktisk kode (f.eks. "131")
  beskrivelse: string; // f.eks. "Rekkehus"
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
      debugLog(`\n===== SOAP Request (${soapAction}, corrId=${corrId}) =====\n`);
      debugLog(xmlRequest, "\n");
    }

    /* — kall webservicen — */
    const endpoint = this.baseUrl
      .replace(/\/$/, "")
      .endsWith("/BygningServiceWS")
      ? this.baseUrl.replace(/\/$/, "") // full URL gitt inn
      : `${this.baseUrl.replace(/\/$/, "")}/BygningServiceWS`; // legg til suffix

    const resp: AxiosResponse<string> = await axios.post(endpoint, xmlRequest, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: soapAction,
      },
      auth: { username: this.username, password: this.password },
      timeout: 10_000,
      validateStatus: () => true, // vi håndterer ev. fault under
    });

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
      debugLog(`===== ${tag}, corrId=${corrId}) =====\n`);
      debugLog(
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
    const parsed = parser.parse(resp.data) as SoapRecord;

    /* — finn <return>-noden — */
    const body = extractSoapBody(parsed);

    if (!body) throw new Error("SOAP-body mangler");

    const respKey = Object.keys(body).find((k) =>
      k.endsWith("findByggForMatrikkelenhetResponse")
    );
    const retBlock = respKey ? valueAsRecord(body[respKey]) : undefined;
    const ret = retBlock?.["return"] ?? retBlock?.["ns2:return"];

    if (!ret) return []; // ingen bygg assosiert med matrikkelenheten

    /* — <item>-liste → number[] — */
    const rawItemsSource = (
      (typeof ret === "object" && ret !== null ? (ret as { item?: unknown }) : undefined)
    )?.item;
    const rawItems = Array.isArray(rawItemsSource)
      ? rawItemsSource
      : rawItemsSource
      ? [rawItemsSource]
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

  /* ---------- public: hent alle bygningstype-koder -------------- */
  async findAlleBygningstypeKoder(ctx: MatrikkelContext): Promise<BygningstypeKode[]> {
    const soapAction = "findAlleBygningstypeKoder";
    const corrId = crypto.randomUUID();
    const xmlRequest = this.renderBygningstypeKoderRequest(ctx);

    /* — dump + ev. logg av request — */
    const isLive = process.env.LIVE === "1";
    if (isLive) {
      await dumpSoap(corrId, "request", xmlRequest);
    }
    if (process.env.LOG_SOAP === "1") {
      debugLog(
        `\n===== SOAP Request (${soapAction}, corrId=${corrId}) =====\n`
      );
      debugLog(xmlRequest, "\n");
    }

    /* — kall webservicen — */
    const endpoint = this.baseUrl
      .replace(/\/$/, "")
      .endsWith("/BygningServiceWS")
      ? this.baseUrl.replace(/\/$/, "") // full URL gitt inn
      : `${this.baseUrl.replace(/\/$/, "")}/BygningServiceWS`; // legg til suffix

    const resp: AxiosResponse<string> = await axios.post(endpoint, xmlRequest, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: soapAction,
      },
      auth: { username: this.username, password: this.password },
      timeout: 10_000,
      validateStatus: () => true, // vi håndterer ev. fault under
    });

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
      debugLog(`===== ${tag}, corrId=${corrId}) =====\n`);
      debugLog(
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
    const parsed = parser.parse(resp.data) as SoapRecord;

    /* — finn <return>-noden — */
    const body = extractSoapBody(parsed);

    if (!body) throw new Error("SOAP-body mangler");

    const respKey = Object.keys(body).find((k) =>
      k.endsWith("findAlleBygningstypeKoderResponse")
    );
    const retBlock = respKey ? valueAsRecord(body[respKey]) : undefined;
    const ret = retBlock?.["return"] ?? retBlock?.["ns2:return"];

    if (!ret) return []; // ingen koder funnet

    /* — <item>-liste → BygningstypeKode[] — */
    const items =
      (typeof ret === "object" && ret !== null ? (ret as { item?: unknown }) : undefined)
        ?.item;
    const rawItems = Array.isArray(items) ? items : items ? [items] : [];

    const extractKode = (item: unknown): BygningstypeKode | undefined => {
      if (!item || typeof item !== "object") return;
      const record = item as Record<string, unknown>;
      
      // Prøv å finne id, kodeverdi og beskrivelse
      const id =
        (record.id as { value?: unknown } | undefined)?.value ??
        record.id ??
        (record["dom:id"] as { [key: string]: unknown } | undefined)?.["dom:value"] ??
        record["dom:id"];
      const kodeverdi =
        record.kodeverdi ??
        record.kode ??
        (record["dom:kodeverdi"] as unknown) ??
        record["dom:kode"];
      const beskrivelse =
        (record.beskrivelse as unknown) ??
        record["dom:beskrivelse"] ??
        "";
      
      if (id && kodeverdi) {
        return {
          id: Number(id),
          kodeverdi: String(kodeverdi),
          beskrivelse: String(beskrivelse),
        };
      }
      return;
    };

    return rawItems
      .map(extractKode)
      .filter(
        (kode: BygningstypeKode | undefined): kode is BygningstypeKode =>
          kode !== undefined
      );
  }

  /* ---------- private helper: bygg SOAP-request -------------- */
  private renderRequest(id: number, ctx: MatrikkelContext): string {
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
        <dom:koordinatsystemKodeId>
          <dom:value>${ctx.koordinatsystemKodeId ?? 25833}</dom:value>
        </dom:koordinatsystemKodeId>
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

  /* ---------- private helper: bygg SOAP-request for bygningstype-koder -------------- */
  private renderBygningstypeKoderRequest(ctx: MatrikkelContext): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Body>
    <sto:findAlleBygningstypeKoder>
      <sto:matrikkelContext>
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>   
        <dom:koordinatsystemKodeId>
          <dom:value>${ctx.koordinatsystemKodeId || 25833}</dom:value>
        </dom:koordinatsystemKodeId>
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion>
          <dom:timestamp>${ctx.snapshotVersion.timestamp}</dom:timestamp>
        </dom:snapshotVersion>
      </sto:matrikkelContext>
    </sto:findAlleBygningstypeKoder>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

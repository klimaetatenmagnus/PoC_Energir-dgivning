import axios from "axios";
import { randomUUID } from "crypto";
import type { GrunnbokContext } from "./types.ts";

const LOG = process.env.LOG_SOAP === "1" || process.env.LOG_GRUNNBOK === "1";

export const GRUNNBOK_NAMESPACES = {
  ident: "http://kartverket.no/grunnbok/wsapi/v2/service/ident",
  registerenhet: "http://kartverket.no/grunnbok/wsapi/v2/service/registerenhet",
  registerenhetsrett:
    "http://kartverket.no/grunnbok/wsapi/v2/service/registerenhetsrett",
  registerenhetsrettsandel:
    "http://kartverket.no/grunnbok/wsapi/v2/service/registerenhetsrettsandel",
  store: "http://kartverket.no/grunnbok/wsapi/v2/service/store",
  grunnboksidenter:
    "http://kartverket.no/grunnbok/wsapi/v2/domain/grunnboksidenter",
  basistyper: "http://kartverket.no/grunnbok/wsapi/v2/domain/basistyper",
  registerenhetDomain:
    "http://kartverket.no/grunnbok/wsapi/v2/domain/register/registerenhet",
  register: "http://kartverket.no/grunnbok/wsapi/v2/domain/register",
  person: "http://kartverket.no/grunnbok/wsapi/v2/domain/register/person",
  adresse: "http://kartverket.no/grunnbok/wsapi/v2/domain/register/adresse",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
} as const;

export function buildContextXml(ctx: GrunnbokContext): string {
  return `
    <bt:systemVersion>${ctx.systemVersion}</bt:systemVersion>
    <bt:clientIdentification>${ctx.clientIdentification}</bt:clientIdentification>
    <bt:locale>${ctx.locale}</bt:locale>
    <bt:snapshotVersion><bt:timestamp>${ctx.snapshotTimestamp}</bt:timestamp></bt:snapshotVersion>
  `.trim();
}

export function defaultContext(
  clientIdentification = "energinokkelen"
): GrunnbokContext {
  return {
    systemVersion: "2",
    clientIdentification,
    locale: "nb_NO",
    snapshotTimestamp: "9999-01-01T00:00:00+01:00",
  };
}

export class GrunnbokSoapClient {
  constructor(
    protected readonly baseUrl: string,
    protected readonly username: string,
    protected readonly password: string,
    protected readonly ctx: GrunnbokContext = defaultContext()
  ) {
    if (!baseUrl) throw new Error("GrunnbokSoapClient: baseUrl is required");
    if (!username) throw new Error("GrunnbokSoapClient: username is required");
    if (!password) throw new Error("GrunnbokSoapClient: password is required");
  }

  protected serviceUrl(service: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}/${service}`;
  }

  protected async postSoap(
    service: string,
    envelope: string
  ): Promise<string> {
    const corr = randomUUID();
    const url = this.serviceUrl(service);

    if (LOG) {
      console.warn(`[grunnbok] → ${service} (${corr})`);
      console.warn(envelope);
    }

    const { data, status } = await axios.post<string>(url, envelope, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "",
      },
      auth: { username: this.username, password: this.password },
      timeout: 30_000,
      validateStatus: () => true,
    });

    const body = typeof data === "string" ? data : String(data);

    if (LOG) {
      console.warn(`[grunnbok] ← ${service} (${corr}) HTTP ${status}`);
      console.warn(body.slice(0, 800));
    }

    if (status >= 400 || body.includes("<soap:Fault>")) {
      const faultMatch = body.match(/<faultstring>([^<]+)<\/faultstring>/);
      const msg = faultMatch?.[1] ?? `HTTP ${status}`;
      throw new Error(`[grunnbok] SOAP fault on ${service}: ${msg}`);
    }

    return body;
  }

  protected wrapEnvelope(
    namespaces: Record<string, string>,
    body: string
  ): string {
    const nsAttrs = Object.entries(namespaces)
      .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
      .join(" ");

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ${nsAttrs}>
<soapenv:Body>${body}</soapenv:Body>
</soapenv:Envelope>`;
  }
}

export function extractMatches(xml: string, regex: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const globalRegex = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : `${regex.flags}g`
  );
  while ((m = globalRegex.exec(xml)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

export function extractFirst(xml: string, regex: RegExp): string | null {
  const m = regex.exec(xml);
  return m?.[1] ?? null;
}

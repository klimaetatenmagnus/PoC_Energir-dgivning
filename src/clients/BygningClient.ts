// src/clients/BygningClient.ts
// ---------------------------------------------------------------------------
// Klient mot Matrikkels BygningServiceWS ‑ henter bygg‑ID‑er for en
// matrikkelenhets‑ID.  Prefikset på <matrikkelContext> må være byg: for at
// tjenesten skal kjenne igjen parametret.
// ---------------------------------------------------------------------------

console.log("<<<<< BygningClient.ts LADES NÅ - Siste versjon med findByggForMatrikkelenhet og SOAPAction >>>>>");

import axios, { AxiosResponse } from "axios";
import { XMLParser } from "fast-xml-parser";

export interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: string;
}

export class BygningClient {
  constructor(
    private baseUrl: string,
    private username: string,
    private password: string
  ) {}

  /**
   * Returnerer en liste bygg‑ID‑er (ByggId) for gitt matrikkelenhets‑ID.
   */
  async findByggIds(
    matrikkelenhetsId: number,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    const operationName = "findByggForMatrikkelenhet";
    const soapAction = `http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning/BygningService/${operationName}Request`;
    const xml = this.renderRequest(matrikkelenhetsId, ctx);

    const responseAxios: AxiosResponse<string> = await axios.post(
      `${this.baseUrl}/BygningServiceWS`,
      xml,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: soapAction,
        },
        auth: { username: this.username, password: this.password },
        validateStatus: (s: number) => s < 500, // Håndterer 500-feil manuelt nedenfor
      }
    );

    const parser = new XMLParser({
      ignoreAttributes: false, // Behold attributter hvis nødvendig for fremtiden
      attributeNamePrefix: "@_", // Standard prefiks for attributter
      parseTagValue: true, // Konverter tall og boolske verdier automatisk
      trimValues: true,
    });

    const parsedXml = parser.parse(responseAxios.data) as any;

    const envelope = parsedXml["soap:Envelope"] ?? parsedXml.Envelope;
    const body = envelope?.["soap:Body"] ?? envelope?.Body;

    if (!body) {
      throw new Error(
        "BygningServiceWS: Uventet SOAP‑struktur (mangler Body)"
      );
    }

    // soap:Fault?
    const faultKey = Object.keys(body).find(k => k.endsWith("Fault"));
    if (faultKey && body[faultKey]) {
      const fault = body[faultKey];
      const faultStringKey = Object.keys(fault).find(k => k.endsWith("faultstring"));
      const faultMessage = faultStringKey ? fault[faultStringKey] : "Ukjent SOAP-feil fra BygningServiceWS";
      throw new Error(`BygningServiceWS: ${faultMessage}`);
    }

    // Finn respons-elementet, f.eks. <...:findByggForMatrikkelenhetResponse>
    const responseKey = Object.keys(body).find((k) =>
      k.endsWith("findByggForMatrikkelenhetResponse")
    );
    if (!responseKey) {
      throw new Error(
        "BygningServiceWS: Uventet SOAP‑struktur (mangler Response-element)"
      );
    }
    const responseData = body[responseKey];

    // 'return' elementet inneholder listen av 'item' (ByggId-objekter)
    const returnElement = responseData.return ?? responseData["ns2:return"]; // ns2 er et eksempel, kan variere
    if (!returnElement) return []; // Ingen bygg funnet eller uventet struktur

    // Hvert 'item' er et ByggId-objekt, som typisk har en 'value' eller 'dom:value'
    const items = Array.isArray(returnElement.item) ? returnElement.item : (returnElement.item ? [returnElement.item] : []);

    const idStrings: string[] = items.map((item: any) => String(item.value ?? item["dom:value"] ?? "")).filter(Boolean);

    return idStrings
      .map((n: string): number => Number(n))
      .filter((x) => Number.isFinite(x) && x > 0);
  }

  // -------------------- helpers --------------------
  private renderRequest(id: number, ctx: MatrikkelContext): string {
  console.log("<<<<< BygningClient.renderRequest KALLER MED findByggForMatrikkelenhet >>>>>");
    return `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:byg="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Body>
    <byg:findByggForMatrikkelenhet>
      <byg:matrikkelenhetId>${id}</byg:matrikkelenhetId>
      <byg:matrikkelContext>
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${ctx.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>${ctx.snapshotVersion}</dom:timestamp></dom:snapshotVersion>
      </byg:matrikkelContext>
    </byg:findByggForMatrikkelenhet>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

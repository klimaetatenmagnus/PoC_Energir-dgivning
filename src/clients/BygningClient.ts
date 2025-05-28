// src/clients/BygningClient.ts
// ---------------------------------------------------------------------------
// Klient mot Matrikkels BygningServiceWS ‑ henter bygg‑ID‑er for en
// matrikkelenhets‑ID.  Prefikset på <matrikkelContext> må være byg: for at
// tjenesten skal kjenne igjen parametret.
// ---------------------------------------------------------------------------

import axios from "axios";

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
    const xml = this.renderRequest(matrikkelenhetsId, ctx);

    const { data } = await axios.post(`${this.baseUrl}/BygningServiceWS`, xml, {
      headers: { "Content-Type": "text/xml;charset=UTF-8" },
      auth: { username: this.username, password: this.password },
      validateStatus: (s) => s < 500,
    });

    // soap:Fault?
    if (/<soap:Fault>/i.test(data)) {
      const msg =
        data.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] ??
        "ukjent SOAP-feil";
      throw new Error("BygningServiceWS: " + msg);
    }

    // plukk ut <byg:bygningId>123</byg:bygningId>
    const idStrings: string[] = (
      data.match(/<byg:bygningId>(\d+)<\/byg:bygningId>/g) ?? []
    ).map((m: string): string => m.replace(/<\/?[^>]+>/g, ""));

    return idStrings
      .map((n: string): number => Number(n))
      .filter((x) => Number.isFinite(x) && x > 0);
  }

  // -------------------- helpers --------------------
  private renderRequest(id: number, ctx: MatrikkelContext): string {
    return `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:byg="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soapenv:Body>
    <byg:findBygningIdsForMatrikkelenhetId>
      <byg:matrikkelenhetId>${id}</byg:matrikkelenhetId>
      <byg:matrikkelContext>
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${ctx.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>${ctx.snapshotVersion}</dom:timestamp></dom:snapshotVersion>
      </byg:matrikkelContext>
    </byg:findBygningIdsForMatrikkelenhetId>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

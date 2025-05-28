// src/clients/StoreClient.ts
// ---------------------------------------------------------------------------
// Klient mot Matrikkels StoreServiceWS.  Brukes til å hente selve "Bygg"‑
// bobler (komplette objekter) når vi allerede har bygnings‑ID‑ene fra
// BygningServiceWS.
// ---------------------------------------------------------------------------

import axios from "axios";
import { XMLParser } from "fast-xml-parser";

export interface MatrikkelCtx {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: string;
}

export interface ByggInfo {
  byggeår: number | null;
  bruksareal: number | null;
  antBruksenheter: number | null;
}

const parser = new XMLParser({ ignoreAttributes: false });

async function soap(
  url: string,
  xml: string,
  auth: { username: string; password: string }
) {
  const { data } = await axios.post(url, xml, {
    headers: { "Content-Type": "text/xml;charset=UTF-8" },
    auth,
  });
  return parser.parse(data) as any;
}

export class StoreClient {
  constructor(
    private baseUrl: string,
    private username: string,
    private password: string
  ) {}

  /** Hent ett Bygg‑objekt og returner relevante felter. */
  async getBygg(id: number, ctx: MatrikkelCtx): Promise<ByggInfo> {
    const xml = this.renderGetObjectXml(id, ctx);
    const json = await soap(`${this.baseUrl}/StoreServiceWS`, xml, {
      username: this.username,
      password: this.password,
    });

    const body = json["soap:Envelope"]["soap:Body"];
    const ret =
      body.getObjectResponse?.return ?? body["ns2:getObjectResponse"]?.return;
    if (!ret) throw new Error("StoreServiceWS ga uventet struktur");

    const bygg = ret.bygg ?? ret["byg:bygg"];
    const data = bygg?.byggdata ?? {};

    return {
      byggeår: data?.byggeår != null ? Number(data.byggeår) : null,
      bruksareal: data?.bruksareal != null ? Number(data.bruksareal) : null,
      antBruksenheter:
        data?.antBruksenheter != null ? Number(data.antBruksenheter) : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  /** XML‑mal for StoreServiceWS.getObject (Bygg) */
  private renderGetObjectXml(id: number, ctx: MatrikkelCtx) {
    return `<?xml version="1.0"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store"
                  xmlns:byg="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/bygning"
                  xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body>
    <sto:getObject>
      <sto:id xsi:type="byg:ByggId">
        <dom:value>${id}</dom:value>
      </sto:id>
      ${this.ctxFragment(ctx)}
    </sto:getObject>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private ctxFragment(ctx: MatrikkelCtx) {
    return `<sto:matrikkelContext xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <sto:locale>${ctx.locale}</sto:locale>
  <sto:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</sto:brukOriginaleKoordinater>
  <sto:koordinatsystemKodeId><sto:value>${ctx.koordinatsystemKodeId}</sto:value></sto:koordinatsystemKodeId>
  <sto:systemVersion>${ctx.systemVersion}</sto:systemVersion>
  <sto:klientIdentifikasjon>${ctx.klientIdentifikasjon}</sto:klientIdentifikasjon>
  <sto:snapshotVersion><sto:timestamp>${ctx.snapshotVersion}</sto:timestamp></sto:snapshotVersion>
</sto:matrikkelContext>`;
  }
}

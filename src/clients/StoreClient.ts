// src/clients/StoreClient.ts
// ---------------------------------------------------------------------------
// Klient mot Matrikkels StoreServiceWS. Henter komplette «Bygg»-objekter når
// vi allerede har Bygg-ID-ene fra BygningServiceWS.
// ---------------------------------------------------------------------------

import axios from "axios";
import { XMLParser } from "fast-xml-parser";

console.log("[StoreClient ✨] process.env.LOG_SOAP =", process.env.LOG_SOAP);

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

// -------------------------------------------------------------
//  Parser-oppsett: Fjern ns-prefiks for enklere JSON-stier
// -------------------------------------------------------------
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true, // <byg:bygg> → bygg
});

async function soap(
  url: string,
  xml: string,
  auth: { username: string; password: string }
) {
  try {
    const { data } = await axios.post(url, xml, {
      headers: { "Content-Type": "text/xml;charset=UTF-8" },
      auth,
    });

    if (process.env.LOG_SOAP) {
      const pretty =
        typeof data === "string"
          ? data.replace(/></g, ">\n<")
          : JSON.stringify(data, null, 2);
      console.log(
        "\n── StoreServiceWS XML start ──\n" +
          pretty +
          "\n── StoreServiceWS XML slutt ──"
      );
    }

    return parser.parse(data) as any;
  } catch (e: any) {
    if (process.env.LOG_SOAP) {
      console.error(
        "[StoreClient] SOAP-feil",
        e.response?.status,
        e.response?.statusText
      );
      if (typeof e.response?.data === "string") {
        console.error(e.response.data.replace(/></g, ">\n<"));
      }
    }
    throw e;
  }
}

export class StoreClient {
  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {}

  /** Hent ett Bygg-objekt og returner feltene vi trenger */
  async getBygg(id: number, ctx: MatrikkelCtx): Promise<ByggInfo> {
    const xml = this.renderGetObjectXml(id, ctx);

    const json = await soap(`${this.baseUrl}/StoreServiceWS`, xml, {
      username: this.username,
      password: this.password,
    });

    const envelope = json.Envelope ?? json["soap:Envelope"];
    const body = envelope?.Body ?? envelope?.["soap:Body"];
    const ret = body?.getObjectResponse?.return ?? body?.return;
    if (!ret) throw new Error("StoreServiceWS ga uventet struktur");

    const bygg = ret.bygg; // ns-prefiks fjernet
    const data = bygg?.byggdata ?? {};

    if (process.env.LOG_SOAP) {
      console.log("[StoreClient] byggdata keys →", Object.keys(data));
    }

    return {
      byggeår: data.byggeaar != null ? Number(data.byggeaar) : null,
      bruksareal: data.bruksareal != null ? Number(data.bruksareal) : null,
      antBruksenheter:
        data.antBruksenheter != null ? Number(data.antBruksenheter) : null,
    };
  }

  // -----------------------------------------------------------
  // XML-mal for StoreServiceWS.getObject (Bygg)
  // -----------------------------------------------------------
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
    return `<sto:matrikkelContext xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store">
    <sto:locale>${ctx.locale}</sto:locale>
  <sto:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</sto:brukOriginaleKoordinater>
  <sto:koordinatsystemKodeId><sto:value>${ctx.koordinatsystemKodeId}</sto:value></sto:koordinatsystemKodeId>
  <sto:systemVersion>${ctx.systemVersion}</sto:systemVersion>
  <sto:klientIdentifikasjon>${ctx.klientIdentifikasjon}</sto:klientIdentifikasjon>
  <sto:snapshotVersion><sto:timestamp>${ctx.snapshotVersion}</sto:timestamp></sto:snapshotVersion>
</sto:matrikkelContext>`;
  }
}

// src/clients/StoreClient.ts
// ---------------------------------------------------------------------------
// Klient mot Matrikkel-APIets StoreServiceWS (henter komplette «Bygg»-objekter)
// ---------------------------------------------------------------------------

import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

console.log("[StoreClient] LOG_SOAP =", process.env.LOG_SOAP);

/** Kontekst-objekt som sendes i alle kall mot StoreServiceWS */
export interface MatrikkelCtx {
  locale: string;
  /** true  = returner originale koordinater (ingen transformasjon)
   *  false = transformer til koordinatsystemKodeId               */
  brukOriginaleKoordinater: boolean;
  /** SOSI/EPSG-kode for ønsket koordinatsystem.
   *  Ignorert hvis brukOriginaleKoordinater === true            */
  koordinatsystemKodeId: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  /** timestamp-streng (yyyy-MM-dd'T'HH:mm:ss) fra /versions-endepunktet */
  snapshotVersion: string;
}

/** Det eneste vi trenger videre i kjeden */
export interface ByggInfo {
  byggeår: number | null;
  bruksareal: number | null;
  antBruksenheter: number | null;
  antEtasjer: number | null;
  etasjer: {
    etasjenummer: number;
    bruksarealTotalt: number | null;
  }[];
}

// ───────────── fast-xml-parser konfigurasjon ────────────────
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true, // <byg:bygg> → bygg
});

// Hjelper for å lagre rå-SOAP på disk når LOG_SOAP=1
function dumpToFile(pretty: string) {
  try {
    const dir = path.resolve(process.cwd(), "soap-dumps");
    fs.mkdirSync(dir, { recursive: true });
    const filename = `store-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.xml`;
    fs.writeFileSync(path.join(dir, filename), pretty, "utf-8");
  } catch (e) {
    console.error(
      "[StoreClient] Klarte ikke å skrive SOAP-dump:",
      (e as Error).message
    );
  }
}

/** Utfører selve SOAP-kallet */
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
        "\n── StoreServiceWS XML START ──\n" +
          pretty +
          "\n── StoreServiceWS XML SLUTT ──"
      );
      dumpToFile(pretty);
    }
    return parser.parse(data) as any;
  } catch (e: any) {
    // Logg også SOAP-faults (HTTP 500)
    if (process.env.LOG_SOAP && e.response?.data) {
      const pretty =
        typeof e.response.data === "string"
          ? e.response.data.replace(/></g, ">\n<")
          : JSON.stringify(e.response.data, null, 2);
      console.error(
        `[StoreClient] SOAP-feil ${e.response.status} ${e.response.statusText}\n${pretty}`
      );
      dumpToFile(pretty);
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

  /** Henter et Bygg-objekt og returnerer kun feltene vi trenger.
   *  Prøver først transformasjon; ved kod-35-feil prøver vi på nytt
   *  med brukOriginaleKoordinater = true.                          */
  async getBygg(id: number, ctx: MatrikkelCtx): Promise<ByggInfo> {
    try {
      return await this.#hent(id, ctx);
    } catch (e: any) {
      const fault: string = e?.response?.data ?? "";
      const isTransform35 =
        typeof fault === "string" &&
        fault.includes("Transformasjon feilet med kode 35");
      const alreadyOriginal = ctx.brukOriginaleKoordinater;

      if (isTransform35 && !alreadyOriginal) {
        console.warn(
          `[StoreClient] Transformasjon feilet (kode 35). Prøver igjen med originale koordinater …`
        );
        return await this.#hent(id, { ...ctx, brukOriginaleKoordinater: true });
      }
      throw e; // ukjent feil → la kallet feile videre
    }
  }

  // ───────────── SOAP-payload helpers ─────────────

  /** Faktisk henting; kalles én eller to ganger via getBygg() */
  async #hent(id: number, ctx: MatrikkelCtx): Promise<ByggInfo> {
    const xml = this.renderGetObjectXml(id, ctx);
    const json = await soap(`${this.baseUrl}/StoreServiceWS`, xml, {
      username: this.username,
      password: this.password,
    });

    const envelope = json.Envelope ?? json["soap:Envelope"];
    const body = envelope?.Body ?? envelope?.["soap:Body"];

    // → Vis evt. SOAP-fault eksplisitt
    if (body?.Fault || body?.faultcode) {
      const msg =
        body.Fault?.faultstring ??
        body["soap:Fault"]?.faultstring ??
        "Ukjent SOAP-fault";
      throw new Error(`StoreServiceWS fault: ${msg}`);
    }

    const ret =
      body?.getObjectResponse?.return ??
      body?.return ??
      body?.["ns2:getObjectResponse"]?.return;
    if (!ret) throw new Error("StoreServiceWS ga uventet struktur");

    const bygg = ret.bygg; // ns-prefiks er fjernet

    if (process.env.LOG_SOAP) {
      console.log("[StoreClient] RÅ <Bygg> →", JSON.stringify(bygg, null, 2));
    }

    /* ---------- 1) byggeår / enheter ---------- */
    const etasjeData = (bygg as any)?.etasjedata ?? {};
    const byggeår =
      (bygg as any)?.bygningsstatusHistorikker?.item?.dato?.date != null
        ? Number((bygg as any).bygningsstatusHistorikker.item.dato.date)
        : null;

    const antBruksenheter =
      (bygg as any)?.etasjedata?.antallBoenheter != null
        ? Number((bygg as any).etasjedata.antallBoenheter)
        : null;

    /* ---------- 2) BRA & etasjer ---------- */
    const etasjeItems: any[] = Array.isArray((bygg as any)?.etasjer?.item)
      ? (bygg as any).etasjer.item
      : (bygg as any)?.etasjer?.item
      ? [(bygg as any).etasjer.item]
      : [];

    const etasjer = etasjeItems.map((e) => ({
      etasjenummer: Number(e.etasjenummer),
      bruksarealTotalt:
        e.bruksarealTotalt != null ? Number(e.bruksarealTotalt) : null,
    }));

    const antEtasjer =
      etasjer.length ||
      (etasjeData.antallEtasjer != null
        ? Number(etasjeData.antallEtasjer)
        : null);

    // BRA – først fra etasjedata, ellers sum av etasjene
    let bruksareal: number | null = null;
    if (etasjeData.bruksarealTotalt != null) {
      bruksareal = Number(etasjeData.bruksarealTotalt);
    } else if (etasjer.length) {
      const sum = etasjer.reduce((s, e) => s + (e.bruksarealTotalt ?? 0), 0);
      bruksareal = sum || null;
    }

    /* ---------- resultat ---------- */
    return {
      byggeår,
      bruksareal,
      antBruksenheter,
      antEtasjer,
      etasjer,
    };
  }

  /** Lager SOAP-envelope for getObject-kallet */
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

  /**
   * NB: Ytter-elementet ligger i *service/store*-navnerom,
   *     mens barna skal ligge i *domain*-navnerom – ellers får vi SOAP 500.
   *     Rekkefølgen **må** være identisk med XSD-en.
   */
  private ctxFragment(ctx: MatrikkelCtx) {
    return `<sto:matrikkelContext xmlns:sto="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/store"
                                 xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <dom:locale>${ctx.locale}</dom:locale>
  <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
  <dom:koordinatsystemKodeId><dom:value>${ctx.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>
  <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
  <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
  <dom:snapshotVersion><dom:timestamp>${ctx.snapshotVersion}</dom:timestamp></dom:snapshotVersion>
</sto:matrikkelContext>`;
  }
}

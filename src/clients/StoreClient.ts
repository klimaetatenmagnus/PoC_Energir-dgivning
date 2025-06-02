// src/clients/StoreClient.ts
// ---------------------------------------------------------------------------
// Klient mot Matrikkel-APIets StoreServiceWS (henter komplette «Bygg»-objekter)
// ---------------------------------------------------------------------------

import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

console.log("[StoreClient] LOG_SOAP =", process.env.LOG_SOAP);

/* ---------------------------------------------------------------------------
 * Type-definisjoner
 * ------------------------------------------------------------------------- */
export interface MatrikkelCtx {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: string; // ISO-timestamp fra /versions-endepunktet
}

export interface EtasjeInfo {
  etasjenummer: number;
  bruksarealTotalt: number | null;
}

export interface ByggInfo {
  byggeår: number | null;
  /** Totalt bruksareal (BRA) for bygget – i m² */
  bra_m2: number | null;
  antBruksenheter: number | null;
  antEtasjer: number | null;
  etasjer: EtasjeInfo[];
  /** Oppslagstabell { etasjenummer: BRA } */
  bruksarealEtasjer: Record<number, number | null>;
}

/* ---------------------------------------------------------------------------
 * XML-parser
 * ------------------------------------------------------------------------- */
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true, // <ns10:etasjedata> → etasjedata
});

/* ---------------------------------------------------------------------------
 * Hjelper: Dump rå SOAP til disk ved LOG_SOAP=1 (nyttig for feilsøking)
 * ------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
 * Utfør selve SOAP-kallet
 * ------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
 * Hovedklient
 * ------------------------------------------------------------------------- */
export class StoreClient {
  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {}

  /** Henter et Bygg-objekt og returnerer kun feltene vi trenger. */
  async getBygg(id: number, ctx: MatrikkelCtx): Promise<ByggInfo> {
    try {
      return await this.#hent(id, ctx);
    } catch (e: any) {
      const fault: string = e?.response?.data ?? "";
      const isTransform35 =
        typeof fault === "string" &&
        fault.includes("Transformasjon feilet med kode 35");

      if (isTransform35 && !ctx.brukOriginaleKoordinater) {
        console.warn(
          "[StoreClient] Transformasjon feilet (kode 35). Prøver med originale koordinater …"
        );
        return await this.#hent(id, { ...ctx, brukOriginaleKoordinater: true });
      }
      throw e; // ukjent feil
    }
  }

  /* -------------------------------------------------------------------------
   * Intern: gjør selve henting + XML-parsing
   * ----------------------------------------------------------------------- */
  async #hent(id: number, ctx: MatrikkelCtx): Promise<ByggInfo> {
    const xml = this.renderGetObjectXml(id, ctx);
    const json = await soap(`${this.baseUrl}/StoreServiceWS`, xml, {
      username: this.username,
      password: this.password,
    });

    /* ───── Pakk ut envelope/body ───── */
    const envelope = json.Envelope ?? json["soap:Envelope"];
    const body = envelope?.Body ?? envelope?.["soap:Body"];

    /* ───── Håndter evt. SOAP-fault ──── */
    if (body?.Fault || body?.faultcode) {
      const msg =
        body.Fault?.faultstring ??
        body["soap:Fault"]?.faultstring ??
        "Ukjent SOAP-fault";
      throw new Error(`StoreServiceWS fault: ${msg}`);
    }

    /* ───── Hent <return> ────────────── */
    const ret =
      body?.getObjectResponse?.return ??
      body?.return ??
      body?.["ns2:getObjectResponse"]?.return;
    if (!ret)
      throw new Error("StoreServiceWS ga uventet struktur – mangler <return>");

    const bygg = (ret as any).bygg ?? ret; // namespace-prefiks fjernet av XMLParser

    if (process.env.LOG_SOAP) {
      console.log("[StoreClient] RÅ <Bygg> →", JSON.stringify(bygg, null, 2));
    }

    /* ---------------------------------------------------------------------
       1) Byggeår + antall boenheter
     --------------------------------------------------------------------- */
    const etasjeData = (bygg as any)?.etasjedata ?? {};
    const histRaw = (bygg as any)?.bygningsstatusHistorikker?.item;
    const hist = Array.isArray(histRaw) ? histRaw[0] : histRaw ?? {};

    let byggeår: number | null = null;
    const datoStr = hist?.dato?.date;

    if (typeof datoStr === "string") {
      // forventet format "YYYY-MM-DD"
      const yy = Number(datoStr.slice(0, 4));
      byggeår = isNaN(yy) ? null : yy;
    } else if (datoStr != null) {
      // kunne i teorien komme som årstall uten bindestreker
      const yy = Number(datoStr);
      byggeår = isNaN(yy) ? null : yy;
    }

    const antBruksenheter: number | null =
      etasjeData?.antallBoenheter != null
        ? Number(etasjeData.antallBoenheter)
        : null;

    /* ---------------------------------------------------------------------
       2) Detaljer pr. etasje
     --------------------------------------------------------------------- */
    const etasjeItems: any[] = Array.isArray((bygg as any)?.etasjer?.item)
      ? (bygg as any).etasjer.item
      : (bygg as any)?.etasjer?.item
      ? [(bygg as any).etasjer.item]
      : [];

    const etasjer: EtasjeInfo[] = etasjeItems.map((e) => ({
      etasjenummer: Number(e.etasjenummer),
      bruksarealTotalt:
        e.bruksarealTotalt != null ? Number(e.bruksarealTotalt) : null,
    }));

    /* ---------------------------------------------------------------------
       3) Antall etasjer
     --------------------------------------------------------------------- */
    const antEtasjer: number | null =
      etasjer.length > 0
        ? etasjer.length
        : etasjeData?.antallEtasjer != null
        ? Number(etasjeData.antallEtasjer)
        : null;

    /* ---------------------------------------------------------------------
       4) Totalt BRA  (bra_m2)
     --------------------------------------------------------------------- */
    let bra_m2: number | null = null;

    if (etasjeData?.bruksarealTotalt != null) {
      bra_m2 = Number(etasjeData.bruksarealTotalt);
    } else if (etasjer.length) {
      const sum = etasjer.reduce((s, e) => s + (e.bruksarealTotalt ?? 0), 0);
      bra_m2 = sum || null;
    }

    /* ---------------------------------------------------------------------
       5) Oppslagstabell { etasje: BRA }
     --------------------------------------------------------------------- */
    const bruksarealEtasjer: Record<number, number | null> = {};
    etasjer.forEach(
      (e) => (bruksarealEtasjer[e.etasjenummer] = e.bruksarealTotalt)
    );

    /* ---------------------------------------------------------------------
       6) Returnér resultatet
     --------------------------------------------------------------------- */
    return {
      byggeår,
      bra_m2,
      antBruksenheter,
      antEtasjer,
      etasjer,
      bruksarealEtasjer,
    };
  }

  /* -------------------------------------------------------------------------
   * SOAP-payload helpers
   * ----------------------------------------------------------------------- */
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

/**
 * Hjelpeklient for Matrikkel: finn bruksenheter og unike byggIds.
 *
 * Eksisterende BruksenhetClient/StoreClient har parsere som ikke fanger alle
 * feltene vi trenger (spesielt byggId og matrikkelenhetId). Denne helperen går
 * rett på SOAP-responsen og ekstraherer det vi trenger med regex.
 */
import axios from "axios";
import { matrikkelEndpoint } from "../../src/utils/endpoints.ts";
import { StoreClient } from "../../src/clients/StoreClient.ts";
import type { MatrikkelContext } from "../../src/clients/MatrikkelClient.ts";

const CTX_XML = `
  <dom:matrikkelContext xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
    <dom:locale>no_NO_B</dom:locale>
    <dom:brukOriginaleKoordinater>true</dom:brukOriginaleKoordinater>
    <dom:koordinatsystemKodeId><dom:value>25833</dom:value></dom:koordinatsystemKodeId>
    <dom:systemVersion>trunk</dom:systemVersion>
    <dom:klientIdentifikasjon>eiendomsgruppe</dom:klientIdentifikasjon>
    <dom:snapshotVersion><dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp></dom:snapshotVersion>
  </dom:matrikkelContext>`;

export interface BruksenhetRaw {
  id: number;
  byggId?: number;
  matrikkelenhetId?: number;
  bruksarealM2?: number;
}

export class MatrikkelBruksenhetHelper {
  private readonly storeClient: StoreClient;
  private readonly bruksenhetEndpoint: string;

  constructor(
    baseUrl: string,
    private readonly username: string,
    private readonly password: string
  ) {
    this.storeClient = new StoreClient(
      matrikkelEndpoint(baseUrl, "StoreService"),
      username,
      password
    );
    this.bruksenhetEndpoint = matrikkelEndpoint(baseUrl, "BruksenhetService");
  }

  /** Henter bruksenhet-IDer for en matrikkelenhet. */
  async findBruksenhetIdsForMatrikkelenhet(
    matrikkelenhetId: number
  ): Promise<number[]> {
    const body = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:bru="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
               xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
  <soap:Body>
    <bru:findBruksenheterForMatrikkelenhet>
      <bru:matrikkelenhetId><dom:value>${matrikkelenhetId}</dom:value></bru:matrikkelenhetId>
      ${CTX_XML.replace(/dom:matrikkelContext/g, "bru:matrikkelContext")}
    </bru:findBruksenheterForMatrikkelenhet>
  </soap:Body>
</soap:Envelope>`;

    const resp = await axios.post(this.bruksenhetEndpoint, body, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          '"http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning/BruksenhetService/findBruksenheterForMatrikkelenhetRequest"',
      },
      auth: { username: this.username, password: this.password },
      timeout: 30_000,
      validateStatus: () => true,
    });

    if (resp.status !== 200) return [];
    const xml = String(resp.data);
    const matches = [
      ...xml.matchAll(/<(?:ns\d+:)?item>\s*<value>(\d+)<\/value>\s*<\/(?:ns\d+:)?item>/g),
    ];
    return matches.map((m) => Number(m[1]));
  }

  /** Henter bruksenhet med byggId/matrikkelenhetId/bruksareal ved å parse rå XML. */
  async getBruksenhet(id: number): Promise<BruksenhetRaw | null> {
    try {
      const xml = await this.storeClient.getObjectXml(id, "BruksenhetId");
      const byggId = xml.match(/<ns\d+:byggId>\s*<value>(\d+)/)?.[1];
      const matId = xml.match(/<ns\d+:matrikkelenhetId>\s*<value>(\d+)/)?.[1];
      const bra = xml.match(/<ns\d+:bruksareal>([\d.]+)/)?.[1];
      return {
        id,
        byggId: byggId ? Number(byggId) : undefined,
        matrikkelenhetId: matId ? Number(matId) : undefined,
        bruksarealM2: bra ? Number(bra) : undefined,
      };
    } catch {
      return null;
    }
  }

  /** Helper: for en liste av bruksenhet-IDer, hent byggId og dedup til unike. */
  async mapBruksenhetIdsToByggIds(
    bruksenhetIds: number[],
    concurrency = 10
  ): Promise<{ byggIdCount: Map<number, number>; misses: number }> {
    const byggIdCount = new Map<number, number>();
    let misses = 0;
    for (let i = 0; i < bruksenhetIds.length; i += concurrency) {
      const batch = bruksenhetIds.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((id) => this.getBruksenhet(id))
      );
      for (const r of results) {
        if (r?.byggId) {
          byggIdCount.set(r.byggId, (byggIdCount.get(r.byggId) ?? 0) + 1);
        } else {
          misses++;
        }
      }
    }
    return { byggIdCount, misses };
  }
}

// For kompatibilitet med eksisterende MatrikkelContext
export const _defaultMatrikkelContext: MatrikkelContext = {
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "eiendomsgruppe",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
};

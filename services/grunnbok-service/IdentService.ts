import {
  GrunnbokSoapClient,
  GRUNNBOK_NAMESPACES,
  buildContextXml,
  extractFirst,
} from "./GrunnbokSoapClient.ts";
import type { MatrikkelIdent } from "./types.ts";

const NS = {
  ident: GRUNNBOK_NAMESPACES.ident,
  gi: GRUNNBOK_NAMESPACES.grunnboksidenter,
  bt: GRUNNBOK_NAMESPACES.basistyper,
};

export class IdentService extends GrunnbokSoapClient {
  /**
   * Slår opp grunnbok-internal matrikkelenhetId fra kommunenummer/gnr/bnr.
   * Returnerer null hvis matrikkelenheten ikke finnes.
   */
  async findMatrikkelenhetId(ident: MatrikkelIdent): Promise<string | null> {
    const ctxXml = buildContextXml(this.ctx);
    const body = `
      <ident:findMatrikkelenhetIdsForIdents>
        <ident:idents>
          <gi:item>
            <gi:kommunenummer>${ident.kommunenummer}</gi:kommunenummer>
            <gi:gaardsnummer>${ident.gaardsnummer}</gi:gaardsnummer>
            <gi:bruksnummer>${ident.bruksnummer}</gi:bruksnummer>
            <gi:festenummer>${ident.festenummer ?? 0}</gi:festenummer>
            <gi:seksjonsnummer>${ident.seksjonsnummer ?? 0}</gi:seksjonsnummer>
          </gi:item>
        </ident:idents>
        <ident:grunnbokContext>${ctxXml}</ident:grunnbokContext>
      </ident:findMatrikkelenhetIdsForIdents>
    `;

    const envelope = this.wrapEnvelope(NS, body);
    const xml = await this.postSoap("IdentServiceWS", envelope);
    return extractFirst(
      xml,
      /<ns4:value>\s*<ns3:value>(\d+)<\/ns3:value>\s*<\/ns4:value>/
    );
  }

  /**
   * Slår opp grunnbok-internal borettslagId fra organisasjonsnummer.
   * Returnerer null hvis borettslaget ikke finnes.
   */
  async findBorettslagId(organisasjonsnummer: string): Promise<string | null> {
    const ctxXml = buildContextXml(this.ctx);
    const body = `
      <ident:findBorettslagIdsForIdents>
        <ident:idents>
          <gi:item>
            <gi:borettslagnummer>${organisasjonsnummer}</gi:borettslagnummer>
          </gi:item>
        </ident:idents>
        <ident:grunnbokContext>${ctxXml}</ident:grunnbokContext>
      </ident:findBorettslagIdsForIdents>
    `;

    const envelope = this.wrapEnvelope(NS, body);
    const xml = await this.postSoap("IdentServiceWS", envelope);
    return extractFirst(
      xml,
      /<ns4:value>\s*<ns3:value>(\d+)<\/ns3:value>\s*<\/ns4:value>/
    );
  }
}

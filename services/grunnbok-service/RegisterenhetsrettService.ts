import {
  GrunnbokSoapClient,
  GRUNNBOK_NAMESPACES,
  buildContextXml,
  extractMatches,
} from "./GrunnbokSoapClient.ts";

const NS = {
  rer: GRUNNBOK_NAMESPACES.registerenhetsrett,
  rre: GRUNNBOK_NAMESPACES.registerenhetDomain,
  bt: GRUNNBOK_NAMESPACES.basistyper,
};

export class RegisterenhetsrettService extends GrunnbokSoapClient {
  /**
   * Finner alle rett-Ids (hjemmelsretter m.m.) som er knyttet til en matrikkelenhet.
   */
  async findRetterForEnheter(matrikkelenhetId: string): Promise<string[]> {
    const ctxXml = buildContextXml(this.ctx);
    const body = `
      <rer:findRetterForEnheter>
        <rer:registerenhetIds>
          <rre:item><bt:value>${matrikkelenhetId}</bt:value></rre:item>
        </rer:registerenhetIds>
        <rer:grunnbokContext>${ctxXml}</rer:grunnbokContext>
      </rer:findRetterForEnheter>
    `;

    const envelope = this.wrapEnvelope(NS, body);
    const xml = await this.postSoap(
      "RegisterenhetsrettServiceWS",
      envelope
    );
    return extractMatches(
      xml,
      /<ns2:item>\s*<value>(\d+)<\/value>\s*<\/ns2:item>/
    );
  }
}

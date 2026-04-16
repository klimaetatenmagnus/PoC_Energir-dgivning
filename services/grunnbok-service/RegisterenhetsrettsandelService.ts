import {
  GrunnbokSoapClient,
  GRUNNBOK_NAMESPACES,
  buildContextXml,
  extractMatches,
} from "./GrunnbokSoapClient.ts";

const NS = {
  reras: GRUNNBOK_NAMESPACES.registerenhetsrettsandel,
  rer: GRUNNBOK_NAMESPACES.registerenhetDomain,
  bt: GRUNNBOK_NAMESPACES.basistyper,
};

export class RegisterenhetsrettsandelService extends GrunnbokSoapClient {
  /**
   * Finner alle rettighetsandel-Ids for en rett.
   */
  async findAndelerIRetter(rettId: string): Promise<string[]> {
    const ctxXml = buildContextXml(this.ctx);
    const body = `
      <reras:findAndelerIRetter>
        <reras:rettIds>
          <rer:item><bt:value>${rettId}</bt:value></rer:item>
        </reras:rettIds>
        <reras:grunnbokContext>${ctxXml}</reras:grunnbokContext>
      </reras:findAndelerIRetter>
    `;

    const envelope = this.wrapEnvelope(NS, body);
    const xml = await this.postSoap(
      "RegisterenhetsrettsandelServiceWS",
      envelope
    );
    return extractMatches(
      xml,
      /<ns2:item>\s*<value>(\d+)<\/value>\s*<\/ns2:item>/
    );
  }
}

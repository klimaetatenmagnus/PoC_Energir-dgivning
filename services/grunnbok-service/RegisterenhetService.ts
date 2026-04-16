import {
  GrunnbokSoapClient,
  GRUNNBOK_NAMESPACES,
  buildContextXml,
  extractMatches,
} from "./GrunnbokSoapClient.ts";

const NS = {
  re: GRUNNBOK_NAMESPACES.registerenhet,
  rre: GRUNNBOK_NAMESPACES.registerenhetDomain,
  reg: GRUNNBOK_NAMESPACES.register,
  bt: GRUNNBOK_NAMESPACES.basistyper,
  xsi: GRUNNBOK_NAMESPACES.xsi,
};

export class RegisterenhetService extends GrunnbokSoapClient {
  /**
   * Finner alle seksjonIds for en matrikkelenhet (sameie).
   */
  async findSeksjonerFor(matrikkelenhetId: string): Promise<string[]> {
    const ctxXml = buildContextXml(this.ctx);
    const body = `
      <re:findSeksjonerFor>
        <re:registerenhetIds>
          <rre:item><bt:value>${matrikkelenhetId}</bt:value></rre:item>
        </re:registerenhetIds>
        <re:grunnbokContext>${ctxXml}</re:grunnbokContext>
      </re:findSeksjonerFor>
    `;

    const envelope = this.wrapEnvelope(NS, body);
    const xml = await this.postSoap("RegisterenhetServiceWS", envelope);
    return extractMatches(
      xml,
      /<ns2:item><value>(\d+)<\/value><\/ns2:item>/
    );
  }

  /**
   * Finner alle borettslagsandel-Ids for et borettslag.
   * BorettslagId krever xsi:type (ellers får man mapping-feil).
   */
  async findBorettslagsandelerForBorettslag(
    borettslagId: string
  ): Promise<string[]> {
    const ctxXml = buildContextXml(this.ctx);
    const body = `
      <re:findBorettslagsandelerForBorettslag>
        <re:borettslagId xsi:type="reg:BorettslagId">
          <bt:value>${borettslagId}</bt:value>
        </re:borettslagId>
        <re:grunnbokContext>${ctxXml}</re:grunnbokContext>
      </re:findBorettslagsandelerForBorettslag>
    `;

    const envelope = this.wrapEnvelope(NS, body);
    const xml = await this.postSoap("RegisterenhetServiceWS", envelope);
    return extractMatches(
      xml,
      /<ns2:item><value>(\d+)<\/value><\/ns2:item>/
    );
  }
}

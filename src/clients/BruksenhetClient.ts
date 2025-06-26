import { MatrikkelContext } from "./common.ts";
import axios from "axios";

export class BruksenhetClient {
  private readonly baseUrl: string;

  constructor(
    endpoint: string,
    private readonly username: string,
    private readonly password: string
  ) {
    this.baseUrl = endpoint;
  }

  async findBruksenheterForBygg(byggId: number, context?: MatrikkelContext) {
    const ctx = context || this.defaultContext();
    
    const body = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:bru="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
               xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
               xmlns:byg="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/bygning">
  <soap:Body>
    <bru:findBruksenheterForBygg>
      <bru:byggId>
        <dom:value>${byggId}</dom:value>
      </bru:byggId>
      ${this.buildMatrikkelContext(ctx)}
    </bru:findBruksenheterForBygg>
  </soap:Body>
</soap:Envelope>`;

    const response = await this.soapCall(body, "findBruksenheterForBygg");
    return this.parseBruksenheterResponse(response);
  }

  async findBruksenheterForMatrikkelenhet(matrikkelenhetId: number, context?: MatrikkelContext) {
    const ctx = context || this.defaultContext();
    
    const body = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:bru="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning"
               xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
               xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet">
  <soap:Body>
    <bru:findBruksenheterForMatrikkelenhet>
      <bru:matrikkelenhetId>
        <dom:value>${matrikkelenhetId}</dom:value>
      </bru:matrikkelenhetId>
      ${this.buildMatrikkelContext(ctx)}
    </bru:findBruksenheterForMatrikkelenhet>
  </soap:Body>
</soap:Envelope>`;

    const response = await this.soapCall(body, "findBruksenheterForMatrikkelenhet");
    return this.parseBruksenheterResponse(response);
  }

  async findBruksenheterForVegadresse(
    kommunenummer: string,
    vegadresseNavn: string,
    husnummer: number,
    bokstav?: string,
    context?: MatrikkelContext
  ) {
    const ctx = context || this.defaultContext();
    
    const body = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:bru="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning">
  <soap:Body>
    <bru:findBruksenheterForVegadresse>
      <bru:kommunenummer>${kommunenummer}</bru:kommunenummer>
      <bru:vegadresseNavn>${vegadresseNavn}</bru:vegadresseNavn>
      <bru:husnummer>${husnummer}</bru:husnummer>
      ${bokstav ? `<bru:bokstav>${bokstav}</bru:bokstav>` : ''}
      ${this.buildMatrikkelContext(ctx)}
    </bru:findBruksenheterForVegadresse>
  </soap:Body>
</soap:Envelope>`;

    const response = await this.soapCall(body, "findBruksenheterForVegadresse");
    return this.parseBruksenheterResponse(response);
  }

  private defaultContext(): MatrikkelContext {
    return {
      locale: "no_NO_B",
      brukOriginaleKoordinater: true,
      koordinatsystemKodeId: 25833,
      systemVersion: "trunk",
      klientIdentifikasjon: "bruksenhet-client",
    };
  }

  private buildMatrikkelContext(ctx: MatrikkelContext): string {
    return `
      <bru:matrikkelContext xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain">
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId><dom:value>${ctx.koordinatsystemKodeId}</dom:value></dom:koordinatsystemKodeId>
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp></dom:snapshotVersion>
      </bru:matrikkelContext>
    `;
  }

  private async soapCall(xml: string, action: string): Promise<string> {
    const response = await axios.post(this.baseUrl, xml, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `"http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/bygning/BruksenhetService/${action}Request"`,
      },
      auth: {
        username: this.username,
        password: this.password,
      },
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  private parseBruksenheterResponse(xml: string): BruksenhetInfo[] {
    const bruksenheter: BruksenhetInfo[] = [];
    
    // Find all bruksenhet elements using regex
    const bruksenhetMatches = xml.matchAll(/<(?:ns\d+:)?bruksenhet[^>]*>([\s\S]*?)<\/(?:ns\d+:)?bruksenhet>/g);
    
    for (const match of bruksenhetMatches) {
      const bruksenhetXml = match[1];
      
      const id = this.extractValue(bruksenhetXml, "id");
      const bruksarealM2 = this.extractValue(bruksenhetXml, "bruksarealM2");
      const etasjenummer = this.extractValue(bruksenhetXml, "etasjenummer");
      const etasjer = this.extractValue(bruksenhetXml, "etasjer");
      const leilighetnummer = this.extractValue(bruksenhetXml, "leilighetnummer");
      const matrikkelenhetId = this.extractValue(bruksenhetXml, "matrikkelenhetId");
      const byggId = this.extractValue(bruksenhetXml, "byggId");
      
      if (id) {
        bruksenheter.push({
          id: parseInt(id),
          bruksarealM2: bruksarealM2 ? parseInt(bruksarealM2) : undefined,
          etasjenummer: etasjenummer || undefined,
          etasjer: etasjer || undefined,
          leilighetnummer: leilighetnummer || undefined,
          matrikkelenhetId: matrikkelenhetId ? parseInt(matrikkelenhetId) : undefined,
          byggId: byggId ? parseInt(byggId) : undefined,
        });
      }
    }
    
    return bruksenheter;
  }

  private extractValue(xml: string, tagName: string): string | null {
    // Try with value element first
    const valueMatch = xml.match(new RegExp(`<(?:ns\\d+:)?${tagName}[^>]*>.*?<(?:ns\\d+:)?value>(.*?)<\/(?:ns\\d+:)?value>.*?<\/(?:ns\\d+:)?${tagName}>`, 's'));
    if (valueMatch) {
      return valueMatch[1];
    }
    
    // Try direct content
    const directMatch = xml.match(new RegExp(`<(?:ns\\d+:)?${tagName}[^>]*>([^<]*)<\/(?:ns\\d+:)?${tagName}>`));
    if (directMatch) {
      return directMatch[1].trim();
    }
    
    return null;
  }
}

export interface BruksenhetInfo {
  id: number;
  bruksarealM2?: number;
  etasjenummer?: string;
  etasjer?: string;
  leilighetnummer?: string;
  matrikkelenhetId?: number;
  byggId?: number;
}
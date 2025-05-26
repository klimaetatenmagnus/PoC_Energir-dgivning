import axios from "axios";
import { XMLParser } from "fast-xml-parser";

interface MatrikkelehetsøkModel {
  kommunenummer: number;
  status: string;
  gardsnummer: number;
  bruksnummer: number;
}

interface MatrikkelContext {
  locale: string;
  brukOriginaleKoordinater: boolean;
  koordinatsystemKodeId: number;
  systemVersion: string;
  klientIdentifikasjon: string;
  snapshotVersion: string;
}

export class MatrikkelClient {
  constructor(
    private baseUrl: string,
    private username: string,
    private password: string
  ) {}

  async findMatrikkelenheter(
    søk: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ): Promise<number[]> {
    // 1) Bygg opp SOAP‐request (du har vel allerede samples/findMatrikkelenheter.xml)
    const xmlRequest = this.renderFindMatrikkelenheterXml(søk, ctx);

    // 2) Send request mot ditt proxy/API
    const res = await axios.post(
      `${this.baseUrl}/MatrikkelenhetServiceWS`,
      xmlRequest,
      {
        headers: {
          "Content-Type": "text/xml;charset=UTF-8",
          SOAPAction: `"findMatrikkelenheter"`,
        },
        auth: { username: this.username, password: this.password },
      }
    );

    // 3) Parse XML‐respons til JSON
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const json = parser.parse(res.data) as any;

    // 4) Naviger ned til array av <value>-elementer
    //    Path: Envelope.Body.findMatrikkelenheterResponse.return.item[].value
    const items =
      json["soap:Envelope"]["soap:Body"].findMatrikkelenheterResponse.return
        .item;

    // 5) hent ut value-feltet, som kan være en enkel string eller en liste
    const values = Array.isArray(items)
      ? items.map((it: any) => it.value)
      : [items.value];

    // 6) Konverter til number[] og returner
    return values.map((v: string) => Number(v));
  }

  private renderFindMatrikkelenheterXml(
    søk: MatrikkelehetsøkModel,
    ctx: MatrikkelContext
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope 
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:mat="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/service/matrikkelenhet"
    xmlns:mid="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain/matrikkelenhet"
    xmlns:dom="http://matrikkel.statkart.no/matrikkelapi/wsapi/v1/domain"
>
  <soapenv:Header/>
  <soapenv:Body>
    <mat:findMatrikkelenheter>
      <mat:matrikkelenhetsokModel>
        <mid:kommunenummer>${søk.kommunenummer}</mid:kommunenummer>
        <mid:status>${søk.status}</mid:status>
        <mid:gardsnummer>${søk.gardsnummer}</mid:gardsnummer>
        <mid:bruksnummer>${søk.bruksnummer}</mid:bruksnummer>
      </mat:matrikkelenhetsokModel>
      <mat:matrikkelContext>
        <dom:locale>${ctx.locale}</dom:locale>
        <dom:brukOriginaleKoordinater>${ctx.brukOriginaleKoordinater}</dom:brukOriginaleKoordinater>
        <dom:koordinatsystemKodeId>${ctx.koordinatsystemKodeId}</dom:koordinatsystemKodeId>
        <dom:systemVersion>${ctx.systemVersion}</dom:systemVersion>
        <dom:klientIdentifikasjon>${ctx.klientIdentifikasjon}</dom:klientIdentifikasjon>
        <dom:snapshotVersion><dom:timestamp>${ctx.snapshotVersion}</dom:timestamp></dom:snapshotVersion>
      </mat:matrikkelContext>
    </mat:findMatrikkelenheter>
  </soapenv:Body>
</soapenv:Envelope>`;
  }
}

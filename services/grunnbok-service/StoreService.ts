import {
  GrunnbokSoapClient,
  GRUNNBOK_NAMESPACES,
  buildContextXml,
  extractFirst,
} from "./GrunnbokSoapClient.ts";
import type {
  Registerenhetsrettsandel,
  Person,
  Borettslagsandel,
  Seksjon,
  Adresse,
} from "./types.ts";

const NS = {
  store: GRUNNBOK_NAMESPACES.store,
  rre: GRUNNBOK_NAMESPACES.registerenhetDomain,
  reg: GRUNNBOK_NAMESPACES.register,
  pers: GRUNNBOK_NAMESPACES.person,
  adr: GRUNNBOK_NAMESPACES.adresse,
  bt: GRUNNBOK_NAMESPACES.basistyper,
  xsi: GRUNNBOK_NAMESPACES.xsi,
};

/**
 * StoreService krever xsi:type på ID-parameteren for at grunnbok-motoren skal
 * vite hvilken konkret type det dreier seg om (ID-klassene er polymorfiske).
 */
export type StoreIdType =
  | "RegisterenhetsrettsandelId"
  | "RegisterenhetsrettId"
  | "MatrikkelenhetId"
  | "BorettslagsandelId"
  | "BorettslagId"
  | "SeksjonId"
  | "AdresseId"
  | "PersonId";

const ID_NAMESPACE_PREFIX: Record<StoreIdType, "rre" | "reg" | "pers" | "adr"> = {
  RegisterenhetsrettsandelId: "rre",
  RegisterenhetsrettId: "rre",
  MatrikkelenhetId: "rre",
  BorettslagsandelId: "rre",
  SeksjonId: "rre",
  AdresseId: "adr",
  BorettslagId: "reg",
  PersonId: "pers",
};

export class StoreService extends GrunnbokSoapClient {
  private async fetchRaw(
    id: string,
    idType: StoreIdType
  ): Promise<string> {
    const prefix = ID_NAMESPACE_PREFIX[idType];
    const ctxXml = buildContextXml(this.ctx);
    const body = `
      <store:getObject>
        <store:id xsi:type="${prefix}:${idType}">
          <bt:value>${id}</bt:value>
        </store:id>
        <store:grunnbokContext>${ctxXml}</store:grunnbokContext>
      </store:getObject>
    `;
    const envelope = this.wrapEnvelope(NS, body);
    return this.postSoap("StoreServiceWS", envelope);
  }

  async getRegisterenhetsrettsandel(
    id: string
  ): Promise<Registerenhetsrettsandel> {
    const xml = await this.fetchRaw(id, "RegisterenhetsrettsandelId");
    return {
      id,
      teller: Number(extractFirst(xml, /<ns12:teller>(\d+)<\/ns12:teller>/)),
      nevner: Number(extractFirst(xml, /<ns12:nevner>(\d+)<\/ns12:nevner>/)),
      historisk:
        extractFirst(xml, /<ns12:historisk>(\w+)<\/ns12:historisk>/) === "true",
      rettighetshaverId:
        extractFirst(
          xml,
          /<ns12:rettighetshaverId>\s*<value>(\d+)<\/value>/
        ) ?? undefined,
      registerenhetsrettId:
        extractFirst(
          xml,
          /<ns12:registerenhetsrettId>\s*<value>(\d+)<\/value>/
        ) ?? "",
    };
  }

  async getBorettslagsandel(id: string): Promise<Borettslagsandel> {
    const xml = await this.fetchRaw(id, "BorettslagsandelId");
    return {
      id,
      borettslagId:
        extractFirst(xml, /<ns12:borettslagId>\s*<value>(\d+)<\/value>/) ??
        "",
      andelsnummer: Number(
        extractFirst(xml, /<ns12:andelsnummer>(\d+)<\/ns12:andelsnummer>/)
      ),
      adresseId:
        extractFirst(xml, /<ns12:adresseId>\s*<value>(\d+)<\/value>/) ??
        undefined,
      utgaatt:
        extractFirst(xml, /<ns12:utgaatt>(\w+)<\/ns12:utgaatt>/) === "true",
    };
  }

  async getSeksjon(id: string): Promise<Seksjon> {
    const xml = await this.fetchRaw(id, "SeksjonId");
    return {
      id,
      kommuneId:
        extractFirst(xml, /<ns12:kommuneId>\s*<value>(\d+)<\/value>/) ?? "",
      gaardsnummer: Number(
        extractFirst(xml, /<ns12:gaardsnummer>(\d+)<\/ns12:gaardsnummer>/)
      ),
      bruksnummer: Number(
        extractFirst(xml, /<ns12:bruksnummer>(\d+)<\/ns12:bruksnummer>/)
      ),
      festenummer: Number(
        extractFirst(xml, /<ns12:festenummer>(\d+)<\/ns12:festenummer>/)
      ),
      seksjonsnummer: Number(
        extractFirst(xml, /<ns12:seksjonsnummer>(\d+)<\/ns12:seksjonsnummer>/)
      ),
      utgaatt:
        extractFirst(xml, /<ns12:utgaatt>(\w+)<\/ns12:utgaatt>/) === "true",
    };
  }

  async getPerson(id: string): Promise<Person> {
    const xml = await this.fetchRaw(id, "PersonId");
    const idTypeAttr = extractFirst(xml, /<id xsi:type="([^"]+)"/);
    const juridisk = idTypeAttr?.includes("Juridisk") ?? false;
    return {
      id,
      navn: extractFirst(xml, /<ns10:navn>([^<]+)<\/ns10:navn>/) ?? "",
      identifikasjonsnummer:
        extractFirst(
          xml,
          /<ns10:identifikasjonsnummer>([^<]+)<\/ns10:identifikasjonsnummer>/
        ) ?? "",
      identifikasjonsnummertype:
        extractFirst(
          xml,
          /<ns10:identifikasjonsnummertypeKodeId>\s*<value>(\d+)<\/value>/
        ) ?? "",
      type: juridisk ? "juridisk" : "privat",
      historisk:
        extractFirst(xml, /<ns10:historisk>(\w+)<\/ns10:historisk>/) === "true",
    };
  }

  async getAdresse(id: string): Promise<Adresse> {
    const xml = await this.fetchRaw(id, "AdresseId");
    const adressenavn =
      extractFirst(xml, /<ns8:adressenavn>([^<]+)<\/ns8:adressenavn>/) ??
      undefined;
    const husnummer = extractFirst(
      xml,
      /<ns8:husnummer>(\d+)<\/ns8:husnummer>/
    );
    const bokstavMatch = xml.match(/<ns8:bokstav(?:\s[^>]*)?>([^<]+)<\/ns8:bokstav>/);
    const bokstav =
      bokstavMatch && !bokstavMatch[0].includes('xsi:nil="true"')
        ? bokstavMatch[1]
        : undefined;
    const bolignummer =
      extractFirst(xml, /<ns8:bolignummer>([^<]+)<\/ns8:bolignummer>/) ??
      undefined;
    const adressekode = extractFirst(
      xml,
      /<ns8:adressekode>(\d+)<\/ns8:adressekode>/
    );
    const kommuneId =
      extractFirst(xml, /<ns8:kommuneId>\s*<value>(\d+)<\/value>/) ??
      undefined;
    const bruksenhetId =
      extractFirst(
        xml,
        /<ns8:bruksenhetIdFraMatrikkelen>(\d+)<\/ns8:bruksenhetIdFraMatrikkelen>/
      ) ?? undefined;
    const adresseIdMatrikkel =
      extractFirst(
        xml,
        /<ns8:adresseIdFraMatrikkelen>(\d+)<\/ns8:adresseIdFraMatrikkelen>/
      ) ?? undefined;

    const tekstParts: string[] = [];
    if (adressenavn) tekstParts.push(adressenavn);
    if (husnummer) {
      const husStr = String(Number(husnummer));
      tekstParts.push(bokstav ? `${husStr}${bokstav}` : husStr);
    }

    return {
      id,
      adressetekst: tekstParts.join(" ").trim(),
      adressenavn,
      husnummer: husnummer ? Number(husnummer) : undefined,
      bokstav,
      bolignummer,
      adressekode: adressekode ? Number(adressekode) : undefined,
      kommuneId,
      bruksenhetIdFraMatrikkelen: bruksenhetId,
      adresseIdFraMatrikkelen: adresseIdMatrikkel,
    };
  }
}

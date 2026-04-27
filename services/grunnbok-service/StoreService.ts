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

/** Maks IDer per batch-kall. Verifisert mot Grunnbok prod opp til 408. */
const MAX_BATCH_SIZE = 200;

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

  /** Henter rå XML for en batch av IDer via getObjects. Caller bruker
   *  splitItemChunks() til å parse hvert objekt. */
  private async fetchRawBatch(
    ids: readonly string[],
    idType: StoreIdType
  ): Promise<string> {
    const prefix = ID_NAMESPACE_PREFIX[idType];
    const ctxXml = buildContextXml(this.ctx);
    const items = ids
      .map(
        (id) =>
          `<bt:item xsi:type="${prefix}:${idType}"><bt:value>${id}</bt:value></bt:item>`
      )
      .join("");
    const body = `
      <store:getObjects>
        <store:ids>${items}</store:ids>
        <store:grunnbokContext>${ctxXml}</store:grunnbokContext>
      </store:getObjects>
    `;
    const envelope = this.wrapEnvelope(NS, body);
    return this.postSoap("StoreServiceWS", envelope);
  }

  /** Henter en stor liste av samme objekttype i batch-er á MAX_BATCH_SIZE.
   *  Returnerer rå XML-fragmenter (én per item) i samme rekkefølge som input. */
  private async fetchAllItemChunks(
    ids: readonly string[],
    idType: StoreIdType
  ): Promise<string[]> {
    const chunks: string[] = [];
    for (let i = 0; i < ids.length; i += MAX_BATCH_SIZE) {
      const slice = ids.slice(i, i + MAX_BATCH_SIZE);
      const xml = await this.fetchRawBatch(slice, idType);
      chunks.push(...splitItemChunks(xml));
    }
    return chunks;
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

  async getBorettslagsandelerBatch(
    ids: readonly string[]
  ): Promise<Borettslagsandel[]> {
    if (ids.length === 0) return [];
    const chunks = await this.fetchAllItemChunks(ids, "BorettslagsandelId");
    return chunks.map((chunk) => parseBorettslagsandelChunk(chunk));
  }

  async getAdresserBatch(ids: readonly string[]): Promise<Adresse[]> {
    if (ids.length === 0) return [];
    const chunks = await this.fetchAllItemChunks(ids, "AdresseId");
    return chunks.map((chunk) => parseAdresseChunk(chunk));
  }
}

/** Splitter <return>...<item>...</item><item>...</item>...</return> til én streng per item. */
function splitItemChunks(xml: string): string[] {
  const matches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g);
  const out: string[] = [];
  for (const m of matches) out.push(m[1]);
  return out;
}

function parseBorettslagsandelChunk(chunk: string): Borettslagsandel {
  const id =
    extractFirst(chunk, /<id\b[^>]*>\s*<value>(\d+)<\/value>/) ?? "";
  return {
    id,
    borettslagId:
      extractFirst(chunk, /<ns\d+:borettslagId>\s*<value>(\d+)<\/value>/) ?? "",
    andelsnummer: Number(
      extractFirst(chunk, /<ns\d+:andelsnummer>(\d+)<\/ns\d+:andelsnummer>/)
    ),
    adresseId:
      extractFirst(chunk, /<ns\d+:adresseId>\s*<value>(\d+)<\/value>/) ??
      undefined,
    utgaatt:
      extractFirst(chunk, /<ns\d+:utgaatt>(\w+)<\/ns\d+:utgaatt>/) === "true",
  };
}

function parseAdresseChunk(chunk: string): Adresse {
  const id =
    extractFirst(chunk, /<id\b[^>]*>\s*<value>(\d+)<\/value>/) ?? "";
  const adressenavn =
    extractFirst(chunk, /<ns\d+:adressenavn>([^<]+)<\/ns\d+:adressenavn>/) ??
    undefined;
  const husnummer = extractFirst(
    chunk,
    /<ns\d+:husnummer>(\d+)<\/ns\d+:husnummer>/
  );
  const bokstavMatch = chunk.match(
    /<ns\d+:bokstav(?:\s[^>]*)?>([^<]+)<\/ns\d+:bokstav>/
  );
  const bokstav =
    bokstavMatch && !bokstavMatch[0].includes('xsi:nil="true"')
      ? bokstavMatch[1]
      : undefined;
  const bolignummer =
    extractFirst(chunk, /<ns\d+:bolignummer>([^<]+)<\/ns\d+:bolignummer>/) ??
    undefined;
  const adressekode = extractFirst(
    chunk,
    /<ns\d+:adressekode>(\d+)<\/ns\d+:adressekode>/
  );
  const kommuneId =
    extractFirst(chunk, /<ns\d+:kommuneId>\s*<value>(\d+)<\/value>/) ??
    undefined;
  const bruksenhetId =
    extractFirst(
      chunk,
      /<ns\d+:bruksenhetIdFraMatrikkelen>(\d+)<\/ns\d+:bruksenhetIdFraMatrikkelen>/
    ) ?? undefined;
  const adresseIdMatrikkel =
    extractFirst(
      chunk,
      /<ns\d+:adresseIdFraMatrikkelen>(\d+)<\/ns\d+:adresseIdFraMatrikkelen>/
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

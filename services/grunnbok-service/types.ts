export interface GrunnbokContext {
  systemVersion: string;
  clientIdentification: string;
  locale: string;
  snapshotTimestamp: string;
}

export interface MatrikkelIdent {
  kommunenummer: string;
  gaardsnummer: number;
  bruksnummer: number;
  festenummer?: number;
  seksjonsnummer?: number;
}

export interface Borettslagsandel {
  id: string;
  borettslagId: string;
  andelsnummer: number;
  adresseId?: string;
  utgaatt: boolean;
}

export interface Seksjon {
  id: string;
  kommuneId: string;
  gaardsnummer: number;
  bruksnummer: number;
  festenummer: number;
  seksjonsnummer: number;
  utgaatt: boolean;
}

export interface Registerenhetsrettsandel {
  id: string;
  teller: number;
  nevner: number;
  historisk: boolean;
  rettighetshaverId?: string;
  registerenhetsrettId: string;
}

export interface Person {
  id: string;
  navn: string;
  identifikasjonsnummer: string;
  identifikasjonsnummertype: string;
  type: "juridisk" | "privat" | "ukjent";
  historisk: boolean;
}

export interface Adresse {
  id: string;
  adressetekst: string;
  adressenavn?: string;
  husnummer?: number;
  bokstav?: string;
  bolignummer?: string;
  adressekode?: number;
  kommuneId?: string;
  bruksenhetIdFraMatrikkelen?: string;
  adresseIdFraMatrikkelen?: string;
}

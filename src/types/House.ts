// src/types/House.ts
// ---------------------------------------------------------------------------
//  Felles type-definisjoner som frontend (og hooks) konsumerer
// ---------------------------------------------------------------------------

/* ------------------- Sparetiltak ---------------------------------------- */
export interface Tiltak {
  navn: string; // f.eks. «Loftisolering»
  kwh_sparing: number; // årlig spart energi
  kost_kr: number; // investerings-kostnad
  enova_støtte_kr?: number; // evt. støtte
}

/* ------------------- Solkart -------------------------------------------- */
export interface Takflate {
  tak_id: number;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
}

/* ------------------- Etasjedata (StoreService) -------------------------- */
export interface Etasje {
  etasjenummer: number;
  bruksarealTotalt: number | null;
}

/* ------------------- Selve huset --------------------------------------- */
export interface House {
  /* ----- Matrikkel / adresse ----- */
  adresse: string;
  kommunenummer?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  seksjonsnummer?: string | null;
  bruksenhetnummer?: string | null; // lang form (AA-0001)
  bruksenhetnr?: string | null; // kort form (H0101)
  matrikkelenhetsId?: number | null;

  /* ----- Bygnings-info (StoreService) ----- */
  byggår?: number | null;
  /** Sum BRA for alle bygg på eiendommen */
  bra_m2?: number | null;
  /** Alternativt kommer noen ganger som bruksareal */
  bruksareal?: number | null;

  bruksenheter?: number | null;
  antEtasjer?: number | null;

  /** Komplett etasjeliste fra StoreService */
  etasjer?: Etasje[];
  /** Oppslagstabell { 1: 74, 2: 58 } – fallback dersom etasjer-array mangler */
  bruksarealEtasjer?: Record<number | string, number | null>;

  /* ----- Energimerke (Enova) ----- */
  energikarakter?: string | null; // "A"–"G"
  oppvarmingskarakter?: string | null; // "GRØNN" | "GUL" | "RØD"
  energiattest_kwh?: number | null;

  /* ----- Solkart ----- */
  takAreal_m2?: number | null;
  sol_kwh_m2_yr?: number | null;
  sol_kwh_bygg_tot?: number | null;
  solKategori?: string | null;
  takflater?: Takflate[];

  /* ----- Kulturminne ----- */
  isProtected?: boolean | null;

  /* ----- Koordinater (fra geokoding) ----- */
  lat?: number;
  lon?: number;

  /* ----- Debug / diagnostikk fra back-end ----- */
  _diag?: Record<string, any>;

  /* ----- Brukerinput / kalkulator ----- */
  forbruk_kwh: number;
  oppvarming: string;

  /* ----- Foreslåtte tiltak ----- */
  tiltak: Tiltak[];
}

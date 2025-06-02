// src/types/House.ts
// ---------------------------------------------------------------------------
//  Felles type-definisjoner (frontend)
// ---------------------------------------------------------------------------

export interface Tiltak {
  navn: string; // f.eks. «Loftisolering»
  kwh_sparing: number; // årlig spart energi
  kost_kr: number; // investeringskostnad
  enova_støtte_kr?: number;
}

/* ------------------- Solkart ------------------------------------------- */
export interface Takflate {
  tak_id: number;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
}

/* ------------------- Selve huset --------------------------------------- */
export interface House {
  /* ----- Matrikkel / adresse ----- */
  adresse: string;
  kommunenummer?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  seksjonsnummer?: string | null;
  bruksenhetnummer?: string | null; //  (lang form – kan brukes i POST-skjema)
  bruksenhetnr?: string | null; //  (kort form fra back-end)
  matrikkelenhetsId?: number | null;

  /* ----- Bygnings-info (StoreService) ----- */
  byggår?: number | null;
  /** Sum BRA for alle bygg på eiendommen */
  bra_m2?: number | null;
  bruksenheter?: number | null;

  antEtasjer?: number | null;
  /** Oppslagstabell pr. etasje { 1: 74, 2: 58 }  */
  bruksarealEtasjer?: Record<number, number | null>;

  /** Back-end diagnostikk – kun til visning/debug */
  _diag?: Record<string, any>;

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

  /* ----- Øvrig ----- */
  lat?: number;
  lon?: number;
  isProtected?: boolean | null;

  /* ----- Brukerinput ----- */
  forbruk_kwh: number;
  oppvarming: string;

  /* ----- Foreslåtte tiltak ----- */
  tiltak: Tiltak[];
}

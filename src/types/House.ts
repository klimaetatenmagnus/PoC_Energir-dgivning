// src/types/House.ts
// ---------------------------------------------------------------------------
// Type‑definisjoner som deles mellom komponenter.
// ---------------------------------------------------------------------------

export interface Tiltak {
  navn: string; // f.eks. «Loftisolering»
  kwh_sparing: number; // årlig spart energi
  kost_kr: number; // investeringskostnad
  enova_støtte_kr?: number; // settes i steg 3
}

export interface House {
  // Matrikkel / adresse
  adresse: string;
  gardsnummer?: number;
  bruksnummer?: number;
  kommunenummer?: string;

  // Bygningsinfo
  byggår?: number | null;
  bra_m2?: number | null;

  // Energimerke (fra Enova Energiattest)
  energikarakter?: string | null; // "A"–"G"
  oppvarmingskarakter?: string | null; // "GRØNN", "GUL", "RØD"
  energiattest_kwh?: number | null; // beregnet levert energi

  // Forbruk angitt av bruker eller estimert
  forbruk_kwh: number;
  oppvarming: string;

  // Forslag til tiltak
  tiltak: Tiltak[];
}

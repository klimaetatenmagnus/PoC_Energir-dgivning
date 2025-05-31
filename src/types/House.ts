// src/types/House.ts
// ---------------------------------------------------------------------------
// Type-definisjoner som deles mellom komponenter.
// ---------------------------------------------------------------------------

export interface Tiltak {
  navn: string; // f.eks. «Loftisolering»
  kwh_sparing: number; // årlig spart energi
  kost_kr: number; // investeringskostnad
  enova_støtte_kr?: number; // settes i steg 3
}

// -------------------- Solkart ---------------------------------------------
export interface Takflate {
  // ← NY
  tak_id: number;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
}

// -------------------- Hovedobjekt -----------------------------------------
export interface House {
  // Matrikkel / adresse
  adresse: string;
  kommunenummer?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  seksjonsnummer?: string; // ← NEW
  bruksenhetnummer?: string; // ← NEW

  // Bygningsinfo
  byggår?: number | null;
  bra_m2?: number | null;
  bruksenheter?: number | null; // ← NEW (fra StoreService)

  // Energimerke (Enova)
  energikarakter?: string | null; // "A"–"G"
  oppvarmingskarakter?: string | null; // "GRØNN", "GUL", "RØD"
  energiattest_kwh?: number | null; // levert energi

  // Solkart
  takAreal_m2?: number | null; // ← NEW
  sol_kwh_m2_yr?: number | null; // ← NEW
  sol_kwh_bygg_tot?: number | null; // ← NEW
  solKategori?: string | null; // ← NEW
  takflater?: Takflate[]; // ← NEW

  // Øvrig
  lat?: number;
  lon?: number;
  isProtected?: boolean | null; // ← kulturminne

  // Bruker-input / estimat
  forbruk_kwh: number;
  oppvarming: string;

  // Forslag til tiltak
  tiltak: Tiltak[];
}

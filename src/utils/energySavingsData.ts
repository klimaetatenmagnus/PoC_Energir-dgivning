/**
 * Energibesparelsesdata basert på Multiconsult/ENOVA-tall
 *
 * Denne filen inneholder prosentsatser som representerer "andel av forbruk etter tiltak".
 * F.eks. 0.74 (74%) betyr at 74% av energiforbruket gjenstår etter tiltaket,
 * altså en besparelse på 26%.
 *
 * For å beregne besparelse:
 * besparelse = opprinneligEnergibruk * (1 - rate)
 *
 * Kilde: Dokumentasjon/Utvikling/Datagrunnlag_energibesparelse.csv
 */

// Type for tiltak som støttes
export type TiltakType =
  | 'etterisolering_yttervegg'
  | 'etterisolering_kjeller_loft'
  | 'vinduer_gul_liste'
  | 'vinduer_standard'
  | 'temperaturstyring';

// TEK-perioder fra CSV (internal format)
export type TEKPeriod = 'Eldre' | 'TEK49' | 'TEK69' | 'TEK87' | 'TEK97' | 'TEK07';

// Input TEK formats from shared.ts TekPeriod and tekEnergyCalculations.ts calculateTEK
export type TekPeriodInput =
  | 'eldre'
  | '49'
  | '69'
  | '87'
  | '97'
  | '7'
  | 'TEK7'
  | 'TEK49'
  | 'TEK69'
  | 'TEK87'
  | 'TEK97';

// Boligtyper
export type Boligtype = 'småhus' | 'blokk';

// Type for datastruktur: [tiltak][TEK][boligtype] = prosentsats
export type EnergySavingsRate = Record<
  TiltakType,
  Record<TEKPeriod, Record<Boligtype, number | null>>
>;

/**
 * Energibesparelsesrater strukturert som [tiltak][TEK][boligtype]
 *
 * Verdiene representerer "andel av forbruk etter tiltak":
 * - 0.74 betyr 74% av forbruket gjenstår (26% besparelse)
 * - 1.0 betyr ingen besparelse
 * - null betyr manglende data
 *
 * Parsed fra CSV-filen Datagrunnlag_energibesparelse.csv
 */
export const ENERGY_SAVINGS_RATES: EnergySavingsRate = {
  etterisolering_yttervegg: {
    Eldre: { småhus: 0.74, blokk: 0.72 },
    TEK49: { småhus: 0.89, blokk: 0.80 },
    TEK69: { småhus: 0.88, blokk: 0.82 },
    TEK87: { småhus: 0.93, blokk: 0.94 },
    TEK97: { småhus: 0.98, blokk: 0.95 },
    TEK07: { småhus: 1.0, blokk: 0.99 },
  },
  etterisolering_kjeller_loft: {
    Eldre: { småhus: 0.89, blokk: 0.92 },
    TEK49: { småhus: 0.96, blokk: 0.98 },
    TEK69: { småhus: 0.95, blokk: 0.96 },
    TEK87: { småhus: 0.98, blokk: 0.98 },
    TEK97: { småhus: 1.0, blokk: 1.0 },
    TEK07: { småhus: 1.0, blokk: 1.0 },
  },
  vinduer_gul_liste: {
    Eldre: { småhus: 0.90, blokk: 0.88 },
    TEK49: { småhus: 0.90, blokk: 0.88 },
    TEK69: { småhus: 0.85, blokk: 0.85 },
    TEK87: { småhus: 0.86, blokk: 0.86 },
    TEK97: { småhus: 0.93, blokk: 0.94 },
    TEK07: { småhus: 1.0, blokk: 1.0 },
  },
  vinduer_standard: {
    Eldre: { småhus: 0.88, blokk: 0.87 },
    TEK49: { småhus: 0.89, blokk: 0.87 },
    TEK69: { småhus: 0.83, blokk: 0.83 },
    TEK87: { småhus: 0.84, blokk: 0.84 },
    TEK97: { småhus: 0.91, blokk: 0.92 },
    TEK07: { småhus: 0.94, blokk: 0.94 },
  },
  temperaturstyring: {
    Eldre: { småhus: 0.95, blokk: 0.95 },
    TEK49: { småhus: 0.96, blokk: 0.96 },
    TEK69: { småhus: 0.95, blokk: 0.95 },
    TEK87: { småhus: 0.95, blokk: 0.95 },
    TEK97: { småhus: 0.95, blokk: 0.95 },
    TEK07: { småhus: 0.95, blokk: 0.95 },
  },
};

/**
 * Konverterer TEK-periode fra shared.ts format til CSV-format
 *
 * @param tekPeriod - TEK-periode i format fra shared.ts TekPeriod eller tekEnergyCalculations.ts calculateTEK
 * @returns TEK-periode i CSV-format ('Eldre', 'TEK49', etc.), or null for unrecognized values
 */
function normalizeTekPeriod(tekPeriod: TekPeriodInput): TEKPeriod | null {
  const normalized = tekPeriod.toLowerCase().trim();

  switch (normalized) {
    case 'eldre':
      return 'Eldre';
    case '49':
    case 'tek49':
      return 'TEK49';
    case '69':
    case 'tek69':
      return 'TEK69';
    case '87':
    case 'tek87':
      return 'TEK87';
    case '97':
    case 'tek97':
      return 'TEK97';
    case '7':
    case 'tek7':
      return 'TEK07';
    default:
      console.warn(
        `Ukjent TEK-periode "${tekPeriod}" - returnerer null. Forventede verdier: ${['eldre', '49', '69', '87', '97', '7', 'TEK7', 'TEK49', 'TEK69', 'TEK87', 'TEK97'].join(', ')}`
      );
      return null;
  }
}

/**
 * Henter energibesparelsesrate for gitt tiltak, TEK-periode og boligtype
 *
 * @param tiltak - Type tiltak (f.eks. 'etterisolering_yttervegg', 'vinduer_standard', 'vinduer_gul_liste')
 * @param tekPeriod - TEK-periode i format fra shared.ts TekPeriod eller tekEnergyCalculations.ts calculateTEK
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @param erPaaGulListe - For vinduer: om bygningen er på gul liste (valgfri, default false)
 * @returns Prosentsats som representerer andel av forbruk etter tiltak, eller null hvis data mangler
 *
 * @example
 * // For TEK49 blokk etterisolering yttervegg:
 * const rate = getEnergySavingsRate('etterisolering_yttervegg', '49', 'blokk');
 * // rate = 0.80 betyr 80% gjenstår, 20% besparelse
 * // besparelse = opprinneligEnergibruk * (1 - 0.80) = opprinneligEnergibruk * 0.20
 *
 * @example
 * // For vinduer med gul liste:
 * const rate = getEnergySavingsRate('vinduer_standard', '49', 'blokk', true);
 * // Returnerer rate for 'vinduer_gul_liste' siden erPaaGulListe=true
 *
 * @example
 * // For vinduer_gul_liste direkte:
 * const rate = getEnergySavingsRate('vinduer_gul_liste', 'TEK69', 'småhus');
 */
export function getEnergySavingsRate(
  tiltak: TiltakType,
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  erPaaGulListe?: boolean
): number | null {
  // Bestem tiltakstype for vinduer basert på gul liste-status
  let actualTiltak: TiltakType;
  if (tiltak === 'vinduer_standard' || tiltak === 'vinduer_gul_liste') {
    actualTiltak = erPaaGulListe ? 'vinduer_gul_liste' : 'vinduer_standard';
  } else {
    actualTiltak = tiltak;
  }

  // Normaliser TEK-periode
  const normalizedTek = normalizeTekPeriod(tekPeriod);
  if (normalizedTek === null) {
    return null;
  }

  // Slå opp i datastrukturen
  const tiltakData = ENERGY_SAVINGS_RATES[actualTiltak];
  if (!tiltakData) {
    console.warn(`Mangler data for tiltak "${actualTiltak}"`);
    return null;
  }

  const tekData = tiltakData[normalizedTek];
  if (!tekData) {
    console.warn(
      `Mangler data for tiltak "${actualTiltak}" og TEK "${normalizedTek}"`
    );
    return null;
  }

  const rate = tekData[boligtype];
  if (rate === null || rate === undefined) {
    console.warn(
      `Mangler data for tiltak "${actualTiltak}", TEK "${normalizedTek}", boligtype "${boligtype}"`
    );
    return null;
  }

  return rate;
}

/**
 * Bekvemmelighetsmetode for å hente vindusenergibesparelsesrate
 *
 * Denne funksjonen er ment for vinduskomponenten og abstraherer bort valget
 * mellom vinduer_standard og vinduer_gul_liste basert på erPaaGulListe-parameteren.
 *
 * @param tekPeriod - TEK-periode i format fra shared.ts TekPeriod eller tekEnergyCalculations.ts calculateTEK
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @param erPaaGulListe - Om bygningen er på gul liste (default false)
 * @returns Prosentsats som representerer andel av forbruk etter tiltak, eller null hvis data mangler
 *
 * @example
 * // For standard vinduer:
 * const rate = getWindowEnergySavingsRate('49', 'blokk');
 *
 * @example
 * // For gul liste vinduer:
 * const rate = getWindowEnergySavingsRate('TEK69', 'småhus', true);
 */
export function getWindowEnergySavingsRate(
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  erPaaGulListe: boolean = false
): number | null {
  return getEnergySavingsRate('vinduer_standard', tekPeriod, boligtype, erPaaGulListe);
}

/**
 * Beregner energibesparelse basert på opprinnelig forbruk og rate
 *
 * @param opprinneligForbruk - Opprinnelig energiforbruk i kWh
 * @param rate - Andel av forbruk etter tiltak (fra getEnergySavingsRate)
 * @returns Beregnet besparelse i kWh
 *
 * @example
 * const opprinnelig = 15000; // kWh
 * const rate = 0.80; // 80% gjenstår
 * const besparelse = calculateSavingsFromRate(opprinnelig, rate);
 * // besparelse = 15000 * (1 - 0.80) = 3000 kWh
 */
export function calculateSavingsFromRate(
  opprinneligForbruk: number,
  rate: number
): number {
  return opprinneligForbruk * (1 - rate);
}

/**
 * Tiltak-info for kombinert beregning
 */
export interface TiltakSavingsInfo {
  /** Tiltakets tittel/navn (brukes for å identifisere tiltakstype) */
  title: string;
  /** Besparelses-rate for dette tiltaket (fra getEnergySavingsRate) */
  rate: number | null;
  /** For solenergi: produsert energi i kWh (ikke en rate-basert besparelse) */
  solarProductionKwh?: number;
}

/**
 * Beregner kombinert energibesparelse fra flere tiltak med multiplikativ metode.
 *
 * Når flere tiltak velges samtidig, multipliseres faktorene med hverandre
 * for å gi et realistisk bilde av den totale besparelsen.
 *
 * Eksempel:
 * - Tiltak A: rate 0.90 (10% besparelse)
 * - Tiltak B: rate 0.95 (5% besparelse)
 * - Kombinert: 0.90 × 0.95 = 0.855 → 14.5% total besparelse
 * - (Additiv metode ville gitt 15%, som er urealistisk høyt)
 *
 * UNNTAK: Solenergi beregnes separat og legges til på slutten,
 * siden det er energiproduksjon, ikke energibesparelse.
 *
 * @param opprinneligForbruk - Opprinnelig årlig energiforbruk i kWh
 * @param tiltak - Liste med tiltak og deres rates/solproduksjon
 * @returns Total besparelse i kWh (inkludert solenergi-produksjon)
 *
 * @example
 * const tiltak = [
 *   { title: 'Etterisolering av yttervegg', rate: 0.80 },
 *   { title: 'Temperaturstyring', rate: 0.95 },
 *   { title: 'Solenergi', rate: null, solarProductionKwh: 5000 }
 * ];
 * const besparelse = calculateCombinedSavings(20000, tiltak);
 * // Kombinert rate = 0.80 × 0.95 = 0.76
 * // Besparelse fra tiltak = 20000 × (1 - 0.76) = 4800 kWh
 * // Total = 4800 + 5000 = 9800 kWh
 */
export function calculateCombinedSavings(
  opprinneligForbruk: number,
  tiltak: TiltakSavingsInfo[]
): number {
  if (!Number.isFinite(opprinneligForbruk) || opprinneligForbruk <= 0) {
    return 0;
  }

  // Separer solenergi fra andre tiltak
  let solarProduction = 0;
  const rateBasedTiltak: number[] = [];

  for (const t of tiltak) {
    // Solenergi identifiseres ved tittel og har solarProductionKwh
    if (t.title === 'Solenergi' && t.solarProductionKwh !== undefined) {
      solarProduction += t.solarProductionKwh;
    } else if (t.rate !== null && t.rate > 0 && t.rate <= 1) {
      rateBasedTiltak.push(t.rate);
    }
  }

  // Multipliser alle rater sammen for å få kombinert faktor
  // Hvis ingen tiltak, kombinertRate = 1 (ingen besparelse)
  const kombinertRate = rateBasedTiltak.reduce((acc, rate) => acc * rate, 1);

  // Beregn besparelse fra rate-baserte tiltak
  const besparelseFraTiltak = opprinneligForbruk * (1 - kombinertRate);

  // Legg til solenergi-produksjon
  return besparelseFraTiltak + solarProduction;
}

/**
 * Mapper tiltak-tittel til TiltakType for oppslag i ENERGY_SAVINGS_RATES
 */
export function getTiltakTypeFromTitle(title: string): TiltakType | null {
  if (title === 'Oppgradering av vindu' || title === 'Oppgradering av vinduer' || title === 'Utskifting av vindu') {
    return 'vinduer_standard'; // Gul liste håndteres via erPaaGulListe parameter
  }
  if (title === 'Etterisolering av yttervegg') {
    return 'etterisolering_yttervegg';
  }
  if (title === 'Isolering av kjeller og loft' || title === 'Etterisolering av kjeller og loft') {
    return 'etterisolering_kjeller_loft';
  }
  if (title === 'Temperaturstyring') {
    return 'temperaturstyring';
  }
  return null;
}

/**
 * Henter rate for et tiltak basert på tittel, TEK-periode og boligtype.
 * Bekvemmelighetsmetode som kombinerer getTiltakTypeFromTitle og getEnergySavingsRate.
 *
 * @param title - Tiltakets tittel/navn
 * @param tekPeriod - TEK-periode
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @param erPaaGulListe - Om bygningen er på gul liste (for vinduer)
 * @returns Rate eller null hvis tiltaket ikke støttes/data mangler
 */
export function getRateForTiltak(
  title: string,
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  erPaaGulListe: boolean = false
): number | null {
  // Solenergi har ikke rate - det er produksjon
  if (title === 'Solenergi') {
    return null;
  }

  // Vinduer - bruker egen funksjon som håndterer gul liste
  if (title === 'Oppgradering av vindu' || title === 'Oppgradering av vinduer' || title === 'Utskifting av vindu') {
    return getWindowEnergySavingsRate(tekPeriod, boligtype, erPaaGulListe);
  }

  const tiltakType = getTiltakTypeFromTitle(title);
  if (!tiltakType) {
    return null;
  }

  return getEnergySavingsRate(tiltakType, tekPeriod, boligtype);
}

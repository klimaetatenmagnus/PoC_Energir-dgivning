/**
 * Energibesparelsesdata basert på Multiconsult/ENOVA-tall
 *
 * Denne filen inneholder prosentsatser som representerer "andel av forbruk etter tiltak"
 * for tre energityper: romoppvarming, tappevann, og elspesifikt.
 * F.eks. 0.85 (85%) betyr at 85% av energiforbruket gjenstår etter tiltaket,
 * altså en besparelse på 15%.
 *
 * For å beregne besparelse:
 * besparelse = opprinneligEnergibruk * (1 - rate)
 *
 * Kilde: Dokumentasjon/Utvikling/Input til modellen-Tabell 1.csv
 * Data parses dynamisk fra CSV-filen ved build-time.
 */

import type { EnergyTypeRates, TEKPeriod } from '../types/energy';

// Import CSV file as raw text - Vite handles this with ?raw suffix
import csvRawData from '../../Dokumentasjon/Utvikling/Input til modellen-Tabell 1.csv?raw';

// Type for tiltak som støttes
export type TiltakType =
  | 'etterisolering_yttervegg'
  | 'etterisolering_kjeller_loft'
  | 'vinduer_gul_liste'
  | 'vinduer_standard'
  | 'temperaturstyring'
  | 'ventilasjonsgjenvinning'
  | 'luft_luft_varmepumpe'
  | 'luft_vaeske_varmepumpe'
  | 'vaeske_vaeske_varmepumpe';

// Re-export TEKPeriod from types/energy.ts
export type { TEKPeriod } from '../types/energy';

// Input TEK formats from shared.ts TekPeriod and tekEnergyCalculations.ts calculateTEK
export type TekPeriodInput =
  | 'eldre'
  | '49'
  | '69'
  | '87'
  | '97'
  | '7'
  | '17'
  | '10'
  | 'TEK7'
  | 'TEK49'
  | 'TEK69'
  | 'TEK87'
  | 'TEK97'
  | 'TEK07'
  | 'TEK17'
  | 'TEK10';

// Boligtyper
export type Boligtype = 'småhus' | 'blokk';

// Type for datastruktur: [tiltak][TEK][boligtype] = { romoppvarming, tappevann, elspesifikt }
export type EnergySavingsRate = Record<
  TiltakType,
  Record<TEKPeriod, Record<Boligtype, EnergyTypeRates | null>>
>;

// Type for forbruksfordeling per energitype (kWh/m²/år)
export interface EnergyConsumptionDistribution {
  romoppvarming: number;  // kWh/m²/år
  tappevann: number;      // kWh/m²/år
  elspesifikt: number;    // kWh/m²/år
}

// Datastruktur: [TEK][boligtype] = forbruksfordeling
export type EnergyConsumptionDistributions = Record<
  TEKPeriod,
  Record<Boligtype, EnergyConsumptionDistribution | null>
>;

/**
 * Parser prosentstreng fra CSV til desimaltall
 * F.eks. "85 %" -> 0.85, " 	-   " -> 1.0 (ingen effekt)
 */
function parsePercentage(value: string): number {
  const trimmed = value.trim();
  // Sjekk for "-" (ingen effekt/ikke relevant)
  if (trimmed === '-' || trimmed === '' || trimmed.includes('-')) {
    return 1.0; // 100% = ingen besparelse
  }
  // Fjern "%" og whitespace, konverter til desimal
  const numStr = trimmed.replace('%', '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(numStr);
  if (isNaN(num)) {
    return 1.0;
  }
  return num / 100;
}

/**
 * Mapper tiltaksnavn fra CSV til TiltakType
 */
function mapTiltakName(csvName: string): TiltakType | null {
  const normalized = csvName.trim();
  switch (normalized) {
    case 'Etterisolering yttervegg':
      return 'etterisolering_yttervegg';
    case 'Etterisolering av kjeller og loft':
      return 'etterisolering_kjeller_loft';
    case 'Oppgradering av vinduer gul liste':
      return 'vinduer_gul_liste';
    case 'Oppgradering av vinduer standard':
      return 'vinduer_standard';
    case 'Temperaturstyring':
      return 'temperaturstyring';
    case 'Ventilasjonsgjenvinning':
      return 'ventilasjonsgjenvinning';
    case 'Luft-luft varmepumpe':
      return 'luft_luft_varmepumpe';
    case 'Luft-væske varmepumpe':
      return 'luft_vaeske_varmepumpe';
    case 'Væske-væske varmepumpe':
      return 'vaeske_vaeske_varmepumpe';
    default:
      return null;
  }
}

/**
 * Mapper bygningskategori fra CSV til Boligtype
 */
function mapBygningskategori(csvKategori: string): Boligtype | null {
  const normalized = csvKategori.trim().toLowerCase();
  switch (normalized) {
    case 'småhus':
      return 'småhus';
    case 'boligblokk':
      return 'blokk';
    default:
      return null;
  }
}

/**
 * Mapper TEK fra CSV til TEKPeriod
 */
function mapTekPeriod(csvTek: string): TEKPeriod | null {
  const normalized = csvTek.trim().toUpperCase();
  switch (normalized) {
    case 'TEK49':
      return 'TEK49';
    case 'TEK69':
      return 'TEK69';
    case 'TEK87':
      return 'TEK87';
    case 'TEK97':
      return 'TEK97';
    case 'TEK07':
      return 'TEK07';
    case 'TEK10':
      return 'TEK10';
    case 'TEK17':
      return 'TEK17';
    case 'ELDRE':
      return 'Eldre';
    default:
      return null;
  }
}

/**
 * Parser tall fra CSV (med komma som desimalskilletegn)
 * F.eks. "180,4" -> 180.4
 */
function parseNumber(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '-') {
    return 0;
  }
  const numStr = trimmed.replace(',', '.').replace(/\s/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Initialiserer en tom datastruktur for forbruksfordeling
 */
function initializeEmptyDistributions(): EnergyConsumptionDistributions {
  const tekPeriods: TEKPeriod[] = ['Eldre', 'TEK49', 'TEK69', 'TEK87', 'TEK97', 'TEK07', 'TEK17', 'TEK10'];
  const boligtyper: Boligtype[] = ['småhus', 'blokk'];

  const result = {} as EnergyConsumptionDistributions;

  for (const tek of tekPeriods) {
    result[tek] = {} as Record<Boligtype, EnergyConsumptionDistribution | null>;
    for (const bolig of boligtyper) {
      result[tek][bolig] = null;
    }
  }

  return result;
}

/**
 * Parser forbruksfordeling fra CSV (kolonne 7-9: Romoppvarmingsbehov, Tappevannsbehov, Elspesifikt behov)
 *
 * CSV-format (semikolon-separert):
 * Kolonne 0: bygningskategori (Småhus, Boligblokk)
 * Kolonne 1: Teknisk forskrift (TEK69, TEK87, etc.)
 * ...
 * Kolonne 7: Romoppvarmingsbehov (kWh/m2/år)
 * Kolonne 8: Tappevannsbehov (kWh/m2/år)
 * Kolonne 9: Elspesifikt behov (kWh/m2/år)
 */
function parseEnergyDistributions(csvContent: string): EnergyConsumptionDistributions {
  const distributions = initializeEmptyDistributions();

  const lines = csvContent.split('\n').filter(line => line.trim() !== '');

  // Skip header line (first row)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(';');

    if (columns.length < 10) {
      continue; // Skip incomplete rows
    }

    const bygningskategori = columns[0];
    const tekForskrift = columns[1];

    // Columns 7, 8, 9 are indices 7, 8, 9 (0-indexed)
    const romoppvarmingStr = columns[7];
    const tappevannsStr = columns[8];
    const elspesifiktStr = columns[9];

    const boligtype = mapBygningskategori(bygningskategori);
    const tekPeriod = mapTekPeriod(tekForskrift);

    if (!boligtype || !tekPeriod) {
      continue; // Skip rows with unrecognized values
    }

    // Bare sett forbruksfordeling én gang per TEK/boligtype-kombinasjon
    // (verdiene er like for alle tiltak innen samme TEK/boligtype)
    if (distributions[tekPeriod][boligtype] === null) {
      const romoppvarming = parseNumber(romoppvarmingStr);
      const tappevann = parseNumber(tappevannsStr);
      const elspesifikt = parseNumber(elspesifiktStr);

      // Valider at vi har reelle verdier
      if (romoppvarming > 0 || tappevann > 0 || elspesifikt > 0) {
        distributions[tekPeriod][boligtype] = {
          romoppvarming,
          tappevann,
          elspesifikt,
        };
      }
    }
  }

  return distributions;
}

/**
 * Initialiserer en tom datastruktur for alle tiltak
 */
function initializeEmptyRates(): EnergySavingsRate {
  const tiltakTypes: TiltakType[] = [
    'etterisolering_yttervegg',
    'etterisolering_kjeller_loft',
    'vinduer_gul_liste',
    'vinduer_standard',
    'temperaturstyring',
    'ventilasjonsgjenvinning',
    'luft_luft_varmepumpe',
    'luft_vaeske_varmepumpe',
    'vaeske_vaeske_varmepumpe',
  ];

  const tekPeriods: TEKPeriod[] = ['Eldre', 'TEK49', 'TEK69', 'TEK87', 'TEK97', 'TEK07', 'TEK17', 'TEK10'];
  const boligtyper: Boligtype[] = ['småhus', 'blokk'];

  const result = {} as EnergySavingsRate;

  for (const tiltak of tiltakTypes) {
    result[tiltak] = {} as Record<TEKPeriod, Record<Boligtype, EnergyTypeRates | null>>;
    for (const tek of tekPeriods) {
      result[tiltak][tek] = {} as Record<Boligtype, EnergyTypeRates | null>;
      for (const bolig of boligtyper) {
        result[tiltak][tek][bolig] = null;
      }
    }
  }

  return result;
}

/**
 * Parser CSV-data og bygger opp ENERGY_SAVINGS_RATES
 *
 * CSV-format (semikolon-separert):
 * Kolonne 0: bygningskategori (Småhus, Boligblokk)
 * Kolonne 1: Teknisk forskrift (TEK69, TEK87, etc.)
 * Kolonne 2: Tiltak (Etterisolering yttervegg, etc.)
 * ...
 * Kolonne 11: Energibruk til romoppvarming etter tiltak (H i Excel)
 * Kolonne 12: Energibruk til tappevann etter tiltak (I i Excel)
 * Kolonne 13: Energibruk til elspesifikt etter tiltak (J i Excel)
 */
function parseCSVData(csvContent: string): EnergySavingsRate {
  const rates = initializeEmptyRates();

  const lines = csvContent.split('\n').filter(line => line.trim() !== '');

  // Skip header line (first row)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(';');

    if (columns.length < 14) {
      continue; // Skip incomplete rows
    }

    const bygningskategori = columns[0];
    const tekForskrift = columns[1];
    const tiltakNavn = columns[2];

    // Columns H, I, J are indices 11, 12, 13 (0-indexed)
    const romoppvarmingStr = columns[11];
    const tappevannsStr = columns[12];
    const elspesifiktStr = columns[13];

    const boligtype = mapBygningskategori(bygningskategori);
    const tekPeriod = mapTekPeriod(tekForskrift);
    const tiltakType = mapTiltakName(tiltakNavn);

    if (!boligtype || !tekPeriod || !tiltakType) {
      continue; // Skip rows with unrecognized values
    }

    const newRates: EnergyTypeRates = {
      romoppvarming: parsePercentage(romoppvarmingStr),
      tappevann: parsePercentage(tappevannsStr),
      elspesifikt: parsePercentage(elspesifiktStr),
    };

    // If there's already an entry for this combination, prefer the one with tappevann != 1.0
    // This handles duplicate rows like TEK17 småhus Temperaturstyring (lines 66 and 74)
    // where line 74 has the correct tappevann value of 70%
    const existingRates = rates[tiltakType][tekPeriod][boligtype];
    if (existingRates === null) {
      rates[tiltakType][tekPeriod][boligtype] = newRates;
    } else {
      // Prefer the entry with non-100% tappevann (more specific data)
      if (existingRates.tappevann === 1.0 && newRates.tappevann !== 1.0) {
        rates[tiltakType][tekPeriod][boligtype] = newRates;
      }
    }
  }

  return rates;
}

/**
 * Energibesparelsesrater strukturert som [tiltak][TEK][boligtype]
 *
 * Verdiene representerer "andel av forbruk etter tiltak" for tre energityper:
 * - romoppvarming: andel romoppvarmingsenergi som gjenstår
 * - tappevann: andel tappevannsenergi som gjenstår
 * - elspesifikt: andel elspesifikt forbruk som gjenstår
 *
 * F.eks. { romoppvarming: 0.85, tappevann: 1.0, elspesifikt: 1.0 } betyr:
 * - 15% besparelse på romoppvarming
 * - Ingen besparelse på tappevann
 * - Ingen besparelse på elspesifikt
 *
 * Data parsed dynamisk fra CSV-filen Input til modellen-Tabell 1.csv
 */
export const ENERGY_SAVINGS_RATES: EnergySavingsRate = parseCSVData(csvRawData);

/**
 * Forbruksfordeling per TEK-periode og boligtype (kWh/m²/år)
 *
 * Inneholder romoppvarmingsbehov, tappevannsbehov og elspesifikt behov
 * for hver kombinasjon av TEK-periode og boligtype.
 *
 * Brukes for å beregne besparelser separat per energitype.
 *
 * Data parsed dynamisk fra CSV-filen Input til modellen-Tabell 1.csv
 */
export const ENERGY_CONSUMPTION_DISTRIBUTIONS: EnergyConsumptionDistributions = parseEnergyDistributions(csvRawData);

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
    case 'tek07':
      return 'TEK07';
    case '17':
    case 'tek17':
      return 'TEK17';
    case '10':
    case 'tek10':
      return 'TEK10';
    default:
      console.warn(
        `Ukjent TEK-periode "${tekPeriod}" - returnerer null. Forventede verdier: ${['eldre', '49', '69', '87', '97', '7', '17', '10', 'TEK7', 'TEK49', 'TEK69', 'TEK87', 'TEK97', 'TEK07', 'TEK17', 'TEK10'].join(', ')}`
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
 * @returns Objekt med rates for romoppvarming, tappevann og elspesifikt, eller null hvis data mangler
 *
 * @example
 * // For TEK69 småhus luft-væske varmepumpe:
 * const rates = getEnergySavingsRate('luft_vaeske_varmepumpe', 'TEK69', 'småhus');
 * // rates = { romoppvarming: 0.52, tappevann: 0.70, elspesifikt: 1.0 }
 * // betyr 48% besparelse på romoppvarming, 30% på tappevann, ingen på elspesifikt
 *
 * @example
 * // For vinduer med gul liste:
 * const rates = getEnergySavingsRate('vinduer_standard', '49', 'blokk', true);
 * // Returnerer rates for 'vinduer_gul_liste' siden erPaaGulListe=true
 */
export function getEnergySavingsRate(
  tiltak: TiltakType,
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  erPaaGulListe?: boolean
): EnergyTypeRates | null {
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

  const rates = tekData[boligtype];
  if (rates === null || rates === undefined) {
    console.warn(
      `Mangler data for tiltak "${actualTiltak}", TEK "${normalizedTek}", boligtype "${boligtype}"`
    );
    return null;
  }

  return rates;
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
 * @returns Objekt med rates for romoppvarming, tappevann og elspesifikt, eller null hvis data mangler
 *
 * @example
 * // For standard vinduer:
 * const rates = getWindowEnergySavingsRate('49', 'blokk');
 *
 * @example
 * // For gul liste vinduer:
 * const rates = getWindowEnergySavingsRate('TEK69', 'småhus', true);
 */
export function getWindowEnergySavingsRate(
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  erPaaGulListe: boolean = false
): EnergyTypeRates | null {
  return getEnergySavingsRate('vinduer_standard', tekPeriod, boligtype, erPaaGulListe);
}

/**
 * Sjekker om et tiltak har energieffekt (minst én rate forskjellig fra 100%)
 *
 * @param rates - EnergyTypeRates objekt fra getEnergySavingsRate
 * @returns true hvis tiltaket har effekt, false ellers
 *
 * @example
 * const rates = getEnergySavingsRate('etterisolering_yttervegg', 'TEK07', 'småhus');
 * if (!hasEnergyEffect(rates)) {
 *   // Skjul dette tiltaket - det har ingen effekt for TEK07 småhus
 * }
 */
export function hasEnergyEffect(rates: EnergyTypeRates | null): boolean {
  if (!rates) return false;

  // Tiltak har effekt hvis minst én rate er forskjellig fra 100% (1.0)
  return rates.romoppvarming !== 1.0 ||
         rates.tappevann !== 1.0 ||
         rates.elspesifikt !== 1.0;
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
  /** Besparelses-rates for dette tiltaket (fra getEnergySavingsRate) */
  rates: EnergyTypeRates | null;
  /** For solenergi: produsert energi i kWh (ikke en rate-basert besparelse) */
  solarProductionKwh?: number;
}

/**
 * Beregner kombinert energibesparelse fra flere tiltak med multiplikativ metode per energitype.
 *
 * Beregningslogikk:
 * 1. Henter forbruksfordeling (romoppvarming, tappevann, elspesifikt) fra CSV basert på TEK og boligtype
 * 2. Beregner forbruk per energitype: fordeling_kWh_m2 × bruksareal
 * 3. For hver energitype: multipliserer alle relevante tiltak-rates sammen
 * 4. Beregner forbruk etter tiltak per energitype: forbruk × kombinertRate
 * 5. Summerer alle tre energityper til total forbruk etter tiltak
 * 6. Besparelse = opprinneligForbruk - totalEtter + solenergi
 *
 * Eksempel med tiltak på ulike energityper:
 * - Etterisolering: romoppvarming 0.85 (15% besparelse på romoppvarming)
 * - Varmepumpe: romoppvarming 0.52, tappevann 0.70 (påvirker både rom og tap)
 * - Ventilasjon: romoppvarming 0.89, elspesifikt 1.06 (øker elspesifikt!)
 *
 * Tiltak som påvirker ulike energityper adderes indirekte (via sum av energityper),
 * mens tiltak som påvirker samme energitype multipliseres for å unngå urealistisk høye besparelser.
 *
 * UNNTAK: Solenergi beregnes separat som produksjon og legges til på slutten.
 *
 * @param opprinneligForbruk - Opprinnelig årlig energiforbruk i kWh
 * @param tiltak - Liste med tiltak og deres rates/solproduksjon
 * @param tekPeriod - TEK-periode for å hente forbruksfordeling
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @param bruksareal - Bruksareal i m² (nødvendig for å beregne forbruk per energitype)
 * @returns Total besparelse i kWh (inkludert solenergi-produksjon)
 *
 * @example
 * const tiltak = [
 *   { title: 'Etterisolering av yttervegg', rates: { romoppvarming: 0.85, tappevann: 1.0, elspesifikt: 1.0 } },
 *   { title: 'Varmepumpe', rates: { romoppvarming: 0.52, tappevann: 0.70, elspesifikt: 1.0 } },
 *   { title: 'Solenergi', rates: null, solarProductionKwh: 5000 }
 * ];
 * // For TEK69 småhus med 150m²:
 * // romoppvarming: 180.4 kWh/m² × 150m² = 27060 kWh → × 0.85 × 0.52 = 11959 kWh etter
 * // tappevann: 29.8 kWh/m² × 150m² = 4470 kWh → × 1.0 × 0.70 = 3129 kWh etter
 * // elspesifikt: 30.1 kWh/m² × 150m² = 4515 kWh → × 1.0 × 1.0 = 4515 kWh etter
 * // totalEtter = 11959 + 3129 + 4515 = 19603 kWh
 * // besparelse = opprinnelig - totalEtter + solar = 36045 - 19603 + 5000 = 21442 kWh
 * const besparelse = calculateCombinedSavings(36045, tiltak, 'TEK69', 'småhus', 150);
 */
export function calculateCombinedSavings(
  opprinneligForbruk: number,
  tiltak: TiltakSavingsInfo[],
  tekPeriod?: TekPeriodInput,
  boligtype?: Boligtype,
  bruksareal?: number
): number {
  if (!Number.isFinite(opprinneligForbruk) || opprinneligForbruk <= 0) {
    return 0;
  }

  // Separer solenergi fra andre tiltak
  let solarProduction = 0;
  const romRates: number[] = [];
  const tapRates: number[] = [];
  const elRates: number[] = [];

  for (const t of tiltak) {
    // Solenergi identifiseres ved tittel og har solarProductionKwh
    if (t.title === 'Solenergi' && t.solarProductionKwh !== undefined) {
      solarProduction += t.solarProductionKwh;
    } else if (t.rates !== null) {
      // Tillat rates > 1.0 for tiltak som øker forbruk (f.eks. ventilasjon øker elspesifikt)
      if (t.rates.romoppvarming > 0) {
        romRates.push(t.rates.romoppvarming);
      }
      if (t.rates.tappevann > 0) {
        tapRates.push(t.rates.tappevann);
      }
      if (t.rates.elspesifikt > 0) {
        elRates.push(t.rates.elspesifikt);
      }
    }
  }

  // Multipliser alle rater sammen for å få kombinert faktor per energitype
  const kombinertRomRate = romRates.reduce((acc, rate) => acc * rate, 1);
  const kombinertTapRate = tapRates.reduce((acc, rate) => acc * rate, 1);
  const kombinertElRate = elRates.reduce((acc, rate) => acc * rate, 1);

  // Forsøk å bruke ny metode med forbruksfordeling per energitype
  if (tekPeriod && boligtype && bruksareal && bruksareal > 0) {
    const normalizedTek = normalizeTekPeriod(tekPeriod);
    if (normalizedTek) {
      const distribution = ENERGY_CONSUMPTION_DISTRIBUTIONS[normalizedTek]?.[boligtype];

      if (distribution) {
        // Beregn forbruk per energitype (i kWh, ikke kWh/m²)
        const romoppvarmingForbruk = distribution.romoppvarming * bruksareal;
        const tappevannsForbruk = distribution.tappevann * bruksareal;
        const elspesifiktForbruk = distribution.elspesifikt * bruksareal;

        // Beregn forbruk etter tiltak per energitype
        const romoppvarmingEtter = romoppvarmingForbruk * kombinertRomRate;
        const tappevannsEtter = tappevannsForbruk * kombinertTapRate;
        const elspesifiktEtter = elspesifiktForbruk * kombinertElRate;

        // Beregn total forbruk etter tiltak
        const totalEtter = romoppvarmingEtter + tappevannsEtter + elspesifiktEtter;

        // Beregn besparelse
        let besparelse = opprinneligForbruk - totalEtter;

        // Håndter edge case: hvis totalEtter > opprinneligForbruk (netto økning),
        // returner 0 besparelse + solenergi (ikke negativ besparelse)
        if (besparelse < 0) {
          besparelse = 0;
        }

        // Legg til solenergi-produksjon
        return besparelse + solarProduction;
      }
    }
  }

  // Fallback: Hvis forbruksfordeling ikke er tilgjengelig, bruk forenklet metode
  // (vektet gjennomsnitt av de tre ratene)
  const kombinertRate = (kombinertRomRate + kombinertTapRate + kombinertElRate) / 3;

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
  if (title === 'Ventilasjon' || title === 'Ventilasjonsgjenvinning') {
    return 'ventilasjonsgjenvinning';
  }
  if (title === 'Varmepumpe' || title.includes('Luft-luft')) {
    return 'luft_luft_varmepumpe';
  }
  if (title.includes('Luft-væske') || title.includes('Luft-vann')) {
    return 'luft_vaeske_varmepumpe';
  }
  if (title.includes('Væske-væske')) {
    return 'vaeske_vaeske_varmepumpe';
  }
  return null;
}

/**
 * Henter rates for et tiltak basert på tittel, TEK-periode og boligtype.
 * Bekvemmelighetsmetode som kombinerer getTiltakTypeFromTitle og getEnergySavingsRate.
 *
 * @param title - Tiltakets tittel/navn
 * @param tekPeriod - TEK-periode
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @param erPaaGulListe - Om bygningen er på gul liste (for vinduer)
 * @returns EnergyTypeRates eller null hvis tiltaket ikke støttes/data mangler
 */
export function getRateForTiltak(
  title: string,
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  erPaaGulListe: boolean = false
): EnergyTypeRates | null {
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

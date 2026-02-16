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
 * Kilde: Multiconsult/ENOVA-tall (opprinnelig fra data/raw/Input til modellen-Tabell 1.csv)
 */

import type { EnergyTypeRates, TEKPeriod } from '../types/energy';

// Energibesparelsesdata innebygd som streng (opprinnelig fra CSV-fil).
// Format: semikolon-separert med norsk desimalformat.
const csvRawData = `bygningskategori;Teknisk forskrift;Titlak;Påvirker energimerket;Besparelse per tiltak - Romoppvarming;Besparelse per tiltak - Tappevann;Besparelse per tiltak - Elspesifikt;Romoppvarmingsbehov (kWh/m2/år);Tappevannsbehov (kWh/m2/år);Elspesifikt behov (kWh/m2/år);Total energibruk før tiltak;Energibruk til romoppvarming etter tiltak;Energibruk til tappevann etter tiltak;Energibruk til elspesifikt etter tiltak
Småhus;TEK69;Etterisolering yttervegg;1;27,7;0;0;180,4;29,8;30,1;240,3;84,6 %;100 %;100 %
Småhus;TEK69;Etterisolering av kjeller og loft;1;11,4;0;0;180,4;29,8;30,1;240,3;93,7 %;100 %;100 %
Småhus;TEK69;Oppgradering av vinduer gul liste;1;33,7;0;0;180,4;29,8;30,1;240,3;81,3 %;100 %;100 %
Småhus;TEK69;Oppgradering av vinduer standard;1;41,7;0;0;180,4;29,8;30,1;240,3;76,9 %;100 %;100 %
Småhus;TEK69;Temperaturstyring;0;10,824;0;0;180,4;29,8;30,1;240,3;94 %;100 %;100 %
Småhus;TEK69;Luft-luft varmepumpe;1;59,04;0;0;180,4;29,8;30,1;240,3;67,3 %;100 %;100 %
Småhus;TEK69;Luft-væske varmepumpe;1;86,592;8,94;0;180,4;29,8;30,1;240,3;52 %;70 %;100 %
Småhus;TEK69;Væske-væske varmepumpe;1;122,414286;10,728;0;180,4;29,8;30,1;240,3;32,1 %;64 %;100 %
Boligblokk;TEK69;Etterisolering yttervegg;1;39,7;0;0;162,4;29,8;30,1;222,3;75,6 %;100 %;100 %
Boligblokk;TEK69;Etterisolering av kjeller og loft;1;8,4;0;0;162,4;29,8;30,1;222,3;94,8 %;100 %;100 %
Boligblokk;TEK69;Oppgradering av vinduer gul liste;1;31,3;0;0;162,4;29,8;30,1;222,3;80,7 %;100 %;100 %
Boligblokk;TEK69;Oppgradering av vinduer standard;1;38,3;0;0;162,4;29,8;30,1;222,3;76,4 %;100 %;100 %
Boligblokk;TEK69;Temperaturstyring;0;9,744;0;0;162,4;29,8;30,1;222,3;94 %;100 %;100 %
Boligblokk;TEK69;Luft-luft varmepumpe;1;53,149091;0;0;162,4;29,8;30,1;222,3;67,3 %;100 %;100 %
Boligblokk;TEK69;Luft-væske varmepumpe;1;77,952;8,94;0;162,4;29,8;30,1;222,3;52 %;70 %;100 %
Boligblokk;TEK69;Væske-væske varmepumpe;1;110,2;10,728;0;162,4;29,8;30,1;222,3;32,1 %;64 %;100 %
Småhus;TEK87;Etterisolering yttervegg;1;15;0;0;141,4;29,8;29,9;201,1;89,4 %;100 %;100 %
Småhus;TEK87;Etterisolering av kjeller og loft;1;4,7;0;0;141,4;29,8;29,9;201,1;96,7 %;100 %;100 %
Småhus;TEK87;Oppgradering av vinduer gul liste;1;23,4;0;0;141,4;29,8;29,9;201,1;83,5 %;100 %;100 %
Småhus;TEK87;Oppgradering av vinduer standard;1;31,4;0;0;141,4;29,8;29,9;201,1;77,8 %;100 %;100 %
Småhus;TEK87;Temperaturstyring;0;8,484;0;0;141,4;29,8;29,9;201,1;94 %;100 %;100 %
Småhus;TEK87;Luft-luft varmepumpe;1;46,276364;0;0;141,4;29,8;29,9;201,1;67,3 %;100 %;100 %
Småhus;TEK87;Luft-væske varmepumpe;1;67,872;8,94;0;141,4;29,8;29,9;201,1;52 %;70 %;100 %
Småhus;TEK87;Væske-væske varmepumpe;1;95,95;10,728;0;141,4;29,8;29,9;201,1;32,1 %;64 %;100 %
Boligblokk;TEK87;Etterisolering yttervegg;1;9,7;0;0;111,9;29,8;29,7;171,4;91,3 %;100 %;100 %
Boligblokk;TEK87;Etterisolering av kjeller og loft;1;2,8;0;0;111,9;29,8;29,7;171,4;97,5 %;100 %;100 %
Boligblokk;TEK87;Oppgradering av vinduer gul liste;1;21;0;0;111,9;29,8;29,7;171,4;81,2 %;100 %;100 %
Boligblokk;TEK87;Oppgradering av vinduer standard;1;28,1;0;0;111,9;29,8;29,7;171,4;74,9 %;100 %;100 %
Boligblokk;TEK87;Temperaturstyring;0;5,595;0;0;111,9;29,8;29,7;171,4;95 %;100 %;100 %
Boligblokk;TEK87;Luft-luft varmepumpe;1;36,621818;0;0;111,9;29,8;29,7;171,4;67,3 %;100 %;100 %
Boligblokk;TEK87;Luft-væske varmepumpe;1;53,712;8,94;0;111,9;29,8;29,7;171,4;52 %;70 %;100 %
Boligblokk;TEK87;Væske-væske varmepumpe;1;75,932143;10,728;0;111,9;29,8;29,7;171,4;32,1 %;64 %;100 %
Småhus;TEK97;Etterisolering yttervegg;1;3,7;0;0;102,9;29,8;34,1;166,8;96,4 %;100 %;100 %
Småhus;TEK97;Etterisolering av kjeller og loft;1;0,4;0;0;102,9;29,8;34,1;166,8;99,6 %;100 %;100 %
Småhus;TEK97;Oppgradering av vinduer gul liste;1;14,2;0;0;102,9;29,8;34,1;166,8;86,2 %;100 %;100 %
Småhus;TEK97;Oppgradering av vinduer standard;1;14,2;0;0;102,9;29,8;34,1;166,8;86,2 %;100 %;100 %
Småhus;TEK97;Temperaturstyring;0;0;0;0;102,9;29,8;34,1;166,8;100 %;100 %;100 %
Småhus;TEK97;Luft-luft varmepumpe;1;33,676364;0;0;102,9;29,8;34,1;166,8;67,3 %;100 %;100 %
Småhus;TEK97;Luft-væske varmepumpe;1;49,392;8,94;0;102,9;29,8;34,1;166,8;52 %;70 %;100 %
Småhus;TEK97;Væske-væske varmepumpe;1;69,825;10,728;0;102,9;29,8;34,1;166,8;32,1 %;64 %;100 %
Boligblokk;TEK97;Etterisolering yttervegg;1;7,3;0;0;89,1;29,8;35;153,9;91,8 %;100 %;100 %
Boligblokk;TEK97;Etterisolering av kjeller og loft;1;0;0;0;89,1;29,8;35;153,9;100 %;100 %;100 %
Boligblokk;TEK97;Oppgradering av vinduer gul liste;1;12,1;0;0;89,1;29,8;35;153,9;86,4 %;100 %;100 %
Boligblokk;TEK97;Oppgradering av vinduer standard;1;12,1;0;0;89,1;29,8;35;153,9;86,4 %;100 %;100 %
Boligblokk;TEK97;Temperaturstyring;0;0;0;0;89,1;29,8;35;153,9;100 %;100 %;100 %
Boligblokk;TEK97;Luft-luft varmepumpe;1;29,16;0;0;89,1;29,8;35;153,9;67,3 %;100 %;100 %
Boligblokk;TEK97;Luft-væske varmepumpe;1;42,768;8,94;0;89,1;29,8;35;153,9;52 %;70 %;100 %
Boligblokk;TEK97;Væske-væske varmepumpe;1;60,460714;10,728;0;89,1;29,8;35;153,9;32,1 %;64 %;100 %
Småhus;TEK07;Etterisolering yttervegg;1;0;0;0;53,5;29,8;45,9;129,2;100 %;100 %;100 %
Småhus;TEK07;Etterisolering av kjeller og loft;1;0;0;0;53,5;29,8;45,9;129,2;100 %;100 %;100 %
Småhus;TEK07;Oppgradering av vinduer gul liste;1;8,2;0;0;53,5;29,8;45,9;129,2;84,7 %;100 %;100 %
Småhus;TEK07;Oppgradering av vinduer standard;1;8,2;0;0;53,5;29,8;45,9;129,2;84,7 %;100 %;100 %
Småhus;TEK07;Temperaturstyring;0;0;0;0;53,5;29,8;45,9;129,2;100 %;100 %;100 %
Småhus;TEK07;Luft-luft varmepumpe;1;17,509091;0;0;53,5;29,8;45,9;129,2;67,3 %;100 %;100 %
Småhus;TEK07;Luft-væske varmepumpe;1;25,68;8,94;0;53,5;29,8;45,9;129,2;52 %;70 %;100 %
Småhus;TEK07;Væske-væske varmepumpe;1;36,303571;10,728;0;53,5;29,8;45,9;129,2;32,1 %;64 %;100 %
Boligblokk;TEK07;Etterisolering yttervegg;1;0;0;0;33,2;29,8;49,5;112,5;100 %;100 %;100 %
Boligblokk;TEK07;Etterisolering av kjeller og loft;1;0,4;0;0;33,2;29,8;49,5;112,5;98,8 %;100 %;100 %
Boligblokk;TEK07;Oppgradering av vinduer gul liste;1;7,2;0;0;33,2;29,8;49,5;112,5;78,3 %;100 %;100 %
Boligblokk;TEK07;Oppgradering av vinduer standard;1;7,2;0;0;33,2;29,8;49,5;112,5;78,3 %;100 %;100 %
Boligblokk;TEK07;Temperaturstyring;0;0;0;0;33,2;29,8;49,5;112,5;100 %;100 %;100 %
Boligblokk;TEK07;Luft-luft varmepumpe;1;10,865455;0;0;33,2;29,8;49,5;112,5;67,3 %;100 %;100 %
Boligblokk;TEK07;Luft-væske varmepumpe;1;15,936;8,94;0;33,2;29,8;49,5;112,5;52 %;70 %;100 %
Boligblokk;TEK07;Væske-væske varmepumpe;1;22,528571;10,728;0;33,2;29,8;49,5;112,5;32,1 %;64 %;100 %
Småhus;TEK17;Temperaturstyring;0;0;0;0;45,3;29,8;45,9;121;100 %;100 %;100 %
Småhus;TEK17;Luft-luft varmepumpe;1;14,825455;0;0;45,3;29,8;45,9;121;67,3 %;100 %;100 %
Småhus;TEK17;Luft-væske varmepumpe;1;21,744;8,94;0;45,3;29,8;45,9;121;52 %;70 %;100 %
Småhus;TEK17;Væske-væske varmepumpe;1;30,739286;10,728;0;45,3;29,8;45,9;121;32,1 %;64 %;100 %
Boligblokk;TEK17;Temperaturstyring;0;0;0;0;24,7;29,8;49,5;104;100 %;100 %;100 %
Boligblokk;TEK17;Luft-luft varmepumpe;1;8,083636;0;0;24,7;29,8;49,5;104;67,3 %;100 %;100 %
Boligblokk;TEK17;Luft-væske varmepumpe;1;11,856;8,94;0;24,7;29,8;49,5;104;52 %;70 %;100 %
Boligblokk;TEK17;Væske-væske varmepumpe;1;16,760714;10,728;0;24,7;29,8;49,5;104;32,1 %;64 %;100 %
Småhus;TEK10;Temperaturstyring;0;0;0;0;45,3;29,8;45,9;121;100 %;70 %;100 %
Småhus;TEK17;Luft-luft varmepumpe;1;14,825455;0;0;45,3;29,8;45,9;121;67,3 %;100 %;100 %
Småhus;TEK17;Luft-væske varmepumpe;1;21,744;8,94;0;45,3;29,8;45,9;121;52 %;70 %;100 %
Småhus;TEK17;Væske-væske varmepumpe;1;30,739286;10,728;0;45,3;29,8;45,9;121;32,1 %;64 %;100 %
Boligblokk;TEK10;Luft-luft varmepumpe;1;8,083636;0;0;24,7;29,8;49,5;104;67,3 %;100 %;100 %
Boligblokk;TEK10;Luft-væske varmepumpe;1;11,856;8,94;0;24,7;29,8;49,5;104;52 %;70 %;100 %
Boligblokk;TEK10;Væske-væske varmepumpe;1;16,760714;20,221429;0;24,7;29,8;49,5;104;32,1 %;32,1 %;100 %
Boligblokk;TEK10;Temperaturstyring;1;0;0;0;24,7;29,8;49,5;104;100 %;64 %;100 %
Småhus;TEK69;Ventilasjonsgjenvinning;1;19,844;0;-1,806;180,4;29,8;30,1;240,3;89 %;100 %;106 %
Småhus;TEK87;Ventilasjonsgjenvinning;1;16,968;0;1,196;141,4;29,8;29,9;201,1;88 %;100 %;96 %
Småhus;TEK97;Ventilasjonsgjenvinning;1;16,464;0;1,364;102,9;29,8;34,1;166,8;84 %;100 %;95 %
Boligblokk;TEK69;Ventilasjonsgjenvinning;1;47,096;0;0,9;162,4;29,8;30;222,2;71 %;100 %;97 %
Boligblokk;TEK87;Ventilasjonsgjenvinning;1;36,927;0;1,485;111,9;29,8;29,7;171,4;67 %;100 %;95 %
Boligblokk;TEK97;Ventilasjonsgjenvinning;1;37,422;0;1,75;89,1;29,8;35;153,9;58 %;100 %;95 %
Småhus;TEK10;Oppgradering av vinduer gul liste;1;6,1;0;0;53,5;29,8;45,9;129,2;88,6 %;100 %;100 %
Boligblokk;TEK10;Oppgradering av vinduer gul liste;1;5;0;0;53,5;29,8;45,9;129,2;90,7 %;100 %;100 %
Småhus;TEK17;Oppgradering av vinduer gul liste;1;6,1;0;0;53,5;29,8;45,9;129,2;88,6 %;100 %;100 %
Boligblokk;TEK17;Oppgradering av vinduer gul liste;1;5;0;0;53,5;29,8;45,9;129,2;90,7 %;100 %;100 %`;

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

/**
 * Stabil mapping fra tiltakId (brukt i content-filer og URL-er) til intern TiltakType.
 * Denne mappingen er uavhengig av visningsnavn/titler som kan endres i admin-verktøyet.
 *
 * VIKTIG: Ikke endre disse nøklene uten å oppdatere content-filene også.
 */
export const TILTAK_ID_TO_TYPE: Record<string, TiltakType | null> = {
  'etterisolering-yttervegg': 'etterisolering_yttervegg',
  'etterisolering-kjeller-loft': 'etterisolering_kjeller_loft',
  'vinduer': 'vinduer_standard', // gul liste håndteres via erPaaGulListe parameter
  'temperaturstyring': 'temperaturstyring',
  'ventilasjon': 'ventilasjonsgjenvinning',
  'varmepumpe': 'luft_luft_varmepumpe', // default, tabs kan overstyre
  'solenergi': null, // solenergi bruker egen beregning, ikke rate-basert
  'tetting': null, // ingen data i CSV ennå
};

/**
 * Mapping fra varmepumpe-tab til TiltakType.
 * Brukes når varmepumpe-kortet har aktiv tab som spesifiserer type.
 */
export const VARMEPUMPE_TAB_TO_TYPE: Record<string, TiltakType> = {
  'luft-luft': 'luft_luft_varmepumpe',
  'luft-vann': 'luft_vaeske_varmepumpe',
  'luft-vaeske': 'luft_vaeske_varmepumpe',
  'vaeske-vann': 'vaeske_vaeske_varmepumpe',
  'vaeske-vaeske': 'vaeske_vaeske_varmepumpe',
};

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
export function normalizeTekPeriod(tekPeriod: TekPeriodInput): TEKPeriod | null {
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
 * TEK-perioder som er eldre enn TEK69 og skal bruke TEK69-verdier som fallback.
 * Dette gjelder bygg med byggeår før 1969 der vi ikke har spesifikke besparelsesdata.
 */
const PRE_TEK69_PERIODS: TEKPeriod[] = ['Eldre', 'TEK49'];

/**
 * Returnerer TEK-periode for dataoppslag. For TEK-perioder eldre enn TEK69
 * returneres 'TEK69' som fallback, da vi bruker disse verdiene for eldre bygg.
 *
 * @param tekPeriod - Normalisert TEK-periode
 * @returns TEK-periode for dataoppslag (TEK69 for pre-TEK69 bygg)
 */
export function getTekPeriodForLookup(tekPeriod: TEKPeriod): TEKPeriod {
  if (PRE_TEK69_PERIODS.includes(tekPeriod)) {
    return 'TEK69';
  }
  return tekPeriod;
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

  // Slå opp i datastrukturen - bruk TEK69 for pre-TEK69 bygg
  const lookupTek = getTekPeriodForLookup(normalizedTek);

  const tiltakData = ENERGY_SAVINGS_RATES[actualTiltak];
  if (!tiltakData) {
    console.warn(`Mangler data for tiltak "${actualTiltak}"`);
    return null;
  }

  const tekData = tiltakData[lookupTek];
  if (!tekData) {
    console.warn(
      `Mangler data for tiltak "${actualTiltak}" og TEK "${lookupTek}"`
    );
    return null;
  }

  const rates = tekData[boligtype];
  if (rates === null || rates === undefined) {
    console.warn(
      `Mangler data for tiltak "${actualTiltak}", TEK "${lookupTek}", boligtype "${boligtype}"`
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
    // Solenergi identifiseres ved tittel/id og har solarProductionKwh
    // Støtter både 'Solenergi' (visningsnavn) og 'solenergi' (tiltakId)
    if ((t.title === 'Solenergi' || t.title === 'solenergi') && t.solarProductionKwh !== undefined) {
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

  // Sjekk om det finnes rate-baserte tiltak (ikke bare solenergi)
  const hasRateBasedTiltak = romRates.length > 0 || tapRates.length > 0 || elRates.length > 0;

  // Hvis kun solenergi er valgt (ingen rate-baserte tiltak), returner bare solproduksjon
  if (!hasRateBasedTiltak) {
    return solarProduction;
  }

  // Forsøk å bruke ny metode med forbruksfordeling per energitype
  if (tekPeriod && boligtype && bruksareal && bruksareal > 0) {
    const normalizedTek = normalizeTekPeriod(tekPeriod);
    if (normalizedTek) {
      // Bruk TEK69 for pre-TEK69 bygg
      const lookupTek = getTekPeriodForLookup(normalizedTek);
      const distribution = ENERGY_CONSUMPTION_DISTRIBUTIONS[lookupTek]?.[boligtype];

      if (distribution) {
        // Beregn forbruk per energitype (i kWh, ikke kWh/m²)
        const romoppvarmingForbruk = distribution.romoppvarming * bruksareal;
        const tappevannsForbruk = distribution.tappevann * bruksareal;
        const elspesifiktForbruk = distribution.elspesifikt * bruksareal;
        const totalForbrukFraDistribution = romoppvarmingForbruk + tappevannsForbruk + elspesifiktForbruk;

        // Beregn forbruk etter tiltak per energitype
        const romoppvarmingEtter = romoppvarmingForbruk * kombinertRomRate;
        const tappevannsEtter = tappevannsForbruk * kombinertTapRate;
        const elspesifiktEtter = elspesifiktForbruk * kombinertElRate;

        // Beregn total forbruk etter tiltak
        const totalEtter = romoppvarmingEtter + tappevannsEtter + elspesifiktEtter;

        // Beregn besparelse som prosent av distribution-forbruk, deretter skaler til opprinneligForbruk
        // Dette sikrer konsistens uansett hvilken metode som brukes for å beregne opprinnelig forbruk
        const besparelseProsent = (totalForbrukFraDistribution - totalEtter) / totalForbrukFraDistribution;
        let besparelse = opprinneligForbruk * besparelseProsent;

        // Håndter edge case: negativ besparelse (netto økning)
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

/**
 * Henter energibesparelsesrater basert på tiltakId (stabil ID fra content-filer).
 *
 * Denne funksjonen er foretrukket over getRateForTiltak() fordi den bruker
 * stabile ID-er som ikke endres når visningsnavn oppdateres i admin-verktøyet.
 *
 * @param tiltakId - Tiltak-ID fra content-fil (f.eks. 'varmepumpe', 'vinduer')
 * @param tekPeriod - TEK-periode
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @param options - Valgfrie innstillinger
 * @param options.erPaaGulListe - Om bygningen er på gul liste (for vinduer)
 * @param options.varmepumpeTab - Aktiv tab for varmepumpe (f.eks. 'luft-luft', 'luft-vann')
 * @returns EnergyTypeRates eller null hvis tiltaket ikke har rate-data
 *
 * @example
 * // Standard oppslag
 * const rates = getRateForTiltakId('etterisolering-yttervegg', 'TEK69', 'småhus');
 *
 * @example
 * // Vinduer med gul liste
 * const rates = getRateForTiltakId('vinduer', 'TEK69', 'småhus', { erPaaGulListe: true });
 *
 * @example
 * // Varmepumpe med spesifikk type
 * const rates = getRateForTiltakId('varmepumpe', 'TEK69', 'småhus', { varmepumpeTab: 'luft-vann' });
 */
export function getRateForTiltakId(
  tiltakId: string,
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  options?: {
    erPaaGulListe?: boolean;
    varmepumpeTab?: string;
  }
): EnergyTypeRates | null {
  const { erPaaGulListe = false, varmepumpeTab } = options ?? {};

  // Spesialhåndtering for varmepumpe med tabs
  if (tiltakId === 'varmepumpe' && varmepumpeTab && varmepumpeTab !== 'generelt') {
    const varmepumpeType = VARMEPUMPE_TAB_TO_TYPE[varmepumpeTab];
    if (varmepumpeType) {
      return getEnergySavingsRate(varmepumpeType, tekPeriod, boligtype);
    }
  }

  // Spesialhåndtering for vinduer med gul liste
  if (tiltakId === 'vinduer') {
    const vinduerType: TiltakType = erPaaGulListe ? 'vinduer_gul_liste' : 'vinduer_standard';
    return getEnergySavingsRate(vinduerType, tekPeriod, boligtype);
  }

  // Standard oppslag via TILTAK_ID_TO_TYPE
  const tiltakType = TILTAK_ID_TO_TYPE[tiltakId];
  if (!tiltakType) {
    // null betyr at tiltaket ikke har rate-data (f.eks. solenergi, tetting)
    return null;
  }

  return getEnergySavingsRate(tiltakType, tekPeriod, boligtype);
}

/**
 * Typisk kWh/m² per TEK-periode og boligtype (fra CSV)
 * Brukes for å estimere "effektiv TEK-periode" basert på faktisk energiforbruk
 */
const TEK_TYPICAL_CONSUMPTION: Record<TEKPeriod, Record<Boligtype, number>> = {
  'Eldre': { småhus: 240.3, blokk: 222.3 },  // Samme som TEK69
  'TEK49': { småhus: 240.3, blokk: 222.3 },  // Samme som TEK69
  'TEK69': { småhus: 240.3, blokk: 222.3 },
  'TEK87': { småhus: 201.1, blokk: 171.4 },
  'TEK97': { småhus: 166.8, blokk: 153.9 },
  'TEK07': { småhus: 129.2, blokk: 112.5 },
  'TEK10': { småhus: 121.0, blokk: 104.0 },  // Samme som TEK17
  'TEK17': { småhus: 121.0, blokk: 104.0 },
};

/**
 * Estimerer en "effektiv TEK-periode" basert på faktisk kWh/m² fra Enova-data.
 *
 * Når en bolig har Enova-attest som viser lavere forbruk enn forventet for byggeåret,
 * betyr det at boligen allerede er oppgradert. For å beregne realistiske besparelser
 * må vi bruke besparelsesfaktorer som matcher det faktiske energinivået.
 *
 * @param kwhPerM2 - Faktisk energiintensitet (kWh/m²/år) fra Enova-data
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @returns Nærmeste TEK-periode som matcher energinivået
 *
 * @example
 * // Bolig med Enova-attest: 116 kWh/m² (småhus)
 * // Typisk TEK17 småhus er 121 kWh/m²
 * // → Returnerer 'TEK17' (nærmest match)
 * estimateTekPeriodFromKwhPerM2(116, 'småhus'); // 'TEK17'
 */
export function estimateTekPeriodFromKwhPerM2(
  kwhPerM2: number,
  boligtype: Boligtype
): TEKPeriod {
  // Sorter TEK-perioder fra lavest til høyest forbruk
  const tekPeriods: TEKPeriod[] = ['TEK17', 'TEK10', 'TEK07', 'TEK97', 'TEK87', 'TEK69'];

  // Finn nærmeste TEK-periode basert på kwhPerM2
  let closestTek: TEKPeriod = 'TEK69'; // Default til høyeste
  let closestDiff = Infinity;

  for (const tek of tekPeriods) {
    const typicalValue = TEK_TYPICAL_CONSUMPTION[tek][boligtype];
    const diff = Math.abs(kwhPerM2 - typicalValue);

    if (diff < closestDiff) {
      closestDiff = diff;
      closestTek = tek;
    }
  }

  return closestTek;
}

/**
 * Beregner energibesparelser for sammenligningsmodulen basert på Enova-data.
 *
 * Denne funksjonen brukes når en bolig har Enova-attest som viser lavere forbruk
 * enn TEK-estimatet fra byggeåret. I stedet for naiv skalering:
 * 1. Estimerer en "effektiv TEK-periode" basert på Enova kwhPerM2
 * 2. Henter besparelsesfaktorer fra CSV for denne TEK-perioden
 * 3. Beregner besparelser basert på Enova-forbruk og disse faktorene
 *
 * @param enovaKwhPerM2 - Faktisk energiintensitet fra Enova-data
 * @param bruksareal - Bruksareal i m²
 * @param boligtype - Boligtype ('småhus' eller 'blokk')
 * @param tiltak - Liste med valgte tiltak og deres info
 * @returns Total besparelse i kWh
 */
export function calculateComparisonSavings(
  enovaKwhPerM2: number,
  bruksareal: number,
  boligtype: Boligtype,
  tiltak: TiltakSavingsInfo[]
): number {
  if (!Number.isFinite(enovaKwhPerM2) || enovaKwhPerM2 <= 0) {
    return 0;
  }
  if (!Number.isFinite(bruksareal) || bruksareal <= 0) {
    return 0;
  }

  // Estimer effektiv TEK-periode basert på Enova kwhPerM2
  const effectiveTek = estimateTekPeriodFromKwhPerM2(enovaKwhPerM2, boligtype);

  // Beregn faktisk forbruk fra Enova-data
  const enovaForbruk = enovaKwhPerM2 * bruksareal;

  // Separer solenergi fra andre tiltak og bygg opp rates
  let solarProduction = 0;
  const romRates: number[] = [];
  const tapRates: number[] = [];
  const elRates: number[] = [];

  for (const t of tiltak) {
    if ((t.title === 'Solenergi' || t.title === 'solenergi') && t.solarProductionKwh !== undefined) {
      solarProduction += t.solarProductionKwh;
    } else if (t.rates !== null) {
      if (t.rates.romoppvarming > 0) romRates.push(t.rates.romoppvarming);
      if (t.rates.tappevann > 0) tapRates.push(t.rates.tappevann);
      if (t.rates.elspesifikt > 0) elRates.push(t.rates.elspesifikt);
    }
  }

  // Hvis kun solenergi, returner bare solproduksjon
  if (romRates.length === 0 && tapRates.length === 0 && elRates.length === 0) {
    return solarProduction;
  }

  // Kombiner rates multiplikativt
  const kombinertRomRate = romRates.reduce((acc, rate) => acc * rate, 1);
  const kombinertTapRate = tapRates.reduce((acc, rate) => acc * rate, 1);
  const kombinertElRate = elRates.reduce((acc, rate) => acc * rate, 1);

  // Hent forbruksfordeling for den effektive TEK-perioden
  const lookupTek = getTekPeriodForLookup(effectiveTek);
  const distribution = ENERGY_CONSUMPTION_DISTRIBUTIONS[lookupTek]?.[boligtype];

  if (!distribution) {
    // Fallback: bruk gjennomsnitt av rates
    const kombinertRate = (kombinertRomRate + kombinertTapRate + kombinertElRate) / 3;
    return enovaForbruk * (1 - kombinertRate) + solarProduction;
  }

  // Beregn forbruk per energitype basert på effektiv TEK fordeling
  const totalDistribution = distribution.romoppvarming + distribution.tappevann + distribution.elspesifikt;
  const romAndel = distribution.romoppvarming / totalDistribution;
  const tapAndel = distribution.tappevann / totalDistribution;
  const elAndel = distribution.elspesifikt / totalDistribution;

  // Fordel Enova-forbruket på energityper
  const romoppvarmingForbruk = enovaForbruk * romAndel;
  const tappevannsForbruk = enovaForbruk * tapAndel;
  const elspesifiktForbruk = enovaForbruk * elAndel;

  // Beregn forbruk etter tiltak
  const romoppvarmingEtter = romoppvarmingForbruk * kombinertRomRate;
  const tappevannsEtter = tappevannsForbruk * kombinertTapRate;
  const elspesifiktEtter = elspesifiktForbruk * kombinertElRate;

  // Total besparelse
  const totalEtter = romoppvarmingEtter + tappevannsEtter + elspesifiktEtter;
  let besparelse = enovaForbruk - totalEtter;

  // Ikke returner negativ besparelse
  if (besparelse < 0) {
    besparelse = 0;
  }

  return besparelse + solarProduction;
}

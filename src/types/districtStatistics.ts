/**
 * Type-definisjoner for bydelsstatistikk
 * Brukes for sammenligning av energieffektivitet mellom boliger i samme bydel
 */

/**
 * Energikarakter (A-G) ifølge NS 3031:2025
 */
export type EnergyGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/**
 * Boligtype for statistikk-gruppering
 */
export type BuildingTypeCategory = 'småhus' | 'blokk';

/**
 * Percentil-verdier for energiforbruk i en bydel/boligtype
 */
export interface PercentileDistribution {
  /** Topp 10% mest energieffektive (kWh/m²/år) */
  p10: number;
  /** Topp 25% mest energieffektive (kWh/m²/år) */
  p25: number;
  /** Median (kWh/m²/år) */
  p50: number;
  /** 75. percentil (kWh/m²/år) */
  p75: number;
  /** 90. percentil (kWh/m²/år) */
  p90: number;
}

/**
 * Fordeling av energikarakterer i prosent
 * Summerer til 100
 */
export type EnergyGradeDistribution = Record<EnergyGrade, number>;

/**
 * Statistikk for en spesifikk boligtype i en bydel
 */
export interface DistrictStats {
  /** Gjennomsnittlig energiforbruk (kWh/m²/år) */
  avgKwhPerM2: number;
  /** Median energiforbruk (kWh/m²/år) */
  medianKwhPerM2: number;
  /** Antall boliger i statistikkgrunnlaget */
  count: number;
  /** Percentil-fordeling for energiforbruk */
  percentiles: PercentileDistribution;
  /** Prosentvis fordeling av energikarakterer */
  energyGradeDistribution: EnergyGradeDistribution;
}

/**
 * Statistikk for en hel bydel, delt på boligtype
 */
export interface DistrictData {
  småhus: DistrictStats;
  blokk: DistrictStats;
}

/**
 * Komplett statistikk-dataset for alle bydeler og delbydeler
 */
export interface DistrictStatisticsData {
  /** Dato for sist oppdatering (ISO 8601) */
  lastUpdated: string;
  /** Datakilde */
  source: 'enova-bulk' | 'mock';
  /** Statistikk per bydel */
  districts: Record<string, DistrictData>;
  /** Statistikk per delbydel (nøkkel: "Bydel/Delbydel") */
  subdistricts: Record<string, DistrictData>;
  /** Aggregert statistikk for hele Oslo */
  oslo: DistrictData;
}

/**
 * Props for DistrictComparison-komponenten
 */
export interface DistrictComparisonProps {
  /** Om sammenlignings-seksjonen er utvidet */
  isExpanded: boolean;
  /** Callback for å toggle utvidet/kollapset tilstand */
  onToggle: () => void;
  /** Nåværende energiforbruk (kWh/m²/år) */
  currentKwhPerM2: number;
  /** Totale energibesparelser fra valgte tiltak (kWh/år) */
  totalEnergySavings: number;
  /** Bruksareal (m²) */
  bruksareal: number;
  /** Navn på bydelen */
  districtName: string;
  /** Statistikk for bydelen */
  districtStats: DistrictStats;
  /** Navn på delbydelen (valgfri) */
  subdistrictName?: string;
  /** Statistikk for delbydelen (valgfri) */
  subdistrictStats?: DistrictStats;
}

/**
 * Resultat fra percentil-beregning
 */
export interface PercentileResult {
  /** Hvilken percentil boligen ligger i (f.eks. 35 = topp 35%) */
  percentile: number;
  /** Om boligen er bedre enn gjennomsnittet */
  isBetterThanAverage: boolean;
  /** Prosentvis forskjell fra bydelssnitt */
  percentageDifferenceFromAvg: number;
}

/**
 * Motiverende melding basert på percentil-posisjon
 */
export interface MotivationalMessage {
  /** Meldings-tekst */
  text: string;
  /** Punkt skin for PktAlert */
  skin: 'success' | 'info' | 'warning';
  /** Valgfritt ikonnavn fra Punkt */
  iconName?: string;
}

/**
 * Alle 15 bydeler i Oslo
 */
export const OSLO_DISTRICTS = [
  'Alna',
  'Bjerke',
  'Frogner',
  'Gamle Oslo',
  'Grorud',
  'Grünerløkka',
  'Nordre Aker',
  'Nordstrand',
  'Sagene',
  'St. Hanshaugen',
  'Stovner',
  'Søndre Nordstrand',
  'Ullern',
  'Vestre Aker',
  'Østensjø',
] as const;

export type OsloDistrict = typeof OSLO_DISTRICTS[number];

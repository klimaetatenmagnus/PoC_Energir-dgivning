/**
 * Service for håndtering av bydelsstatistikk
 * Brukes for sammenligning av energieffektivitet mellom boliger
 *
 * Datakilder (i prioritert rekkefølge):
 * 1. Ekte Enova-data fra src/data/district-statistics-enova.json (hvis tilgjengelig)
 * 2. Mock-data fra src/data/mock-district-statistics.json
 *
 * Supplerende data:
 * - ArcGIS Oslo kommune: Boligstruktur-statistikk per bydel
 *
 * Kjør scripts/aggregate-district-statistics.ts for å generere ekte data.
 */

import mockData from '../data/mock-district-statistics.json';
import {
  fetchDistrictBuildingStats,
  fetchAllDistrictStats,
  type ArcGISDistrictStats,
} from './arcgisService';
import type {
  DistrictStatisticsData,
  DistrictStats,
  BuildingTypeCategory,
  PercentileResult,
  MotivationalMessage,
} from '../types/districtStatistics';

let cachedData: DistrictStatisticsData | null = null;

/**
 * Forsøker å laste ekte Enova-data, faller tilbake til mock hvis ikke tilgjengelig
 *
 * Filen district-statistics-enova.json genereres av:
 *   npx tsx scripts/aggregate-district-statistics.ts
 */
async function loadStatisticsData(): Promise<DistrictStatisticsData> {
  try {
    // Forsøk å laste ekte Enova-data
    const enovaModule = await import('../data/district-statistics-enova.json');
    const enovaData = enovaModule.default as unknown as DistrictStatisticsData;

    // Sjekk om det er ekte Enova-data (ikke placeholder)
    if (enovaData && enovaData.source === 'enova-bulk' && enovaData.lastUpdated !== 'placeholder') {
      // Ekte Enova-statistikk lastet (oppdatert: enovaData.lastUpdated)
      return enovaData;
    }
  } catch {
    // Ignorer feil - bruk mock-data
  }

  // Fallback til mock-data
  return mockData as DistrictStatisticsData;
}

/**
 * Tvinger reload av statistikkdata (nyttig for testing)
 */
export async function reloadDistrictStatistics(): Promise<DistrictStatisticsData> {
  cachedData = null;
  return getDistrictStatistics();
}

/**
 * Returnerer info om nåværende datakilde
 */
export function getDataSourceInfo(): { source: 'enova-bulk' | 'mock'; lastUpdated: string } {
  const data = cachedData ?? (mockData as DistrictStatisticsData);
  return {
    source: data.source,
    lastUpdated: data.lastUpdated,
  };
}

/**
 * Henter bydelsstatistikk
 * Returnerer cached data hvis tilgjengelig
 */
export async function getDistrictStatistics(): Promise<DistrictStatisticsData> {
  if (cachedData) return cachedData;

  cachedData = await loadStatisticsData();
  return cachedData;
}

/**
 * Synkron versjon for å hente cached data
 * Returnerer null hvis data ikke er lastet
 */
export function getDistrictStatisticsSync(): DistrictStatisticsData | null {
  return cachedData ?? (mockData as DistrictStatisticsData);
}

/**
 * Normaliserer bydelsnavn til konsistent format
 * Håndterer varianter som "NORDRE AKER", "nordre aker", "Nordre Aker"
 */
export function normalizeDistrictName(name: string): string {
  if (!name) return '';

  return name
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Henter statistikk for en spesifikk bydel og boligtype
 */
export function getStatsForDistrict(
  data: DistrictStatisticsData,
  districtName: string,
  buildingType: BuildingTypeCategory
): DistrictStats | null {
  const normalizedDistrict = normalizeDistrictName(districtName);
  return data.districts[normalizedDistrict]?.[buildingType] ?? null;
}

/**
 * Lager nøkkel for delbydel-oppslag
 * Format: "Bydel/Delbydel"
 */
export function createSubdistrictKey(
  districtName: string,
  subdistrictName: string
): string {
  const normalizedDistrict = normalizeDistrictName(districtName);
  const normalizedSubdistrict = normalizeDistrictName(subdistrictName);
  return `${normalizedDistrict}/${normalizedSubdistrict}`;
}

/**
 * Henter statistikk for en spesifikk delbydel og boligtype
 */
export function getStatsForSubdistrict(
  data: DistrictStatisticsData,
  districtName: string,
  subdistrictName: string,
  buildingType: BuildingTypeCategory
): DistrictStats | null {
  const key = createSubdistrictKey(districtName, subdistrictName);
  return data.subdistricts?.[key]?.[buildingType] ?? null;
}

/**
 * Henter statistikk for hele Oslo for en boligtype
 */
export function getOsloStats(
  data: DistrictStatisticsData,
  buildingType: BuildingTypeCategory
): DistrictStats {
  return data.oslo[buildingType];
}

/**
 * Beregner percentil-posisjon for en bolig basert på kWh/m²
 * Returnerer estimert percentil (lavere = bedre)
 */
export function calculatePercentile(
  kwhPerM2: number,
  stats: DistrictStats
): number {
  const { percentiles } = stats;

  if (kwhPerM2 <= percentiles.p10) return 10;
  if (kwhPerM2 <= percentiles.p25) {
    // Interpoler mellom p10 og p25
    const ratio = (kwhPerM2 - percentiles.p10) / (percentiles.p25 - percentiles.p10);
    return Math.round(10 + ratio * 15);
  }
  if (kwhPerM2 <= percentiles.p50) {
    const ratio = (kwhPerM2 - percentiles.p25) / (percentiles.p50 - percentiles.p25);
    return Math.round(25 + ratio * 25);
  }
  if (kwhPerM2 <= percentiles.p75) {
    const ratio = (kwhPerM2 - percentiles.p50) / (percentiles.p75 - percentiles.p50);
    return Math.round(50 + ratio * 25);
  }
  if (kwhPerM2 <= percentiles.p90) {
    const ratio = (kwhPerM2 - percentiles.p75) / (percentiles.p90 - percentiles.p75);
    return Math.round(75 + ratio * 15);
  }
  return 95;
}

/**
 * Beregner detaljert percentil-resultat med sammenligning mot snitt
 */
export function calculatePercentileResult(
  kwhPerM2: number,
  stats: DistrictStats
): PercentileResult {
  const percentile = calculatePercentile(kwhPerM2, stats);
  const isBetterThanAverage = kwhPerM2 < stats.avgKwhPerM2;
  const percentageDifferenceFromAvg = ((stats.avgKwhPerM2 - kwhPerM2) / stats.avgKwhPerM2) * 100;

  return {
    percentile,
    isBetterThanAverage,
    percentageDifferenceFromAvg,
  };
}

/**
 * Genererer motiverende melding basert på percentil-posisjon
 * Meldingene er positive og oppmuntrende
 */
export function getMotivationalMessage(
  percentile: number,
  districtName: string
): MotivationalMessage {
  if (percentile <= 10) {
    return {
      text: `Imponerende! Du er blant de mest energieffektive i ${districtName}!`,
      skin: 'success',
      iconName: 'thumbs-up',
    };
  }
  if (percentile <= 25) {
    return {
      text: `Bra jobbet! Din bolig er godt over gjennomsnittet i ${districtName}!`,
      skin: 'success',
      iconName: 'thumbs-up',
    };
  }
  if (percentile <= 50) {
    return {
      text: `Din bolig er bedre enn gjennomsnittet i ${districtName}!`,
      skin: 'info',
      iconName: 'check-circle',
    };
  }
  if (percentile <= 75) {
    return {
      text: 'Det finnes gode muligheter for å forbedre energieffektiviteten!',
      skin: 'info',
      iconName: 'bulb',
    };
  }
  return {
    text: 'Med noen tiltak kan du spare betydelig på energiregningen!',
    skin: 'info',
    iconName: 'bulb',
  };
}

/**
 * Mapper bygningstype-navn til BuildingTypeCategory
 */
export function mapBuildingTypeToCategory(
  buildingTypeName: string
): BuildingTypeCategory {
  const normalized = buildingTypeName.toLowerCase();

  if (
    normalized.includes('blokk') ||
    normalized.includes('leilighet') ||
    normalized.includes('boligbygg') ||
    normalized === 'store boligbygg'
  ) {
    return 'blokk';
  }

  return 'småhus';
}

/**
 * Beregner projisert energiforbruk etter tiltak
 */
export function calculateProjectedConsumption(
  currentKwhPerM2: number,
  totalEnergySavings: number,
  bruksareal: number
): number {
  if (bruksareal <= 0) return currentKwhPerM2;

  const savingsPerM2 = totalEnergySavings / bruksareal;
  return Math.max(0, currentKwhPerM2 - savingsPerM2);
}

/**
 * Formaterer prosentforskjell med fortegn
 */
export function formatPercentageDifference(percentage: number): string {
  const rounded = Math.round(Math.abs(percentage));
  if (percentage > 0) {
    return `${rounded}% bedre enn snitt`;
  } else if (percentage < 0) {
    return `${rounded}% over snitt`;
  }
  return 'på gjennomsnittet';
}

// =============================================================================
// ArcGIS-integrasjon: Supplerende boligstruktur-data fra Oslo kommune
// =============================================================================

// Re-eksporter ArcGIS-typer for enkel tilgang
export type { ArcGISDistrictStats } from './arcgisService';

/**
 * Henter boligstruktur-statistikk fra ArcGIS for en bydel
 *
 * Returnerer informasjon om fordeling av bygningstyper i bydelen,
 * som kan brukes til å supplere Enova-statistikken.
 *
 * @param bydel - Bydelsnavn (f.eks. "Nordre Aker")
 * @returns ArcGIS-statistikk eller null hvis ikke tilgjengelig
 */
export async function getArcGISDistrictStats(
  bydel: string
): Promise<ArcGISDistrictStats | null> {
  try {
    return await fetchDistrictBuildingStats(bydel);
  } catch (error) {
    console.warn(`[DistrictStats] Kunne ikke hente ArcGIS-data for ${bydel}:`, error);
    return null;
  }
}

/**
 * Henter boligstruktur-statistikk for alle bydeler
 *
 * Nyttig for å sammenligne bygningstype-fordeling på tvers av bydeler.
 *
 * @returns Map med bydelsnavn som nøkkel
 */
export async function getAllArcGISDistrictStats(): Promise<Map<string, ArcGISDistrictStats>> {
  try {
    return await fetchAllDistrictStats();
  } catch (error) {
    console.warn('[DistrictStats] Kunne ikke hente ArcGIS-data for alle bydeler:', error);
    return new Map();
  }
}

/**
 * Kombinerer Enova-statistikk med ArcGIS boligstruktur-data
 *
 * Gir et mer komplett bilde ved å kombinere energidata fra Enova
 * med kommunal boligstatistikk fra ArcGIS.
 *
 * @param districtName - Bydelsnavn
 * @param buildingType - Boligtype (småhus/blokk)
 * @returns Kombinert statistikk eller null
 */
export async function getEnrichedDistrictStats(
  districtName: string,
  buildingType: BuildingTypeCategory
): Promise<{
  energyStats: DistrictStats;
  buildingStructure: ArcGISDistrictStats | null;
  enriched: boolean;
} | null> {
  const data = await getDistrictStatistics();
  const energyStats = getStatsForDistrict(data, districtName, buildingType);

  if (!energyStats) {
    return null;
  }

  const buildingStructure = await getArcGISDistrictStats(districtName);

  return {
    energyStats,
    buildingStructure,
    enriched: buildingStructure !== null,
  };
}

// src/utils/buildingTypeUtils.ts
// -----------------------------------------------------------------------------
// Utilities for handling building type logic based on Norwegian building standards
// -----------------------------------------------------------------------------

import {
  BLOCK_CODE_GROUPS,
  isResidentialCode,
  resolveBuildingTypeCode,
  SMALL_HOUSE_CODE_GROUPS,
  type BuildingTypeSource,
} from './buildingTypeCode.ts';

/**
 * Building type classification based on Norwegian standard for bygningstype
 * https://www.ssb.no/klass/klassifikasjoner/31
 */

export interface BuildingTypeStrategy {
  isResidential: boolean;
  reportingLevel: 'section' | 'building' | 'exclude';
  description: string;
}

/**
 * Determine reporting strategy based on the 3-digit building type code.
 *
 * Koden hentes via resolveBuildingTypeCode (oppslått kode → CSV → verifisert
 * ID-tabell). Matrikkelens interne `bygningstypeKodeId` tolkes aldri direkte
 * som kode: ID 111 er sykehjem (kode 721), ikke enebolig.
 *
 * Rules:
 * 1. Only residential buildings (1xx codes) are processed
 * 2. Individual houses (11x, 12x, 16x, 17x) -> report section data
 * 3. Collective housing (13x, 14x) -> report building data
 * 4. Other residential types (15x, 18x, 19x) -> exclude
 *
 * @param building - Building with `bygningstypeKode`, `bygningstypeKodeId` and/or `csvData`
 * @returns Strategy object indicating how to handle this building type
 */
export function determineBuildingTypeStrategy(
  building?: BuildingTypeSource | null
): BuildingTypeStrategy {
  const code = resolveBuildingTypeCode(building);

  if (code === undefined) {
    return {
      isResidential: false,
      reportingLevel: 'exclude',
      description: 'Unknown building type'
    };
  }

  // Check if it's a residential building (1xx)
  if (code < 100 || code >= 200) {
    return {
      isResidential: false,
      reportingLevel: 'exclude',
      description: 'Non-residential building'
    };
  }

  // Individual residential buildings - report section data
  if (
    (code >= 110 && code < 130) ||  // 11x - Enebolig, 12x - Tomannsbolig
    (code >= 160 && code < 180)     // 16x - Fritidsbolig, 17x - Koie/seterhus
  ) {
    return {
      isResidential: true,
      reportingLevel: 'section',
      description: getBuildingTypeDescription(code)
    };
  }

  // Collective housing - report building data
  if (
    (code >= 130 && code < 150)     // 13x - Rekkehus/kjedehus, 14x - Store boligbygg
  ) {
    return {
      isResidential: true,
      reportingLevel: 'building',
      description: getBuildingTypeDescription(code)
    };
  }

  // Other residential types - exclude
  return {
    isResidential: true,
    reportingLevel: 'exclude',
    description: getBuildingTypeDescription(code)
  };
}

/**
 * Get human-readable description for building type code
 */
function getBuildingTypeDescription(code: number): string {
  // Main categories from the standard
  if (code >= 110 && code < 120) return 'Enebolig';
  if (code >= 120 && code < 130) return 'Tomannsbolig';
  if (code >= 130 && code < 140) return 'Rekkehus/kjedehus';
  if (code >= 140 && code < 150) return 'Store boligbygg';
  if (code >= 150 && code < 160) return 'Bygning for bofellesskap';
  if (code >= 160 && code < 170) return 'Fritidsbolig';
  if (code >= 170 && code < 180) return 'Koie/seterhus';
  if (code >= 180 && code < 190) return 'Garasje/uthus til bolig';
  if (code >= 190 && code < 200) return 'Annen boligbygning';
  
  return `Bygningstype ${code}`;
}

/**
 * Check if a building type should be processed by the energy tool
 */
export function shouldProcessBuildingType(building?: BuildingTypeSource | null): boolean {
  const strategy = determineBuildingTypeStrategy(building);
  return strategy.isResidential && strategy.reportingLevel !== 'exclude';
}

/**
 * Check if building data should be reported at section level vs building level
 */
export function shouldReportSectionLevel(building?: BuildingTypeSource | null): boolean {
  const strategy = determineBuildingTypeStrategy(building);
  return strategy.reportingLevel === 'section';
}

/**
 * Check if building data should be reported at building level
 */
export function shouldReportBuildingLevel(building?: BuildingTypeSource | null): boolean {
  const strategy = determineBuildingTypeStrategy(building);
  return strategy.reportingLevel === 'building';
}

/**
 * Melding som vises i stedet for årsforbruk og karakter når adressen er
 * registrert som noe annet enn bolig (kode utenfor 110–179). Returnerer
 * `null` for boliger og for bygg uten kjent bygningstype.
 */
export function getUnsupportedBuildingMessage(
  building: (BuildingTypeSource & { bygningstype?: string | null }) | null | undefined
): string | null {
  const code = resolveBuildingTypeCode(building);
  if (code === undefined || isResidentialCode(code)) {
    return null;
  }

  const typeName = building?.bygningstype?.trim();
  const registeredAs = typeName
    ? `Denne adressen er registrert som «${typeName}».`
    : 'Denne adressen er ikke registrert som bolig.';
  return `Energinøkkelen støtter foreløpig bare boliger. ${registeredAs}`;
}

/**
 * BuildingKind type for transition overlay system
 * Re-exported from TransitionOverlayTypes for convenience
 */
export type { BuildingKind } from '../context/TransitionOverlayTypes';

/**
 * Determine if a building is classified as 'enebolig' (single-family home) or 'blokk' (apartment block)
 * based on building type data.
 *
 * This is the single source of truth for BuildingKind classification used across
 * the transition overlay system and mobile components.
 *
 * Classification rules:
 * - 'enebolig': single-family homes, duplexes, row houses (codes 11x, 12x, 13x)
 *   and holiday homes/cabins (codes 16x, 17x)
 * - 'blokk': apartment blocks, large residential buildings (codes 14x, 15x)
 *
 * @param building - Object containing building type information
 * @returns 'enebolig' or 'blokk'
 */
export function getBuildingKind(building: {
  csvData?: { bygningstypeNavn?: string; bygningstype3siffer?: string | null };
  bygningstypeKode?: string;
  bygningstypeKodeId?: number;
}): 'enebolig' | 'blokk' {
  // Check CSV data first (most reliable when available)
  const csvType = building.csvData?.bygningstypeNavn?.toLowerCase();
  if (csvType) {
    if (
      csvType.includes('enebolig') ||
      csvType.includes('tomannsbolig') ||
      csvType.includes('rekkehus') ||
      csvType.includes('småhus')
    ) {
      return 'enebolig';
    }
    // Explicit blokk detection from CSV
    if (
      csvType.includes('blokk') ||
      csvType.includes('leilighet') ||
      csvType.includes('boligbygg')
    ) {
      return 'blokk';
    }
  }

  // Check 3-digit building type code (oppslått kode → CSV → verifisert ID-tabell)
  const code = resolveBuildingTypeCode(building);
  if (code !== undefined) {
    // Småhus (11x–13x) og fritidsbolig/koie (16x–17x) -> 'enebolig'
    if (SMALL_HOUSE_CODE_GROUPS.includes(String(code).substring(0, 2))) {
      return 'enebolig';
    }
    // Store boligbygg og bofellesskap (14x–15x) -> 'blokk'
    if (BLOCK_CODE_GROUPS.includes(String(code).substring(0, 2))) {
      return 'blokk';
    }
  }

  // Default to 'blokk' when unable to determine
  return 'blokk';
}

/**
 * Check if a building result should be classified as 'enebolig'
 * Convenience function that wraps getBuildingKind
 */
export function isEneboligBuilding(building: {
  csvData?: { bygningstypeNavn?: string; bygningstype3siffer?: string | null };
  bygningstypeKode?: string;
  bygningstypeKodeId?: number;
}): boolean {
  return getBuildingKind(building) === 'enebolig';
}
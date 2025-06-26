// src/utils/buildingTypeUtils.ts
// -----------------------------------------------------------------------------
// Utilities for handling building type logic based on Norwegian building standards
// -----------------------------------------------------------------------------

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
 * Determine reporting strategy based on building type code
 * 
 * Rules:
 * 1. Only residential buildings (1xx codes) are processed
 * 2. Individual houses (11x, 12x, 16x, 17x) -> report section data
 * 3. Collective housing (13x, 14x) -> report building data  
 * 4. Other residential types (15x, 18x, 19x) -> exclude
 * 
 * @param bygningstypeKodeId - Building type code from Matrikkel API
 * @returns Strategy object indicating how to handle this building type
 */
export function determineBuildingTypeStrategy(bygningstypeKodeId?: number): BuildingTypeStrategy {
  if (!bygningstypeKodeId) {
    return {
      isResidential: false,
      reportingLevel: 'exclude',
      description: 'Unknown building type'
    };
  }

  let code = bygningstypeKodeId;
  
  // Handle internal IDs (under 100) by mapping to standard codes
  if (code < 100) {
    // Known mappings from internal IDs to standard codes
    const internalIdMapping: Record<number, number> = {
      1: 111,   // Enebolig
      4: 121,   // Tomannsbolig, vertikaldelt
      5: 122,   // Tomannsbolig, horisontaldelt
      8: 131,   // Rekkehus
      10: 141,  // Store frittliggende boligbygg på 2 etasjer
      11: 142,  // Store frittliggende boligbygg på 3 og 4 etasjer
      12: 143,  // Store frittliggende boligbygg på 5 etasjer eller over
      13: 142,  // Store frittliggende boligbygg på 3 og 4 etasjer
      14: 144,  // Store sammenbygde boligbygg på 2 etasjer
      15: 145,  // Store sammenbygde boligbygg på 3 og 4 etasjer
      16: 146,  // Store sammenbygde boligbygg på 5 etasjer og over
      26: 181,  // Garasje, uthus, anneks knyttet til bolig
      127: 142, // Store frittliggende boligbygg på 3 og 4 etasjer (Fallanveien 29)
    };
    
    // Map internal ID to standard code
    code = internalIdMapping[code] || code;
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
export function shouldProcessBuildingType(bygningstypeKodeId?: number): boolean {
  const strategy = determineBuildingTypeStrategy(bygningstypeKodeId);
  return strategy.isResidential && strategy.reportingLevel !== 'exclude';
}

/**
 * Check if building data should be reported at section level vs building level
 */
export function shouldReportSectionLevel(bygningstypeKodeId?: number): boolean {
  const strategy = determineBuildingTypeStrategy(bygningstypeKodeId);
  return strategy.reportingLevel === 'section';
}

/**
 * Check if building data should be reported at building level
 */
export function shouldReportBuildingLevel(bygningstypeKodeId?: number): boolean {
  const strategy = determineBuildingTypeStrategy(bygningstypeKodeId);
  return strategy.reportingLevel === 'building';
}
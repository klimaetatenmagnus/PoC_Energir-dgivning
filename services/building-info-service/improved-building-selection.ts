import { getExpectedBuildingNumber } from '../../src/data/residential-building-cache.ts';
import type { ByggInfo } from '../../src/clients/StoreClient.ts';
import { debugLog } from './logging.ts';

export interface ImprovedBuildingSelectionConfig {
  preferExpectedBuilding: boolean;
  handleRowHouses: boolean;
  considerBuildingAge: boolean;
  debug: boolean;
}

/**
 * Improved building selection logic based on CSV comparison analysis
 * Key improvements:
 * 1. Prefer buildings that match expected building numbers from CSV
 * 2. Special handling for row houses (return individual units)
 * 3. Better section/letter matching
 * 4. Consider building age when multiple options exist
 */
const DEFAULT_CONFIG: ImprovedBuildingSelectionConfig = {
  preferExpectedBuilding: true,
  handleRowHouses: true,
  considerBuildingAge: true,
  debug: false,
};

const ROW_HOUSE_NAME = 'bygdøylund';

function numericBuildingNumber(bygningsnummer?: string | null): number | undefined {
  if (!bygningsnummer) {
    return undefined;
  }

  const parsed = Number.parseInt(bygningsnummer, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function selectBuildingImproved(
  address: string,
  buildings: ByggInfo[],
  config: ImprovedBuildingSelectionConfig = DEFAULT_CONFIG
): ByggInfo {
  const {
    preferExpectedBuilding,
    handleRowHouses,
    considerBuildingAge,
    debug,
  } = config;
  
  if (buildings.length === 0) {
    throw new Error("No buildings provided");
  }
  
  if (buildings.length === 1) {
    return buildings[0];
  }

  const log = (...args: unknown[]) => {
    if (debug) {
      debugLog(...args);
    }
  };

  log(`🔍 Improved selection called for: ${address}`);
  log(`  Buildings to choose from: ${buildings.length}`);
  log(`  Config: ${JSON.stringify(config)}`);

  let candidateBuildings: ByggInfo[] = [...buildings];

  // Extract address components
  const letterMatch = address.match(/\d+([A-Z])(?:\s|,|$)/i);
  const letter = letterMatch ? letterMatch[1].toUpperCase() : null;
  const isRowHouse = address.toLowerCase().includes(ROW_HOUSE_NAME);

  // 1. Check if we have an expected building number from CSV
  if (preferExpectedBuilding) {
    const expectedBuildingNumber = getExpectedBuildingNumber(address);
    if (expectedBuildingNumber) {
      log(`📌 Expected building number from CSV: ${expectedBuildingNumber}`);

      const exactMatch = candidateBuildings.find(
        (b) => b.bygningsnummer === expectedBuildingNumber
      );
      if (exactMatch) {
        log(`✅ Found exact match for expected building number`);
        return exactMatch;
      }

      // Try to find closest match
      const expectedNumeric = numericBuildingNumber(expectedBuildingNumber);
      const closeMatches = expectedNumeric
        ? candidateBuildings.filter((b) => {
            const actual = numericBuildingNumber(b.bygningsnummer);
            return actual !== undefined
              ? Math.abs(expectedNumeric - actual) < 50
              : false;
          })
        : [];

      if (closeMatches.length > 0) {
        log(`🔍 Found ${closeMatches.length} close matches (within 50 of expected)`);
        // Pick the closest one
        const closest = closeMatches.reduce((prev, curr) => {
          const prevDiff = Math.abs(
            (numericBuildingNumber(prev.bygningsnummer) ?? Number.POSITIVE_INFINITY) -
              (expectedNumeric ?? 0)
          );
          const currDiff = Math.abs(
            (numericBuildingNumber(curr.bygningsnummer) ?? Number.POSITIVE_INFINITY) -
              (expectedNumeric ?? 0)
          );
          return currDiff < prevDiff ? curr : prev;
        });
        return closest;
      }
    }
  }
  
  // 2. Special handling for row houses
  if (handleRowHouses && isRowHouse) {
    log(`🏘️ Row house detected: ${address}`);
    
    // For row houses, try to match based on the house number
    const houseNumberMatch = address.match(/bygdøylund\s+(\d+)/i);
    if (houseNumberMatch) {
      const houseNumber = parseInt(houseNumberMatch[1]);

      // Sort buildings by building number
      const sortedBuildings = [...candidateBuildings].sort((a, b) => {
        const aNum = numericBuildingNumber(a.bygningsnummer) ?? Number.POSITIVE_INFINITY;
        const bNum = numericBuildingNumber(b.bygningsnummer) ?? Number.POSITIVE_INFINITY;
        return aNum - bNum;
      });

      // Try to map house number to building position
      // This is a heuristic - might need adjustment based on actual patterns
      if (houseNumber <= sortedBuildings.length) {
        log(`📍 Selecting building at position ${houseNumber - 1} for row house unit ${houseNumber}`);
        return sortedBuildings[houseNumber - 1];
      }
    }
  }

  // 3. Handle addresses with letters (sections)
  if (letter) {
    log(`🔤 Address has letter suffix: ${letter}`);
    
    // For addresses with letters, prefer smaller/older buildings for higher letters
    // This is based on the pattern that A is often the main/largest unit
    const letterIndex = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    
    // Sort by area (ascending)
    const sortedByArea = [...candidateBuildings].sort((a, b) =>
      (a.bruksarealM2 || 0) - (b.bruksarealM2 || 0)
    );

    if (letterIndex < sortedByArea.length) {
      log(`📏 Selecting building at position ${letterIndex} based on area for letter ${letter}`);
      return sortedByArea[letterIndex];
    }
    
    // If we have buildings with units, prefer those
    const buildingsWithUnits = candidateBuildings.filter(
      (b) => b.bruksenhetIds && b.bruksenhetIds.length > 0
    );
    if (buildingsWithUnits.length > 0) {
      // Prefer buildings with multiple units for sectioned properties
      const multiUnitBuildings = buildingsWithUnits.filter(
        (b) => (b.bruksenhetIds?.length ?? 0) > 1
      );
      if (multiUnitBuildings.length > 0) {
        log(`🏢 Selecting building with multiple units for sectioned property`);
        return multiUnitBuildings.reduce((prev, curr) =>
          (curr.bruksarealM2 || 0) > (prev.bruksarealM2 || 0) ? curr : prev
        );
      }
    }
  }

  // 4. Consider building age
  if (considerBuildingAge) {
    // Filter out very new buildings (300-series) unless they're the only option
    const non300Series = candidateBuildings.filter(
      (b) => !b.bygningsnummer?.startsWith('300')
    );
    if (
      non300Series.length > 0 &&
      candidateBuildings.some((b) => b.bygningsnummer?.startsWith('300'))
    ) {
      log(`🏗️ Filtering out 300-series (newer) buildings`);
      candidateBuildings = non300Series;
    }
  }

  // 5. Default logic: select the largest residential building
  const residentialBuildings = candidateBuildings.filter((b) => {
    const typeId = b.bygningstypeKodeId;
    return typeId && typeId >= 1 && typeId <= 17;
  });

  if (residentialBuildings.length > 0) {
    log(`🏠 Selecting largest residential building from ${residentialBuildings.length} options`);
    return residentialBuildings.reduce((prev, curr) =>
      (curr.bruksarealM2 || 0) > (prev.bruksarealM2 || 0) ? curr : prev
    );
  }

  // Final fallback: largest building overall
  log(`🔄 Fallback: selecting largest building overall`);
  return candidateBuildings.reduce((prev, curr) =>
    (curr.bruksarealM2 || 0) > (prev.bruksarealM2 || 0) ? curr : prev
  );
}

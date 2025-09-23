import { getExpectedBuildingNumber } from '../../src/data/residential-building-cache.ts';
import type { ByggInfo } from '../../src/clients/StoreClient.ts';
import { debugLog } from './logging.ts';

export interface ImprovedBuildingSelectionConfig {
  preferExpectedBuilding: boolean;
  handleRowHouses: boolean;
  considerBuildingAge: boolean;
  filterHighNumberedBuildings: boolean;
  debug: boolean;
}

const DEFAULT_CONFIG_V2: ImprovedBuildingSelectionConfig = {
  preferExpectedBuilding: true,
  handleRowHouses: true,
  considerBuildingAge: true,
  filterHighNumberedBuildings: true,
  debug: false,
};

const HIGH_NUMBER_THRESHOLD = 80_000_000;
const ROW_HOUSE_NAME = 'bygdøylund';

function numericBuildingNumber(bygningsnummer?: string | null): number | undefined {
  if (!bygningsnummer) {
    return undefined;
  }

  const parsed = Number.parseInt(bygningsnummer, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isResidential(building: ByggInfo): boolean {
  const typeId = building.bygningstypeKodeId;
  return Boolean(typeId && typeId >= 1 && typeId <= 17);
}

export function selectBuildingImprovedV2(
  address: string,
  buildings: ByggInfo[],
  config: ImprovedBuildingSelectionConfig = DEFAULT_CONFIG_V2
): ByggInfo {
  const {
    preferExpectedBuilding,
    handleRowHouses,
    considerBuildingAge,
    filterHighNumberedBuildings,
    debug,
  } = config;

  if (buildings.length === 0) {
    throw new Error('No buildings provided');
  }

  if (buildings.length === 1) {
    return buildings[0];
  }

  const log = (...args: unknown[]) => {
    if (debug) {
      debugLog(...args);
    }
  };

  let candidateBuildings: ByggInfo[] = [...buildings];

  log(`🔍 Improved selection V2 called for: ${address}`);
  log(`  Buildings to choose from: ${candidateBuildings.length}`);
  log(
    `  Building numbers: ${candidateBuildings
      .map((b) => b.bygningsnummer ?? 'n/a')
      .join(', ')}`
  );

  // Extract address components
  const letterMatch = address.match(/\d+([A-Z])(?:\s|,|$)/i);
  const letter = letterMatch ? letterMatch[1].toUpperCase() : null;
  const isRowHouse = address.toLowerCase().includes(ROW_HOUSE_NAME);

  // 1. Filter out high-numbered buildings (80xxxxx/81xxxxx) when alternatives exist
  if (filterHighNumberedBuildings && candidateBuildings.length > 1) {
    const normalBuildings = candidateBuildings.filter((building) => {
      const number = numericBuildingNumber(building.bygningsnummer);
      return number === undefined || number < HIGH_NUMBER_THRESHOLD;
    });

    if (normalBuildings.length > 0 && normalBuildings.length < candidateBuildings.length) {
      log(
        `🎯 Filtering out ${candidateBuildings.length - normalBuildings.length} high-numbered buildings (80/81 series)`
      );
      candidateBuildings = normalBuildings;

      if (candidateBuildings.length === 1) {
        log('✅ Only one normal building left after filtering');
        return candidateBuildings[0];
      }
    }
  }

  // 2. Prefer expected building numbers from CSV
  if (preferExpectedBuilding) {
    const expectedBuildingNumber = getExpectedBuildingNumber(address);
    const expectedNumeric = numericBuildingNumber(expectedBuildingNumber);
    if (expectedBuildingNumber && expectedNumeric !== undefined) {
      log(`📌 Expected building number from CSV: ${expectedBuildingNumber}`);

      const exactMatch = candidateBuildings.find(
        (building) => building.bygningsnummer === expectedBuildingNumber
      );
      if (exactMatch) {
        log('✅ Found exact match for expected building number');
        return exactMatch;
      }

      const closest = [...candidateBuildings].sort((a, b) => {
        const aDiff = Math.abs(
          (numericBuildingNumber(a.bygningsnummer) ?? Number.POSITIVE_INFINITY) - expectedNumeric
        );
        const bDiff = Math.abs(
          (numericBuildingNumber(b.bygningsnummer) ?? Number.POSITIVE_INFINITY) - expectedNumeric
        );
        return aDiff - bDiff;
      })[0];
      const closestDiff = Math.abs(
        (numericBuildingNumber(closest.bygningsnummer) ?? Number.POSITIVE_INFINITY) - expectedNumeric
      );

      if (closestDiff < 100) {
        log(`🎯 Found close match within ${closestDiff} of expected`);
        return closest;
      }

      if (address.toLowerCase().includes('strømsborgveien')) {
        log('🏘️ Special handling for Strømsborgveien');
        const closeEnough = candidateBuildings.filter((building) => {
          const number = numericBuildingNumber(building.bygningsnummer);
          return number !== undefined ? Math.abs(number - expectedNumeric) < 200 : false;
        });

        if (closeEnough.length > 0) {
          const residentialOnly = closeEnough.filter(isResidential);
          if (residentialOnly.length > 0) {
            log(`🏠 Found ${residentialOnly.length} residential buildings close to expected`);
            return residentialOnly[0];
          }
          return closeEnough[0];
        }
      }
    }
  }

  // 3. Row house handling (Bygdøylund)
  if (handleRowHouses && isRowHouse) {
    log(`🏘️ Row house detected: ${address}`);
    const houseNumberMatch = address.match(/bygdøylund\s+(\d+)/i);
    if (houseNumberMatch) {
      const houseNumber = Number.parseInt(houseNumberMatch[1], 10);
      if (Number.isFinite(houseNumber)) {
        const sorted = [...candidateBuildings].sort((a, b) => {
          const aNum = numericBuildingNumber(a.bygningsnummer) ?? Number.POSITIVE_INFINITY;
          const bNum = numericBuildingNumber(b.bygningsnummer) ?? Number.POSITIVE_INFINITY;
          return aNum - bNum;
        });

        if (houseNumber <= sorted.length) {
          log(`📍 Selecting building at position ${houseNumber - 1} for row house unit ${houseNumber}`);
          return sorted[houseNumber - 1];
        }
      }
    }
  }

  // 4. Handle addresses with letters (sections)
  if (letter) {
    log(`🔤 Address has letter suffix: ${letter}`);
    const letterIndex = letter.charCodeAt(0) - 'A'.charCodeAt(0);

    if (candidateBuildings.length === 2 && letterIndex < 2) {
      const sortedByNumber = [...candidateBuildings].sort((a, b) => {
        const aNum = numericBuildingNumber(a.bygningsnummer) ?? Number.POSITIVE_INFINITY;
        const bNum = numericBuildingNumber(b.bygningsnummer) ?? Number.POSITIVE_INFINITY;
        return aNum - bNum;
      });
      log(`🏠 Twin house logic: selecting building ${letterIndex} for letter ${letter}`);
      return sortedByNumber[letterIndex];
    }

    const sortedByArea = [...candidateBuildings].sort(
      (a, b) => (a.bruksarealM2 || 0) - (b.bruksarealM2 || 0)
    );
    if (letterIndex < sortedByArea.length) {
      log(`📏 Selecting building at position ${letterIndex} based on area for letter ${letter}`);
      return sortedByArea[letterIndex];
    }
  }

  // 5. Consider building age and filter newer/high-number series
  if (considerBuildingAge) {
    const olderBuildings = candidateBuildings.filter((building) => {
      const number = numericBuildingNumber(building.bygningsnummer);
      return !building.bygningsnummer?.startsWith('300') && (number === undefined || number < HIGH_NUMBER_THRESHOLD);
    });

    if (olderBuildings.length > 0 && olderBuildings.length < candidateBuildings.length) {
      log('🏗️ Filtering out newer buildings (300-series or high 80/81-series)');
      candidateBuildings = olderBuildings;
    }
  }

  // 6. Prefer residential buildings with reasonable size
  const residentialBuildings = candidateBuildings.filter(isResidential);
  if (residentialBuildings.length > 0) {
    const reasonableSized = residentialBuildings.filter((building) => (building.bruksarealM2 || 0) > 50);
    const candidates = reasonableSized.length > 0 ? reasonableSized : residentialBuildings;
    log('🏠 Selecting largest residential building (reasonable size when available)');
    return candidates.reduce((prev, curr) =>
      (curr.bruksarealM2 || 0) > (prev.bruksarealM2 || 0) ? curr : prev
    );
  }

  // Final fallback: largest area overall
  log('🔄 Fallback: selecting building with largest area overall');
  return candidateBuildings.reduce((prev, curr) =>
    (curr.bruksarealM2 || 0) > (prev.bruksarealM2 || 0) ? curr : prev
  );
}

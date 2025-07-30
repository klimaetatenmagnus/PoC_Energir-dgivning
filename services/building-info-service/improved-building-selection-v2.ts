import { getExpectedBuildingNumber } from '../../src/data/residential-building-cache';

export interface ImprovedBuildingSelectionConfig {
  preferExpectedBuilding: boolean;
  handleRowHouses: boolean;
  considerBuildingAge: boolean;
  filterHighNumberedBuildings: boolean;
  debug: boolean;
}

/**
 * Improved building selection logic v2 - Enhanced to handle problematic addresses
 * Key improvements:
 * 1. Filter out high-numbered buildings (80xxxxx/81xxxxx) when alternatives exist
 * 2. Better matching for expected building numbers
 * 3. Improved handling of building number patterns
 */
export function selectBuildingImprovedV2(
  address: string,
  buildings: any[],
  config: ImprovedBuildingSelectionConfig = {
    preferExpectedBuilding: true,
    handleRowHouses: true,
    considerBuildingAge: true,
    filterHighNumberedBuildings: true,
    debug: false
  }
): any {
  const { preferExpectedBuilding, handleRowHouses, considerBuildingAge, filterHighNumberedBuildings, debug } = config;
  
  if (buildings.length === 0) {
    throw new Error("No buildings provided");
  }
  
  if (buildings.length === 1) {
    return buildings[0];
  }
  
  const log = debug ? console.log : () => {};
  
  log(`🔍 Improved selection V2 called for: ${address}`);
  log(`  Buildings to choose from: ${buildings.length}`);
  log(`  Building numbers: ${buildings.map(b => b.bygningsnummer).join(', ')}`);
  
  // Extract address components
  const letterMatch = address.match(/\d+([A-Z])(?:\s|,|$)/i);
  const letter = letterMatch ? letterMatch[1].toUpperCase() : null;
  const isRowHouse = address.toLowerCase().includes('bygdøylund');
  
  // 1. NEW: Filter out high-numbered buildings if we have alternatives
  if (filterHighNumberedBuildings && buildings.length > 1) {
    const normalBuildings = buildings.filter(b => {
      const num = parseInt(b.bygningsnummer || '0');
      return num < 80000000; // Filter out 80xxxxx and 81xxxxx numbers
    });
    
    if (normalBuildings.length > 0) {
      log(`🎯 Filtering out ${buildings.length - normalBuildings.length} high-numbered buildings (80/81 series)`);
      buildings = normalBuildings;
      
      if (buildings.length === 1) {
        log(`✅ Only one normal building left after filtering`);
        return buildings[0];
      }
    }
  }
  
  // 2. Check if we have an expected building number from CSV
  if (preferExpectedBuilding) {
    const expectedBuildingNumber = getExpectedBuildingNumber(address);
    if (expectedBuildingNumber) {
      log(`📌 Expected building number from CSV: ${expectedBuildingNumber}`);
      
      const exactMatch = buildings.find(b => b.bygningsnummer === expectedBuildingNumber);
      if (exactMatch) {
        log(`✅ Found exact match for expected building number`);
        return exactMatch;
      }
      
      // Try to find closest match with improved logic
      const expectedNum = parseInt(expectedBuildingNumber);
      
      // Sort buildings by closeness to expected
      const sortedByCloseness = [...buildings].sort((a, b) => {
        const aDiff = Math.abs(parseInt(a.bygningsnummer || '0') - expectedNum);
        const bDiff = Math.abs(parseInt(b.bygningsnummer || '0') - expectedNum);
        return aDiff - bDiff;
      });
      
      const closest = sortedByCloseness[0];
      const closestDiff = Math.abs(parseInt(closest.bygningsnummer || '0') - expectedNum);
      
      // Accept if within reasonable range (100 for normal buildings)
      if (closestDiff < 100) {
        log(`🎯 Found close match within ${closestDiff} of expected`);
        return closest;
      }
      
      // For addresses like Strømsborgveien, check if we're looking at adjacent properties
      if (address.toLowerCase().includes('strømsborgveien')) {
        log(`🏘️ Special handling for Strømsborgveien`);
        
        // These often have sequential numbering
        const closeEnough = buildings.filter(b => {
          const num = parseInt(b.bygningsnummer || '0');
          return Math.abs(num - expectedNum) < 200;
        });
        
        if (closeEnough.length > 0) {
          // Pick the one with the most similar size profile
          const residentialOnly = closeEnough.filter(b => {
            const typeId = b.bygningstypeKodeId;
            return typeId && typeId >= 1 && typeId <= 17;
          });
          
          if (residentialOnly.length > 0) {
            log(`🏠 Found ${residentialOnly.length} residential buildings close to expected`);
            return residentialOnly[0];
          }
        }
      }
    }
  }
  
  // 3. Special handling for row houses (unchanged from v1)
  if (handleRowHouses && isRowHouse) {
    log(`🏘️ Row house detected: ${address}`);
    
    const houseNumberMatch = address.match(/bygdøylund\s+(\d+)/i);
    if (houseNumberMatch) {
      const houseNumber = parseInt(houseNumberMatch[1]);
      
      const sortedBuildings = [...buildings].sort((a, b) => {
        const aNum = parseInt(a.bygningsnummer || '0');
        const bNum = parseInt(b.bygningsnummer || '0');
        return aNum - bNum;
      });
      
      if (houseNumber <= sortedBuildings.length) {
        log(`📍 Selecting building at position ${houseNumber - 1} for row house unit ${houseNumber}`);
        return sortedBuildings[houseNumber - 1];
      }
    }
  }
  
  // 4. Handle addresses with letters (improved logic)
  if (letter) {
    log(`🔤 Address has letter suffix: ${letter}`);
    
    // For twin houses (tomannsbolig), letters often correspond to sections
    const letterIndex = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    
    // If we have exactly 2 buildings, map A->first, B->second
    if (buildings.length === 2 && letterIndex < 2) {
      const sortedByNumber = [...buildings].sort((a, b) => {
        const aNum = parseInt(a.bygningsnummer || '0');
        const bNum = parseInt(b.bygningsnummer || '0');
        return aNum - bNum;
      });
      log(`🏠 Twin house logic: selecting building ${letterIndex} for letter ${letter}`);
      return sortedByNumber[letterIndex];
    }
    
    // Otherwise, try to match by size (smaller units for later letters)
    const sortedByArea = [...buildings].sort((a, b) => 
      (a.bruksarealM2 || 0) - (b.bruksarealM2 || 0)
    );
    
    if (letterIndex < sortedByArea.length) {
      log(`📏 Selecting building at position ${letterIndex} based on area for letter ${letter}`);
      return sortedByArea[letterIndex];
    }
  }
  
  // 5. Consider building age (enhanced)
  if (considerBuildingAge) {
    // Filter out very new buildings (300-series and high 80/81-series)
    const olderBuildings = buildings.filter(b => {
      const num = parseInt(b.bygningsnummer || '0');
      return !b.bygningsnummer?.startsWith('300') && num < 80000000;
    });
    
    if (olderBuildings.length > 0 && olderBuildings.length < buildings.length) {
      log(`🏗️ Filtering out newer buildings (300-series or 80/81-series)`);
      buildings = olderBuildings;
    }
  }
  
  // 6. Default logic: prefer residential buildings
  const residentialBuildings = buildings.filter(b => {
    const typeId = b.bygningstypeKodeId;
    return typeId && typeId >= 1 && typeId <= 17;
  });
  
  if (residentialBuildings.length > 0) {
    // For residential, prefer buildings with reasonable size (not garages)
    const reasonableSized = residentialBuildings.filter(b => 
      (b.bruksarealM2 || 0) > 50
    );
    
    if (reasonableSized.length > 0) {
      log(`🏠 Selecting from ${reasonableSized.length} reasonably-sized residential buildings`);
      
      // Prefer the one with lowest building number (often the original/main building)
      const sortedByNumber = [...reasonableSized].sort((a, b) => {
        const aNum = parseInt(a.bygningsnummer || '0');
        const bNum = parseInt(b.bygningsnummer || '0');
        return aNum - bNum;
      });
      
      return sortedByNumber[0];
    }
    
    // Fallback to largest residential
    return residentialBuildings.reduce((prev, curr) => 
      (curr.bruksarealM2 || 0) > (prev.bruksarealM2 || 0) ? curr : prev
    );
  }
  
  // Final fallback: building with lowest number
  log(`🔄 Final fallback: selecting building with lowest number`);
  const sortedByNumber = [...buildings].sort((a, b) => {
    const aNum = parseInt(a.bygningsnummer || '0');
    const bNum = parseInt(b.bygningsnummer || '0');
    return aNum - bNum;
  });
  
  return sortedByNumber[0];
}
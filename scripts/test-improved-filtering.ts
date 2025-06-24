// Test improved filtering logic with additional heuristics
import "../loadEnv.ts";

// Enhanced filtering logic proposal
function isLikelyResidentialBuilding(building: {
  bygningstypeKodeId?: number;
  bruksarealM2?: number;
  byggeaar?: number;
  bygningsnummer?: string;
}): { isResidential: boolean; reason: string } {
  
  // 1. Check building type code first (most reliable)
  if (building.bygningstypeKodeId) {
    const code = building.bygningstypeKodeId;
    
    // Map internal IDs
    const mappedCode = code < 100 ? mapInternalId(code) : code;
    
    // Explicitly exclude garages, sheds, etc.
    if (mappedCode >= 181 && mappedCode <= 189) {
      return { isResidential: false, reason: "Garage/shed type code" };
    }
    
    // Explicitly exclude non-residential (2xx, 3xx, etc.)
    if (mappedCode >= 200) {
      return { isResidential: false, reason: "Non-residential type code" };
    }
    
    // Include residential (1xx)
    if (mappedCode >= 100 && mappedCode < 200) {
      return { isResidential: true, reason: "Residential type code" };
    }
  }
  
  // 2. If no type code, use heuristics
  const area = building.bruksarealM2 || 0;
  
  // Very small buildings (<20 m²) are likely garages/sheds
  if (area < 20) {
    return { isResidential: false, reason: "Too small (<20 m²)" };
  }
  
  // Buildings 20-40 m² could be either - need more context
  if (area >= 20 && area < 40) {
    // If it's a newer building on a property with older buildings, might be a garage
    // But could also be a small cabin or annex
    return { 
      isResidential: false, 
      reason: "Small building (20-40 m²) without type code - likely garage/shed" 
    };
  }
  
  // Buildings >40 m² without type code are more likely to be residential
  if (area >= 40) {
    return { 
      isResidential: true, 
      reason: `Large building (${area} m²) without type code - likely residential` 
    };
  }
  
  // Default: exclude if we can't determine
  return { isResidential: false, reason: "Unable to determine type" };
}

function mapInternalId(id: number): number {
  const mapping: Record<number, number> = {
    1: 111,   // Enebolig
    4: 121,   // Tomannsbolig
    26: 181,  // Garasje/uthus
    // ... other mappings
  };
  return mapping[id] || id;
}

// Test cases
const testBuildings = [
  { name: "Enebolig 180m²", bygningstypeKodeId: 111, bruksarealM2: 180 },
  { name: "Garage 25m²", bygningstypeKodeId: 181, bruksarealM2: 25 },
  { name: "Unknown 159m² (Kapellveien 156C)", bygningstypeKodeId: undefined, bruksarealM2: 159 },
  { name: "Unknown 35m²", bygningstypeKodeId: undefined, bruksarealM2: 35 },
  { name: "Unknown 15m²", bygningstypeKodeId: undefined, bruksarealM2: 15 },
  { name: "Tomannsbolig 279m²", bygningstypeKodeId: 4, bruksarealM2: 279 },
];

console.log("=== IMPROVED FILTERING LOGIC TEST ===\n");
console.log("Building                              │ Type │ Area  │ Residential? │ Reason");
console.log("─".repeat(100));

for (const building of testBuildings) {
  const result = isLikelyResidentialBuilding(building);
  console.log(
    `${building.name.padEnd(36)} │ ${String(building.bygningstypeKodeId || '-').padEnd(4)} │ ` +
    `${String(building.bruksarealM2).padEnd(5)} │ ` +
    `${result.isResidential ? '✅ YES' : '❌ NO '.padEnd(6)}      │ ` +
    result.reason
  );
}

console.log("\n💡 RECOMMENDATION:");
console.log("For buildings without type codes, use area-based heuristics:");
console.log("  - < 20 m²: Exclude (too small)");
console.log("  - 20-40 m²: Exclude with low confidence (might be small cabin)");
console.log("  - 40-100 m²: Include with medium confidence");
console.log("  - > 100 m²: Include with high confidence");
console.log("\nThis would correctly include the 159 m² Kapellveien 156C building.");
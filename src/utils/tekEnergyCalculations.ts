/**
 * TEK-baserte energiberegninger
 * Basert på oppdatert mapping:
 * - TEK7 = D
 * - TEK97 = mellom D og E
 * - TEK87 = E
 * - TEK69 = F
 * - TEK49 og eldre = F + 10%
 */

export type BuildingType = 'småhus' | 'blokk';

// Energikarakter grenser fra EnergyRatingEstimator
const energyThresholds = {
  småhus: {
    A: { base: 95, braTerm: 800 },   // 95 + 800/BRA
    B: { base: 120, braTerm: 1600 }, // 120 + 1600/BRA
    C: { base: 145, braTerm: 2500 }, // 145 + 2500/BRA
    D: { base: 175, braTerm: 4100 }, // 175 + 4100/BRA
    E: { base: 205, braTerm: 5800 }, // 205 + 5800/BRA
    F: { base: 250, braTerm: 8000 }, // 250 + 8000/BRA
  },
  blokk: {
    A: { base: 85, braTerm: 600 },   // 85 + 600/BRA
    B: { base: 95, braTerm: 1000 },  // 95 + 1000/BRA
    C: { base: 100, braTerm: 1500 }, // 100 + 1500/BRA
    D: { base: 135, braTerm: 2200 }, // 135 + 2200/BRA
    E: { base: 160, braTerm: 3000 }, // 160 + 3000/BRA
    F: { base: 200, braTerm: 4000 }, // 200 + 4000/BRA
  }
};

// TEK calculation function (samme som i EnergyRatingEstimator)
export function calculateTEK(byggeaar: number): string {
  const terskel = 2; // lag i år i forhold til tek

  // TEK years with threshold applied
  if (byggeaar >= 2017 + terskel) return "TEK17";     // 2019 and newer
  if (byggeaar >= 2010 + terskel) return "TEK10";     // 2012-2018
  if (byggeaar >= 2007 + terskel) return "TEK7";      // 2009-2011
  if (byggeaar >= 1997 + terskel) return "TEK97";     // 1999-2008
  if (byggeaar >= 1987 + terskel) return "TEK87";     // 1989-1998
  if (byggeaar >= 1969 + terskel) return "TEK69";     // 1971-1988
  if (byggeaar >= 1949 + terskel) return "TEK49";     // 1951-1970

  // Older than 1951
  return "eldre";
}

// Få energiintensitet basert på TEK
export function getEnergyIntensityFromTEK(tek: string, buildingType: BuildingType, bruksareal: number): number {
  let base: number;
  let braTerm: number;

  switch (tek) {
    case 'TEK17':
    case 'TEK10': {
      // TEK17/TEK10 = mellom C og D (nyere bygg, bedre isolert)
      const c = energyThresholds[buildingType].C;
      const d = energyThresholds[buildingType].D;
      base = Math.round((c.base + d.base) / 2);
      braTerm = Math.round((c.braTerm + d.braTerm) / 2);
      break;
    }

    case 'TEK7':
      // TEK7 = D
      base = energyThresholds[buildingType].D.base;
      braTerm = energyThresholds[buildingType].D.braTerm;
      break;

    case 'TEK97': {
      // TEK97 = mellom D og E
      const d = energyThresholds[buildingType].D;
      const e = energyThresholds[buildingType].E;
      base = Math.round((d.base + e.base) / 2);
      braTerm = Math.round((d.braTerm + e.braTerm) / 2);
      break;
    }

    case 'TEK87':
      // TEK87 = E
      base = energyThresholds[buildingType].E.base;
      braTerm = energyThresholds[buildingType].E.braTerm;
      break;

    case 'TEK69':
      // TEK69 = F
      base = energyThresholds[buildingType].F.base;
      braTerm = energyThresholds[buildingType].F.braTerm;
      break;

    case 'TEK49':
    case 'eldre': {
      // TEK49 og eldre = F + 10% (kun base-verdien, ikke BRA-leddet)
      const f = energyThresholds[buildingType].F;
      base = Math.round(f.base * 1.1);
      braTerm = f.braTerm; // Beholder samme BRA-ledd som F
      break;
    }

    default: {
      // Fallback til F-nivå
      const f = energyThresholds[buildingType].F;
      base = f.base;
      braTerm = f.braTerm;
      break;
    }
  }

  return base + braTerm / bruksareal;
}

// Beregn årlig energiforbruk basert på byggeår og bruksareal
export function calculateAnnualEnergyConsumption(
  byggeaar: number | string | undefined,
  bruksareal: number | string | undefined,
  buildingType: BuildingType
): number {
  // Konverter og valider input
  const yearNum = typeof byggeaar === 'string' ? parseInt(byggeaar) : byggeaar;
  const areaNum = typeof bruksareal === 'string' ? parseFloat(bruksareal) : bruksareal;
  
  // Hvis vi mangler data, returner default
  if (!yearNum || !areaNum || isNaN(yearNum) || isNaN(areaNum) || areaNum <= 0) {
    return 300000; // Default verdi
  }
  
  // Beregn TEK
  const tek = calculateTEK(yearNum);
  
  // Få energiintensitet
  const energyIntensity = getEnergyIntensityFromTEK(tek, buildingType, areaNum);
  
  // Beregn årlig forbruk og avrund til nærmeste 1000
  const consumption = energyIntensity * areaNum;
  return Math.round(consumption / 1000) * 1000;
}

// Bestem bygningstype basert på kode eller navn
export function determineBuildingType(
  buildingTypeCode?: string,
  buildingTypeName?: string
): BuildingType {
  // Sjekk først kode
  if (buildingTypeCode) {
    const code = buildingTypeCode.substring(0, 2);
    if (['11', '12', '13'].includes(code)) {
      return 'småhus';
    }
    if (['14', '15', '16', '17'].includes(code)) {
      return 'blokk';
    }
  }
  
  // Sjekk deretter navn
  if (buildingTypeName) {
    const nameLower = buildingTypeName.toLowerCase();
    if (nameLower.includes('enebolig') || 
        nameLower.includes('tomannsbolig') || 
        nameLower.includes('rekkehus') || 
        nameLower.includes('kjedehus')) {
      return 'småhus';
    }
    if (nameLower.includes('blokk') || 
        nameLower.includes('leilighet') || 
        nameLower.includes('boligbygg') ||
        nameLower === 'store boligbygg') {
      return 'blokk';
    }
  }
  
  // Default til småhus
  return 'småhus';
}

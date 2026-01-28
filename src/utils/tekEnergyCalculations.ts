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

// Energikarakter grenser - Ny skala gjeldende fra 1.1.2026 (NS 3031:2025)
const energyThresholds = {
  småhus: {
    A: { base: 85, braTerm: 800 },   // 85 + 800/BRA
    B: { base: 95, braTerm: 1600 },  // 95 + 1600/BRA
    C: { base: 155, braTerm: 2500 }, // 155 + 2500/BRA
    D: { base: 210, braTerm: 4100 }, // 210 + 4100/BRA
    E: { base: 265, braTerm: 5800 }, // 265 + 5800/BRA
    F: { base: 315, braTerm: 8000 }, // 315 + 8000/BRA
  },
  blokk: {
    A: { base: 80, braTerm: 600 },   // 80 + 600/BRA
    B: { base: 95, braTerm: 700 },   // 95 + 700/BRA
    C: { base: 140, braTerm: 900 },  // 140 + 900/BRA
    D: { base: 185, braTerm: 1100 }, // 185 + 1100/BRA
    E: { base: 230, braTerm: 1300 }, // 230 + 1300/BRA
    F: { base: 270, braTerm: 1500 }, // 270 + 1500/BRA
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

/**
 * Beregn energikarakter basert på energiintensitet og bruksareal.
 * NY skala (NS 3031:2025) - gjeldende fra 1.1.2026.
 *
 * VIKTIG: Dette er den sentrale funksjonen for energikarakterberegning.
 * Alle komponenter skal bruke denne funksjonen for konsistens.
 */
export function calculateEnergyRating(
  intensity: number,
  bruksareal: number,
  buildingType: BuildingType | null
): string {
  if (!bruksareal || !Number.isFinite(intensity) || bruksareal <= 0) {
    return 'G';
  }

  const thresholds = buildingType === 'småhus'
    ? energyThresholds.småhus
    : buildingType === 'blokk'
      ? energyThresholds.blokk
      : null;

  if (thresholds) {
    if (intensity <= thresholds.A.base + thresholds.A.braTerm / bruksareal) return 'A';
    if (intensity <= thresholds.B.base + thresholds.B.braTerm / bruksareal) return 'B';
    if (intensity <= thresholds.C.base + thresholds.C.braTerm / bruksareal) return 'C';
    if (intensity <= thresholds.D.base + thresholds.D.braTerm / bruksareal) return 'D';
    if (intensity <= thresholds.E.base + thresholds.E.braTerm / bruksareal) return 'E';
    if (intensity <= thresholds.F.base + thresholds.F.braTerm / bruksareal) return 'F';
    return 'G';
  }

  // Fallback: gjennomsnitt av småhus og blokk
  if (intensity <= 82.5 + 700 / bruksareal) return 'A';
  if (intensity <= 95 + 1150 / bruksareal) return 'B';
  if (intensity <= 147.5 + 1700 / bruksareal) return 'C';
  if (intensity <= 197.5 + 2600 / bruksareal) return 'D';
  if (intensity <= 247.5 + 3550 / bruksareal) return 'E';
  if (intensity <= 292.5 + 4750 / bruksareal) return 'F';
  return 'G';
}

/**
 * Beregn energikarakter basert på forbruk og bruksareal.
 * Wrapper-funksjon som beregner intensitet først.
 */
export function calculateEnergyRatingFromConsumption(
  yearlyConsumption: number,
  bruksareal: number,
  buildingType: BuildingType | null
): string {
  if (!bruksareal || bruksareal <= 0 || !yearlyConsumption || yearlyConsumption <= 0) {
    return 'G';
  }
  const intensity = yearlyConsumption / bruksareal;
  return calculateEnergyRating(intensity, bruksareal, buildingType);
}

/**
 * Wrapper for sammenligningsmodulen: estimer energikarakter direkte fra kWh/m².
 * Bruker den sentrale calculateEnergyRating med NS 3031:2025-skalaen.
 */
export function estimateEnergyGradeFromKwhPerM2(
  kwhPerM2: number,
  bruksareal: number,
  buildingType: BuildingType | null
): string {
  return calculateEnergyRating(kwhPerM2, bruksareal, buildingType);
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

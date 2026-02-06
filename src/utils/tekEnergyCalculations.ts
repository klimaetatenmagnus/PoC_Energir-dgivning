/**
 * TEK-baserte energiberegninger
 *
 * Oppdatert logikk (2024):
 * - Bruker faste kWh/m²-verdier fra Multiconsult-modell
 * - Energikarakter beregnes uten BRA-justeringsfaktor for mer konsistente estimater
 *
 * Datakilde: "Logikk og input til model.xlsx", fane "Energibehov før tiltak", rad 13
 */

export type BuildingType = 'småhus' | 'blokk';

/**
 * Faste energiintensitetsverdier (kWh/m²) fra Multiconsult-modellen.
 * Disse verdiene representerer typisk totalt energiforbruk før tiltak
 * for ulike TEK-perioder og bygningstyper.
 */
const ENERGY_INTENSITY_BY_TEK: Record<string, Record<BuildingType, number>> = {
  'TEK17': { småhus: 121.0, blokk: 104.0 },
  'TEK10': { småhus: 121.0, blokk: 104.0 },
  'TEK07': { småhus: 129.2, blokk: 112.5 },
  'TEK7':  { småhus: 129.2, blokk: 112.5 }, // Alias for TEK07
  'TEK97': { småhus: 166.7, blokk: 153.8 },
  'TEK87': { småhus: 201.0, blokk: 171.4 },
  'TEK69': { småhus: 240.2, blokk: 222.1 },
  'TEK49': { småhus: 264.2, blokk: 244.3 }, // TEK69 + 10%
  'eldre': { småhus: 264.2, blokk: 244.3 }, // TEK69 + 10%
};

/**
 * Energikarakter-grenser (kWh/m²) - flate verdier uten BRA-justering.
 * Basert på base-verdiene fra NS 3031:2025, men uten braTerm/BRA-leddet
 * for å gi mer konsistente estimater uavhengig av boligstørrelse.
 */
const ENERGY_RATING_THRESHOLDS = {
  småhus: { A: 85, B: 95, C: 155, D: 210, E: 265, F: 315 },
  blokk:  { A: 80, B: 95, C: 140, D: 185, E: 230, F: 270 }
};

/**
 * Beregn TEK-periode basert på byggeår.
 * Inkluderer 2 års terskel for å ta høyde for at bygg ofte
 * bygges etter forrige TEK-standard de første årene etter ny TEK.
 */
export function calculateTEK(byggeaar: number): string {
  const terskel = 2; // lag i år i forhold til tek

  if (byggeaar >= 2017 + terskel) return "TEK17";     // 2019 and newer
  if (byggeaar >= 2010 + terskel) return "TEK10";     // 2012-2018
  if (byggeaar >= 2007 + terskel) return "TEK7";      // 2009-2011
  if (byggeaar >= 1997 + terskel) return "TEK97";     // 1999-2008
  if (byggeaar >= 1987 + terskel) return "TEK87";     // 1989-1998
  if (byggeaar >= 1969 + terskel) return "TEK69";     // 1971-1988
  if (byggeaar >= 1949 + terskel) return "TEK49";     // 1951-1970

  return "eldre"; // Eldre enn 1951
}

/**
 * Hent energiintensitet (kWh/m²) basert på TEK-periode og bygningstype.
 * Bruker faste verdier fra Multiconsult-modellen.
 *
 * @param tek - TEK-periode (f.eks. "TEK69", "TEK87")
 * @param buildingType - Bygningstype ("småhus" eller "blokk")
 * @param _bruksareal - Bruksareal (ikke lenger brukt, beholdt for bakoverkompatibilitet)
 * @returns Energiintensitet i kWh/m²
 */
export function getEnergyIntensityFromTEK(
  tek: string,
  buildingType: BuildingType,
  _bruksareal?: number
): number {
  const tekData = ENERGY_INTENSITY_BY_TEK[tek];

  if (tekData) {
    return tekData[buildingType];
  }

  // Fallback til TEK69-verdier hvis ukjent TEK
  return ENERGY_INTENSITY_BY_TEK['TEK69'][buildingType];
}

/**
 * Beregn årlig energiforbruk basert på byggeår og bruksareal.
 * Formel: intensitet (kWh/m²) × bruksareal (m²)
 */
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

  // Få energiintensitet (fast verdi per TEK/bygningstype)
  const energyIntensity = getEnergyIntensityFromTEK(tek, buildingType);

  // Beregn årlig forbruk og avrund til nærmeste 1000
  const consumption = energyIntensity * areaNum;
  return Math.round(consumption / 1000) * 1000;
}

/**
 * Beregn energikarakter basert på energiintensitet.
 * Bruker flate terskelverdier uten BRA-justering for konsistente estimater.
 *
 * @param intensity - Energiintensitet i kWh/m²
 * @param _bruksareal - Bruksareal (ikke lenger brukt, beholdt for bakoverkompatibilitet)
 * @param buildingType - Bygningstype ("småhus", "blokk", eller null)
 * @returns Energikarakter (A-G)
 */
export function calculateEnergyRating(
  intensity: number,
  _bruksareal: number,
  buildingType: BuildingType | null
): string {
  if (!Number.isFinite(intensity)) {
    return 'G';
  }

  // Velg terskler basert på bygningstype
  const thresholds = buildingType === 'småhus'
    ? ENERGY_RATING_THRESHOLDS.småhus
    : buildingType === 'blokk'
      ? ENERGY_RATING_THRESHOLDS.blokk
      : null;

  if (thresholds) {
    if (intensity <= thresholds.A) return 'A';
    if (intensity <= thresholds.B) return 'B';
    if (intensity <= thresholds.C) return 'C';
    if (intensity <= thresholds.D) return 'D';
    if (intensity <= thresholds.E) return 'E';
    if (intensity <= thresholds.F) return 'F';
    return 'G';
  }

  // Fallback: gjennomsnitt av småhus og blokk
  if (intensity <= 82.5) return 'A';
  if (intensity <= 95) return 'B';
  if (intensity <= 147.5) return 'C';
  if (intensity <= 197.5) return 'D';
  if (intensity <= 247.5) return 'E';
  if (intensity <= 292.5) return 'F';
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
 */
export function estimateEnergyGradeFromKwhPerM2(
  kwhPerM2: number,
  bruksareal: number,
  buildingType: BuildingType | null
): string {
  return calculateEnergyRating(kwhPerM2, bruksareal, buildingType);
}

/**
 * Bestem bygningstype basert på bygningstypekode eller -navn.
 * Koder 11-13 = småhus, 14-17 = blokk.
 */
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

/**
 * Eksporter energiintensitetsverdiene for bruk i andre moduler.
 */
export const ENERGY_INTENSITY_VALUES = ENERGY_INTENSITY_BY_TEK;

/**
 * Eksporter energikarakter-grensene for bruk i andre moduler.
 */
export const ENERGY_RATING_THRESHOLD_VALUES = ENERGY_RATING_THRESHOLDS;

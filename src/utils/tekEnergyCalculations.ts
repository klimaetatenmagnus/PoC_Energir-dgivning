/**
 * TEK-baserte energiberegninger
 *
 * Oppdatert logikk (2024):
 * - Bruker faste kWh/m²-verdier fra Multiconsult-modell
 * - Energikarakter beregnes uten BRA-justeringsfaktor for mer konsistente estimater
 *
 * Datakilde: "Logikk og input til model.xlsx", fane "Energibehov før tiltak", rad 13
 */

import {
  normalizeTekPeriod,
  getTekPeriodForLookup,
  ENERGY_CONSUMPTION_DISTRIBUTIONS,
  type TekPeriodInput,
  type Boligtype,
} from './energySavingsData';

export type BuildingType = 'småhus' | 'blokk';

/**
 * Faste energiintensitetsverdier (kWh/m²) fra Multiconsult-modellen.
 * Disse verdiene representerer typisk totalt energiforbruk før tiltak
 * for ulike TEK-perioder og bygningstyper.
 */
const ENERGY_INTENSITY_BY_TEK: Record<string, Record<BuildingType, number>> = {
  'TEK17': { småhus: 115.55, blokk: 100.41 },
  'TEK10': { småhus: 115.55, blokk: 100.41 },
  'TEK07': { småhus: 122.93, blokk: 108.06 },
  'TEK7':  { småhus: 122.93, blokk: 108.06 }, // Alias for TEK07
  'TEK97': { småhus: 156.51, blokk: 144.99 },
  'TEK87': { småhus: 186.96, blokk: 160.21 },
  'TEK69': { småhus: 222.26, blokk: 206.06 },
  'TEK49': { småhus: 234.87, blokk: 225.4 },
  'eldre': { småhus: 335.86, blokk: 272.5 },
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
 *
 * Ugyldig eller manglende byggeår (0 eller under 1860) gir TEK49
 * som konservativ standard – de fleste eldre bygg i Oslo er fra
 * denne perioden og TEK49 gir rimelige estimater for tiltaksberegninger.
 */
export function calculateTEK(byggeaar: number): string {
  if (!byggeaar || byggeaar < 1860) return "TEK49";

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

  // Hvis vi mangler areal, returner default
  if (!areaNum || isNaN(areaNum) || areaNum <= 0) {
    return 300000; // Default verdi
  }

  // Beregn TEK – calculateTEK håndterer ugyldig/manglende byggeår (gir TEK49)
  const validYear = yearNum && !isNaN(yearNum) ? yearNum : 0;
  const tek = calculateTEK(validYear);

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
 * Beregn energikarakter med fjernvarme-justering.
 *
 * Fjernvarme-faktoren (0,45) reduserer romoppvarming- og tappevann-andelene
 * i energimerke-beregningen, mens elspesifikt forbruk forblir uendret.
 *
 * @param totalConsumptionKwh - Totalt årlig energiforbruk i kWh
 * @param bruksareal - Bruksareal i m²
 * @param buildingType - Bygningstype ('småhus' eller 'blokk')
 * @param tekPeriod - TEK-periode (fra calculateTEK eller brukerinput)
 * @param boligtype - Boligtype for oppslag i forbruksfordeling ('småhus' eller 'blokk')
 * @returns Energikarakter (A-G) med fjernvarme-justering
 */
export function calculateEnergyRatingWithFjernvarme(
  totalConsumptionKwh: number,
  bruksareal: number,
  buildingType: BuildingType | null,
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype
): string {
  if (!Number.isFinite(totalConsumptionKwh) || totalConsumptionKwh <= 0 || !bruksareal || bruksareal <= 0) {
    return 'G';
  }

  const normalizedTek = normalizeTekPeriod(tekPeriod);
  if (!normalizedTek) {
    // Fallback: beregn uten fjernvarme-justering
    const intensity = totalConsumptionKwh / bruksareal;
    return calculateEnergyRating(intensity, bruksareal, buildingType);
  }

  const lookupTek = getTekPeriodForLookup(normalizedTek);
  const distribution = ENERGY_CONSUMPTION_DISTRIBUTIONS[lookupTek]?.[boligtype];

  if (!distribution) {
    // Fallback: beregn uten fjernvarme-justering
    const intensity = totalConsumptionKwh / bruksareal;
    return calculateEnergyRating(intensity, bruksareal, buildingType);
  }

  const FJERNVARME_FACTOR = 0.45;

  // Beregn andeler av totalforbruk per energitype
  const totalDistribution = distribution.romoppvarming + distribution.tappevann + distribution.elspesifikt;
  const romAndel = distribution.romoppvarming / totalDistribution;
  const tapAndel = distribution.tappevann / totalDistribution;
  const elAndel = distribution.elspesifikt / totalDistribution;

  // Beregn justert forbruk: romoppvarming og tappevann multipliseres med 0,45
  const justert = totalConsumptionKwh * (
    romAndel * FJERNVARME_FACTOR +
    tapAndel * FJERNVARME_FACTOR +
    elAndel
  );

  const justeredIntensitet = justert / bruksareal;
  return calculateEnergyRating(justeredIntensitet, bruksareal, buildingType);
}

/**
 * Eksporter energiintensitetsverdiene for bruk i andre moduler.
 */
export const ENERGY_INTENSITY_VALUES = ENERGY_INTENSITY_BY_TEK;

/**
 * Eksporter energikarakter-grensene for bruk i andre moduler.
 */
export const ENERGY_RATING_THRESHOLD_VALUES = ENERGY_RATING_THRESHOLDS;

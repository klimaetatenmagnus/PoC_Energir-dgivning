/**
 * Testscript: Sammenligner ny vs. gammel energiberegningslogikk
 *
 * NY LOGIKK:
 * - Bruker faste kWh/m²-verdier fra Excel (Multiconsult-data)
 * - Energikarakter beregnes uten BRA-justeringsfaktor
 *
 * GAMMEL LOGIKK:
 * - Bruker formel: base + braTerm/BRA
 * - Energikarakter med BRA-justeringsfaktor
 */

import {
  calculateTEK,
  getEnergyIntensityFromTEK,
  calculateAnnualEnergyConsumption,
  calculateEnergyRating,
  determineBuildingType,
  type BuildingType
} from '../src/utils/tekEnergyCalculations';

// ============================================
// NY LOGIKK: Faste kWh/m²-verdier fra Excel
// ============================================

const EXCEL_ENERGY_INTENSITY: Record<string, Record<BuildingType, number>> = {
  'TEK69': { småhus: 222.26, blokk: 206.06 },
  'TEK87': { småhus: 186.96, blokk: 160.21 },
  'TEK97': { småhus: 156.51, blokk: 144.99 },
  'TEK07': { småhus: 122.93, blokk: 108.06 },
  'TEK10': { småhus: 115.55, blokk: 100.41 },
  'TEK17': { småhus: 115.55, blokk: 100.41 },
  'TEK49': { småhus: 234.87, blokk: 225.4 },
  'eldre': { småhus: 335.86, blokk: 272.5 },
};

// Nye energikarakter-grenser UTEN BRA-justeringsfaktor
// Basert på gjennomsnitt av base-verdiene fra NS 3031:2025
const FLAT_ENERGY_THRESHOLDS = {
  småhus: { A: 85, B: 95, C: 155, D: 210, E: 265, F: 315 },
  blokk: { A: 80, B: 95, C: 140, D: 185, E: 230, F: 270 }
};

function mapTekToExcelKey(tek: string): string {
  // TEK7 mappes til TEK07
  if (tek === 'TEK7') return 'TEK07';
  return tek;
}

function getNewEnergyIntensity(tek: string, buildingType: BuildingType): number {
  const excelKey = mapTekToExcelKey(tek);
  const data = EXCEL_ENERGY_INTENSITY[excelKey];
  if (data) {
    return data[buildingType];
  }
  // Fallback til TEK69 hvis ukjent
  return EXCEL_ENERGY_INTENSITY['TEK69'][buildingType];
}

function calculateNewAnnualConsumption(
  byggeaar: number,
  bruksareal: number,
  buildingType: BuildingType
): number {
  const tek = calculateTEK(byggeaar);
  const intensity = getNewEnergyIntensity(tek, buildingType);
  const consumption = intensity * bruksareal;
  return Math.round(consumption / 1000) * 1000;
}

function calculateNewEnergyRating(
  intensity: number,
  buildingType: BuildingType
): string {
  const thresholds = FLAT_ENERGY_THRESHOLDS[buildingType];

  if (intensity <= thresholds.A) return 'A';
  if (intensity <= thresholds.B) return 'B';
  if (intensity <= thresholds.C) return 'C';
  if (intensity <= thresholds.D) return 'D';
  if (intensity <= thresholds.E) return 'E';
  if (intensity <= thresholds.F) return 'F';
  return 'G';
}

// ============================================
// TESTDATA: Noen typiske boliger
// ============================================

interface TestCase {
  name: string;
  byggeaar: number;
  bruksareal: number;
  buildingTypeCode?: string;
  buildingTypeName: string;
}

const testCases: TestCase[] = [
  // Småhus - ulike størrelser og aldre
  { name: 'Liten enebolig (60m², 1960)', byggeaar: 1960, bruksareal: 60, buildingTypeName: 'Enebolig' },
  { name: 'Middels enebolig (120m², 1980)', byggeaar: 1980, bruksareal: 120, buildingTypeName: 'Enebolig' },
  { name: 'Stor enebolig (200m², 1995)', byggeaar: 1995, bruksareal: 200, buildingTypeName: 'Enebolig' },
  { name: 'Ny enebolig (150m², 2015)', byggeaar: 2015, bruksareal: 150, buildingTypeName: 'Enebolig' },
  { name: 'Rekkehus (100m², 2000)', byggeaar: 2000, bruksareal: 100, buildingTypeName: 'Rekkehus' },

  // Blokk - ulike størrelser og aldre
  { name: 'Liten leilighet (40m², 1965)', byggeaar: 1965, bruksareal: 40, buildingTypeName: 'Leilighet i blokk' },
  { name: 'Middels leilighet (70m², 1985)', byggeaar: 1985, bruksareal: 70, buildingTypeName: 'Leilighet i blokk' },
  { name: 'Stor leilighet (100m², 2005)', byggeaar: 2005, bruksareal: 100, buildingTypeName: 'Leilighet i blokk' },
  { name: 'Ny leilighet (80m², 2020)', byggeaar: 2020, bruksareal: 80, buildingTypeName: 'Leilighet i blokk' },

  // Ekstreme tilfeller
  { name: 'Veldig liten leilighet (25m², 1970)', byggeaar: 1970, bruksareal: 25, buildingTypeName: 'Leilighet i blokk' },
  { name: 'Veldig gammel enebolig (100m², 1920)', byggeaar: 1920, bruksareal: 100, buildingTypeName: 'Enebolig' },
];

// ============================================
// KJØR TESTER
// ============================================

console.log('═'.repeat(120));
console.log('SAMMENLIGNING: Ny vs. Gammel Energiberegningslogikk');
console.log('═'.repeat(120));
console.log('');
console.log('NY LOGIKK: Faste kWh/m²-verdier fra Multiconsult, energikarakter uten BRA-justering');
console.log('GAMMEL LOGIKK: Formel (base + braTerm/BRA), energikarakter med BRA-justering');
console.log('');

console.log('─'.repeat(120));
console.log(
  'Bolig'.padEnd(40) +
  'TEK'.padEnd(8) +
  'Type'.padEnd(10) +
  'Intensitet (ny/gml)'.padEnd(22) +
  'Forbruk kWh/år (ny/gml)'.padEnd(26) +
  'Karakter (ny/gml)'.padEnd(18)
);
console.log('─'.repeat(120));

for (const test of testCases) {
  const buildingType = determineBuildingType(test.buildingTypeCode, test.buildingTypeName);
  const tek = calculateTEK(test.byggeaar);

  // GAMMEL LOGIKK
  const oldIntensity = getEnergyIntensityFromTEK(tek, buildingType, test.bruksareal);
  const oldConsumption = calculateAnnualEnergyConsumption(test.byggeaar, test.bruksareal, buildingType);
  const oldRating = calculateEnergyRating(oldIntensity, test.bruksareal, buildingType);

  // NY LOGIKK
  const newIntensity = getNewEnergyIntensity(tek, buildingType);
  const newConsumption = calculateNewAnnualConsumption(test.byggeaar, test.bruksareal, buildingType);
  const newRating = calculateNewEnergyRating(newIntensity, buildingType);

  // Beregn differanser
  const intensityDiff = newIntensity - oldIntensity;
  const consumptionDiff = newConsumption - oldConsumption;

  const intensityStr = `${newIntensity.toFixed(0)}/${oldIntensity.toFixed(0)} (${intensityDiff > 0 ? '+' : ''}${intensityDiff.toFixed(0)})`;
  const consumptionStr = `${(newConsumption/1000).toFixed(0)}k/${(oldConsumption/1000).toFixed(0)}k (${consumptionDiff > 0 ? '+' : ''}${(consumptionDiff/1000).toFixed(0)}k)`;
  const ratingStr = `${newRating}/${oldRating}${newRating !== oldRating ? ' *' : ''}`;

  console.log(
    test.name.padEnd(40) +
    tek.padEnd(8) +
    buildingType.padEnd(10) +
    intensityStr.padEnd(22) +
    consumptionStr.padEnd(26) +
    ratingStr.padEnd(18)
  );
}

console.log('─'.repeat(120));
console.log('');
console.log('* = Energikarakter endret mellom ny og gammel logikk');
console.log('');

// ============================================
// DETALJERT ANALYSE
// ============================================

console.log('═'.repeat(120));
console.log('DETALJERT ANALYSE: Effekt av BRA-justeringsfaktor på små vs. store boliger');
console.log('═'.repeat(120));
console.log('');

const analysisAreas = [25, 40, 60, 80, 100, 120, 150, 200];
const analysisYear = 1980; // TEK87

console.log(`Byggeår: ${analysisYear} (${calculateTEK(analysisYear)})`);
console.log('');

for (const buildingType of ['småhus', 'blokk'] as BuildingType[]) {
  console.log(`\n${buildingType.toUpperCase()}:`);
  console.log('─'.repeat(80));
  console.log(
    'BRA (m²)'.padEnd(12) +
    'Ny intensitet'.padEnd(16) +
    'Gammel intensitet'.padEnd(20) +
    'Differanse'.padEnd(14) +
    'Ny karakter'.padEnd(14) +
    'Gammel karakter'
  );
  console.log('─'.repeat(80));

  const tek = calculateTEK(analysisYear);
  const newIntensity = getNewEnergyIntensity(tek, buildingType);

  for (const area of analysisAreas) {
    const oldIntensity = getEnergyIntensityFromTEK(tek, buildingType, area);
    const diff = oldIntensity - newIntensity;
    const newRating = calculateNewEnergyRating(newIntensity, buildingType);
    const oldRating = calculateEnergyRating(oldIntensity, area, buildingType);

    console.log(
      `${area}`.padEnd(12) +
      `${newIntensity.toFixed(1)} kWh/m²`.padEnd(16) +
      `${oldIntensity.toFixed(1)} kWh/m²`.padEnd(20) +
      `+${diff.toFixed(1)} kWh/m²`.padEnd(14) +
      newRating.padEnd(14) +
      oldRating
    );
  }
}

console.log('');
console.log('═'.repeat(120));
console.log('KONKLUSJON:');
console.log('─'.repeat(120));
console.log('Den gamle logikken legger til en BRA-avhengig faktor som øker intensiteten');
console.log('betydelig for små boliger. F.eks. for en 25m² leilighet kan forskjellen være');
console.log('over 50 kWh/m², som gir mye høyere estimert forbruk.');
console.log('');
console.log('Den nye logikken bruker faste kWh/m²-verdier fra Multiconsult, som gir');
console.log('mer konsistente estimater uavhengig av boligstørrelse.');
console.log('═'.repeat(120));

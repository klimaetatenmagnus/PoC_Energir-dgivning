/**
 * Test ny energiberegning mot virkelige adresser med faktiske energiattester
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
  'TEK69': { småhus: 240.2, blokk: 222.1 },
  'TEK87': { småhus: 201.0, blokk: 171.4 },
  'TEK97': { småhus: 166.7, blokk: 153.8 },
  'TEK07': { småhus: 129.2, blokk: 112.5 },
  'TEK10': { småhus: 121.0, blokk: 104.0 },
  'TEK17': { småhus: 121.0, blokk: 104.0 },
  'TEK49': { småhus: 264.2, blokk: 244.3 },
  'eldre': { småhus: 264.2, blokk: 244.3 },
};

const FLAT_ENERGY_THRESHOLDS = {
  småhus: { A: 85, B: 95, C: 155, D: 210, E: 265, F: 315 },
  blokk: { A: 80, B: 95, C: 140, D: 185, E: 230, F: 270 }
};

function mapTekToExcelKey(tek: string): string {
  if (tek === 'TEK7') return 'TEK07';
  return tek;
}

function getNewEnergyIntensity(tek: string, buildingType: BuildingType): number {
  const excelKey = mapTekToExcelKey(tek);
  return EXCEL_ENERGY_INTENSITY[excelKey]?.[buildingType] ?? EXCEL_ENERGY_INTENSITY['TEK69'][buildingType];
}

function calculateNewAnnualConsumption(byggeaar: number, bruksareal: number, buildingType: BuildingType): number {
  const tek = calculateTEK(byggeaar);
  const intensity = getNewEnergyIntensity(tek, buildingType);
  return Math.round((intensity * bruksareal) / 1000) * 1000;
}

function calculateNewEnergyRating(intensity: number, buildingType: BuildingType): string {
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
// VIRKELIGE TESTDATA FRA ENERGIATTESTER
// ============================================

interface RealTestCase {
  adresse: string;
  byggeaar: number;
  bruksareal: number;
  bygningstype: string;
  bygningstypeKode: string;
  faktiskKarakter: string;
  faktiskForbruk: number; // kWh/år fra energiattest
}

const realTestCases: RealTestCase[] = [
  {
    adresse: 'Lyseveien 3, 0362 OSLO',
    byggeaar: 1984,
    bruksareal: 150,
    bygningstype: 'Enebolig',
    bygningstypeKode: '111',
    faktiskKarakter: 'E',
    faktiskForbruk: 25000
  },
  {
    adresse: 'Thereses gate 11A, 0358 OSLO',
    byggeaar: 1895,
    bruksareal: 85,
    bygningstype: 'Blokkleilighet',
    bygningstypeKode: '143',
    faktiskKarakter: 'F',
    faktiskForbruk: 18500
  },
  {
    adresse: 'Thereses gate 44A, 0168 OSLO',
    byggeaar: 1902,
    bruksareal: 3200,
    bygningstype: 'Bygård',
    bygningstypeKode: '142',
    faktiskKarakter: 'G',
    faktiskForbruk: 480000
  }
];

// ============================================
// KJØR TESTER
// ============================================

console.log('═'.repeat(130));
console.log('TEST MOT VIRKELIGE ADRESSER MED FAKTISKE ENERGIATTESTER');
console.log('═'.repeat(130));
console.log('');

console.log('─'.repeat(130));
console.log(
  'Adresse'.padEnd(35) +
  'År'.padEnd(6) +
  'BRA'.padEnd(8) +
  'Type'.padEnd(10) +
  'TEK'.padEnd(8) +
  'FAKTISK'.padEnd(12) +
  'NY'.padEnd(12) +
  'GAMMEL'.padEnd(12) +
  'Treff?'
);
console.log('─'.repeat(130));

for (const test of realTestCases) {
  const buildingType = determineBuildingType(test.bygningstypeKode, test.bygningstype);
  const tek = calculateTEK(test.byggeaar);

  // Faktisk intensitet fra energiattest
  const faktiskIntensitet = test.faktiskForbruk / test.bruksareal;

  // GAMMEL LOGIKK
  const oldIntensity = getEnergyIntensityFromTEK(tek, buildingType, test.bruksareal);
  const oldConsumption = calculateAnnualEnergyConsumption(test.byggeaar, test.bruksareal, buildingType);
  const oldRating = calculateEnergyRating(oldIntensity, test.bruksareal, buildingType);

  // NY LOGIKK
  const newIntensity = getNewEnergyIntensity(tek, buildingType);
  const newConsumption = calculateNewAnnualConsumption(test.byggeaar, test.bruksareal, buildingType);
  const newRating = calculateNewEnergyRating(newIntensity, buildingType);

  const newMatch = newRating === test.faktiskKarakter ? '✓' : (Math.abs(newRating.charCodeAt(0) - test.faktiskKarakter.charCodeAt(0)) === 1 ? '~' : '✗');
  const oldMatch = oldRating === test.faktiskKarakter ? '✓' : (Math.abs(oldRating.charCodeAt(0) - test.faktiskKarakter.charCodeAt(0)) === 1 ? '~' : '✗');

  console.log(
    test.adresse.substring(0, 33).padEnd(35) +
    `${test.byggeaar}`.padEnd(6) +
    `${test.bruksareal}m²`.padEnd(8) +
    buildingType.padEnd(10) +
    tek.padEnd(8) +
    `${test.faktiskKarakter}`.padEnd(12) +
    `${newRating} ${newMatch}`.padEnd(12) +
    `${oldRating} ${oldMatch}`.padEnd(12) +
    `ny=${newMatch} gml=${oldMatch}`
  );
}

console.log('─'.repeat(130));
console.log('✓ = Eksakt treff | ~ = 1 karakter avvik | ✗ = 2+ karakterer avvik');
console.log('');

// ============================================
// DETALJERT SAMMENLIGNING
// ============================================

console.log('═'.repeat(130));
console.log('DETALJERT SAMMENLIGNING');
console.log('═'.repeat(130));

for (const test of realTestCases) {
  const buildingType = determineBuildingType(test.bygningstypeKode, test.bygningstype);
  const tek = calculateTEK(test.byggeaar);

  const faktiskIntensitet = test.faktiskForbruk / test.bruksareal;
  const oldIntensity = getEnergyIntensityFromTEK(tek, buildingType, test.bruksareal);
  const oldConsumption = calculateAnnualEnergyConsumption(test.byggeaar, test.bruksareal, buildingType);
  const oldRating = calculateEnergyRating(oldIntensity, test.bruksareal, buildingType);
  const newIntensity = getNewEnergyIntensity(tek, buildingType);
  const newConsumption = calculateNewAnnualConsumption(test.byggeaar, test.bruksareal, buildingType);
  const newRating = calculateNewEnergyRating(newIntensity, buildingType);

  console.log('');
  console.log(`📍 ${test.adresse}`);
  console.log(`   Byggeår: ${test.byggeaar} | BRA: ${test.bruksareal}m² | Type: ${buildingType} | TEK: ${tek}`);
  console.log('');
  console.log('   │ Metrikk                │ Faktisk      │ Ny logikk    │ Gammel logikk │');
  console.log('   ├────────────────────────┼──────────────┼──────────────┼───────────────┤');
  console.log(`   │ Intensitet (kWh/m²)    │ ${faktiskIntensitet.toFixed(1).padStart(12)} │ ${newIntensity.toFixed(1).padStart(12)} │ ${oldIntensity.toFixed(1).padStart(13)} │`);
  console.log(`   │ Årlig forbruk (kWh)    │ ${test.faktiskForbruk.toLocaleString().padStart(12)} │ ${newConsumption.toLocaleString().padStart(12)} │ ${oldConsumption.toLocaleString().padStart(13)} │`);
  console.log(`   │ Energikarakter         │ ${test.faktiskKarakter.padStart(12)} │ ${newRating.padStart(12)} │ ${oldRating.padStart(13)} │`);
  console.log('   └────────────────────────┴──────────────┴──────────────┴───────────────┘');

  // Avvik
  const newIntensityDiff = newIntensity - faktiskIntensitet;
  const oldIntensityDiff = oldIntensity - faktiskIntensitet;
  const newConsumptionDiff = newConsumption - test.faktiskForbruk;
  const oldConsumptionDiff = oldConsumption - test.faktiskForbruk;

  console.log('');
  console.log(`   Avvik fra faktisk:`);
  console.log(`   - Ny logikk:    intensitet ${newIntensityDiff > 0 ? '+' : ''}${newIntensityDiff.toFixed(1)} kWh/m² | forbruk ${newConsumptionDiff > 0 ? '+' : ''}${newConsumptionDiff.toLocaleString()} kWh/år`);
  console.log(`   - Gammel logikk: intensitet ${oldIntensityDiff > 0 ? '+' : ''}${oldIntensityDiff.toFixed(1)} kWh/m² | forbruk ${oldConsumptionDiff > 0 ? '+' : ''}${oldConsumptionDiff.toLocaleString()} kWh/år`);
}

console.log('');
console.log('═'.repeat(130));
console.log('OPPSUMMERING');
console.log('═'.repeat(130));

let newCorrect = 0;
let newClose = 0;
let oldCorrect = 0;
let oldClose = 0;

for (const test of realTestCases) {
  const buildingType = determineBuildingType(test.bygningstypeKode, test.bygningstype);
  const tek = calculateTEK(test.byggeaar);
  const oldIntensity = getEnergyIntensityFromTEK(tek, buildingType, test.bruksareal);
  const oldRating = calculateEnergyRating(oldIntensity, test.bruksareal, buildingType);
  const newIntensity = getNewEnergyIntensity(tek, buildingType);
  const newRating = calculateNewEnergyRating(newIntensity, buildingType);

  if (newRating === test.faktiskKarakter) newCorrect++;
  else if (Math.abs(newRating.charCodeAt(0) - test.faktiskKarakter.charCodeAt(0)) === 1) newClose++;

  if (oldRating === test.faktiskKarakter) oldCorrect++;
  else if (Math.abs(oldRating.charCodeAt(0) - test.faktiskKarakter.charCodeAt(0)) === 1) oldClose++;
}

console.log('');
console.log(`Ny logikk:     ${newCorrect}/${realTestCases.length} eksakte treff, ${newClose}/${realTestCases.length} innen 1 karakter`);
console.log(`Gammel logikk: ${oldCorrect}/${realTestCases.length} eksakte treff, ${oldClose}/${realTestCases.length} innen 1 karakter`);
console.log('');

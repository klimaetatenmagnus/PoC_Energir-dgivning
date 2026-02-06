/**
 * Test: Brinken 23A og proporsjonalitet ved BRA-endring
 */

import {
  calculateTEK,
  getEnergyIntensityFromTEK,
  calculateAnnualEnergyConsumption,
  calculateEnergyRating,
  determineBuildingType,
} from '../src/utils/tekEnergyCalculations';

// Brinken 23A: byggeår 1860, BRA 186m², bygningstypekode 13 (rekkehus/småhus)
console.log('═'.repeat(80));
console.log('TEST: Brinken 23A');
console.log('═'.repeat(80));

const byggeaar = 1860;
const bruksareal = 186;
const buildingType = determineBuildingType('13', 'Rekkehus, kjedehus, andre småhus');
const tek = calculateTEK(byggeaar);
const intensity = getEnergyIntensityFromTEK(tek, buildingType);
const consumption = calculateAnnualEnergyConsumption(byggeaar, bruksareal, buildingType);
const rating = calculateEnergyRating(intensity, bruksareal, buildingType);

console.log(`Byggeår: ${byggeaar}`);
console.log(`BRA: ${bruksareal} m²`);
console.log(`Bygningstype: ${buildingType}`);
console.log(`TEK: ${tek}`);
console.log(`Intensitet: ${intensity} kWh/m²`);
console.log(`Estimert forbruk: ${consumption.toLocaleString()} kWh/år`);
console.log(`Intensitet etter avrunding: ${(consumption / bruksareal).toFixed(1)} kWh/m²`);
console.log(`Energikarakter: ${rating}`);

// Sjekk at det er 240.2 og ikke 264.2
console.log('');
if (intensity === 240.2) {
  console.log('✓ KORREKT: Intensiteten er 240.2 kWh/m² (TEK69-verdi)');
} else {
  console.log(`✗ FEIL: Intensiteten er ${intensity} kWh/m², forventet 240.2`);
}

// Test proporsjonalitet: Endring av BRA
console.log('');
console.log('═'.repeat(80));
console.log('TEST: Proporsjonalitet ved BRA-endring');
console.log('═'.repeat(80));
console.log('');

const areas = [50, 80, 100, 120, 150, 186, 200, 250, 300];

console.log('BRA (m²)'.padEnd(12) +
  'Intensitet'.padEnd(14) +
  'Forbruk (kWh)'.padEnd(18) +
  'Forbruk/BRA'.padEnd(14) +
  'Karakter'.padEnd(10) +
  'Proporsjonalitet'
);
console.log('─'.repeat(80));

const baseForbrukPerM2 = intensity; // 240.2

for (const area of areas) {
  const forbruk = calculateAnnualEnergyConsumption(byggeaar, area, buildingType);
  const faktiskPerM2 = forbruk / area;
  const avvik = Math.abs(faktiskPerM2 - baseForbrukPerM2);
  const isProportional = avvik < 10; // Innenfor 10 kWh/m² pga. avrunding

  const areaIntensity = getEnergyIntensityFromTEK(tek, buildingType);
  const areaRating = calculateEnergyRating(areaIntensity, area, buildingType);

  console.log(
    `${area}`.padEnd(12) +
    `${areaIntensity.toFixed(1)}`.padEnd(14) +
    `${forbruk.toLocaleString()}`.padEnd(18) +
    `${faktiskPerM2.toFixed(1)}`.padEnd(14) +
    `${areaRating}`.padEnd(10) +
    `${isProportional ? '✓' : '✗'} (avvik: ${avvik.toFixed(1)} kWh/m²)`
  );
}

console.log('');
console.log('Intensiteten er nå FAST (240.2 kWh/m²) uavhengig av BRA.');
console.log('Forbruk = 240.2 × BRA, avrundet til nærmeste 1000.');
console.log('Karakter er samme for alle BRA-verdier fordi intensiteten er lik.');

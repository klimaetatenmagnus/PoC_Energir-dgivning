/**
 * Testscript for å verifisere Enova bulk-data oppslag
 * Kjør med: npx tsx scripts/test-enova-lookup.ts
 */

import { lookupBuildingFromEnovaData, getBuildingIndex } from '../src/services/districtStatisticsService.ts';

async function test() {
  console.log('🧪 Tester Enova bulk-data oppslag...\n');

  // Last indeksen først
  const index = await getBuildingIndex();
  const buildingCount = index ? Object.keys(index.buildings).length : 0;
  console.log(`📦 Indeks lastet: ${index ? buildingCount + ' boliger' : 'FEILET'}\n`);

  // Test 1: Oppslag med matrikkel (gnr-bnr-snr)
  console.log('Test 1: Oppslag med matrikkel 180-581-0 (Marta Steinsviks vei 73)');
  const result1 = await lookupBuildingFromEnovaData(undefined, '180', '581', '0');
  console.log('  Forventet: kwhPerM2=195.2, energikarakter=E, byggeaar=2007');
  console.log('  Resultat:', result1 ? `kwhPerM2=${result1.kwhPerM2}, energikarakter=${result1.energikarakter}, byggeaar=${result1.byggeaar}` : 'IKKE FUNNET');
  console.log('  Status:', result1?.kwhPerM2 === 195.2 ? '✅ OK' : '❌ FEIL');

  // Test 2: Oppslag med bygningsnummer
  console.log('\nTest 2: Oppslag med bygningsnummer 80261640 (Høybråtenveien 78B)');
  const result2 = await lookupBuildingFromEnovaData('80261640');
  console.log('  Forventet: kwhPerM2≈238.8, energikarakter=E');
  console.log('  Resultat:', result2 ? `kwhPerM2=${result2.kwhPerM2}, energikarakter=${result2.energikarakter}, bydel=${result2.bydel}` : 'IKKE FUNNET');
  console.log('  Status:', result2 ? '✅ OK' : '❌ FEIL');

  // Test 3: Oppslag som ikke finnes
  console.log('\nTest 3: Oppslag som ikke finnes (gnr=999, bnr=999)');
  const result3 = await lookupBuildingFromEnovaData(undefined, '999', '999', '0');
  console.log('  Forventet: null (ikke funnet)');
  console.log('  Resultat:', result3 === null ? 'null' : 'FUNNET (uventet)');
  console.log('  Status:', result3 === null ? '✅ OK' : '❌ FEIL');

  // Test 4: Oppslag med matrikkel 107-617-0 (Høybråtenveien 78B alternativ)
  console.log('\nTest 4: Oppslag med matrikkel 107-617-0');
  const result4 = await lookupBuildingFromEnovaData(undefined, '107', '617', '0');
  console.log('  Resultat:', result4 ? `kwhPerM2=${result4.kwhPerM2}, energikarakter=${result4.energikarakter}` : 'IKKE FUNNET');
  console.log('  Status:', result4 ? '✅ OK' : '⚠️ Ikke funnet via matrikkel');

  // Sammendrag
  console.log('\n' + '='.repeat(60));
  console.log('📊 SAMMENDRAG');
  console.log('='.repeat(60));
  console.log(`Indeks inneholder ${buildingCount.toLocaleString()} boliger`);
  console.log(`Oppslag med matrikkel: ${result1 ? 'Fungerer' : 'FEIL'}`);
  console.log(`Oppslag med bygningsnummer: ${result2 ? 'Fungerer' : 'FEIL'}`);
  console.log(`Fallback ved manglende data: ${result3 === null ? 'Fungerer' : 'FEIL'}`);

  console.log('\n🏁 Tester fullført');
}

test().catch(console.error);

import { resolveBuildingData } from '../services/building-info-service';
import { getAllTestAddresses, getExpectedBuildingNumber } from '../src/data/residential-building-cache';

const LIVE = process.env.LIVE === '1';

interface ComparisonResult {
  address: string;
  expectedBuildingNumber: string;
  standardBuildingNumber: string | null;
  improvedBuildingNumber: string | null;
  standardMatch: boolean;
  improvedMatch: boolean;
  improvement: 'better' | 'worse' | 'same';
  error?: string;
}

async function compareSelectionMethods() {
  if (!LIVE) {
    console.log('Running in mock mode. Set LIVE=1 to use real API.');
    return;
  }

  console.log('=== COMPARING STANDARD vs IMPROVED BUILDING SELECTION ===\n');

  // Test a subset of addresses that had mismatches
  const testAddresses = [
    "Dammanns vei 13",
    "Bygdøy terrasse 16", 
    "Strømsborgveien 55B",
    "Christian Benneches vei 4C",
    "Bygdøylund 2",
    "Bygdøylund 9",
    "Museumsveien 7B",
    "Hengsengveien 1",
    "Huk aveny 12A",
    "Strømsborgveien 27"
  ];

  const results: ComparisonResult[] = [];
  let processed = 0;

  for (const address of testAddresses) {
    processed++;
    const expectedBuildingNumber = getExpectedBuildingNumber(address);
    if (!expectedBuildingNumber) continue;

    console.log(`[${processed}/${testAddresses.length}] Testing: ${address}`);
    console.log(`  Expected: ${expectedBuildingNumber}`);

    const fullAddress = `${address}, Oslo`;
    let standardResult: string | null = null;
    let improvedResult: string | null = null;

    try {
      // Test with standard selection
      console.log(`  Testing STANDARD selection...`);
      const standard = await resolveBuildingData(fullAddress, { useImprovedSelection: false });
      standardResult = standard.bygningsnummer || null;
      console.log(`    Result: ${standardResult}`);

      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 500));

      // Test with improved selection
      console.log(`  Testing IMPROVED selection...`);
      const improved = await resolveBuildingData(fullAddress, { useImprovedSelection: true, debug: true });
      improvedResult = improved.bygningsnummer || null;
      console.log(`    Result: ${improvedResult}`);

    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Analyze results
    const standardMatch = standardResult === expectedBuildingNumber;
    const improvedMatch = improvedResult === expectedBuildingNumber;
    
    let improvement: ComparisonResult['improvement'] = 'same';
    if (!standardMatch && improvedMatch) {
      improvement = 'better';
    } else if (standardMatch && !improvedMatch) {
      improvement = 'worse';
    }

    results.push({
      address,
      expectedBuildingNumber,
      standardBuildingNumber: standardResult,
      improvedBuildingNumber: improvedResult,
      standardMatch,
      improvedMatch,
      improvement
    });

    console.log(`  Standard: ${standardMatch ? '✅' : '❌'} | Improved: ${improvedMatch ? '✅' : '❌'} | ${improvement.toUpperCase()}\n`);

    // Delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  const improvements = results.filter(r => r.improvement === 'better').length;
  const regressions = results.filter(r => r.improvement === 'worse').length;
  const same = results.filter(r => r.improvement === 'same').length;

  console.log(`Total addresses tested: ${processed}`);
  console.log(`Improvements: ${improvements}`);
  console.log(`Regressions: ${regressions}`);
  console.log(`No change: ${same}`);

  // Detailed breakdown
  const improvedAddresses = results.filter(r => r.improvement === 'better');
  if (improvedAddresses.length > 0) {
    console.log('\n=== IMPROVEMENTS ===');
    improvedAddresses.forEach(r => {
      console.log(`✅ ${r.address}:`);
      console.log(`   Expected: ${r.expectedBuildingNumber}`);
      console.log(`   Standard: ${r.standardBuildingNumber} ❌`);
      console.log(`   Improved: ${r.improvedBuildingNumber} ✅`);
    });
  }

  const regressedAddresses = results.filter(r => r.improvement === 'worse');
  if (regressedAddresses.length > 0) {
    console.log('\n=== REGRESSIONS ===');
    regressedAddresses.forEach(r => {
      console.log(`❌ ${r.address}:`);
      console.log(`   Expected: ${r.expectedBuildingNumber}`);
      console.log(`   Standard: ${r.standardBuildingNumber} ✅`);
      console.log(`   Improved: ${r.improvedBuildingNumber} ❌`);
    });
  }

  // Match rates
  const standardMatches = results.filter(r => r.standardMatch).length;
  const improvedMatches = results.filter(r => r.improvedMatch).length;
  
  console.log('\n=== MATCH RATES ===');
  console.log(`Standard selection: ${standardMatches}/${processed} (${(standardMatches/processed*100).toFixed(1)}%)`);
  console.log(`Improved selection: ${improvedMatches}/${processed} (${(improvedMatches/processed*100).toFixed(1)}%)`);
  console.log(`Improvement: ${((improvedMatches - standardMatches)/processed*100).toFixed(1)} percentage points`);
}

// Run the comparison
compareSelectionMethods().catch(console.error);
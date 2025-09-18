import { resolveBuildingData } from '../services/building-info-service';
import { getAllTestAddresses, getExpectedBuildingNumber } from '../src/data/residential-building-cache';
import fs from 'fs';
import path from 'path';

const LIVE = process.env.LIVE === '1';

interface TestResult {
  address: string;
  expectedBuildingNumber: string;
  actualBuildingNumber: string | null;
  match: boolean;
  improvement: 'better' | 'worse' | 'same' | 'new_match';
  error?: string;
}

async function testImprovedSelection() {
  if (!LIVE) {
    console.log('Running in mock mode. Set LIVE=1 to use real API.');
    return;
  }

  // Load previous comparison results
  const previousResultsPath = path.join(process.cwd(), 'building-number-comparison-report.json');
  const previousResults = JSON.parse(fs.readFileSync(previousResultsPath, 'utf-8'));
  const previousMatchMap = new Map(
    previousResults.map((r: any) => [r.address, r.match === 'YES'])
  );

  console.log('=== TESTING IMPROVED BUILDING SELECTION ===\n');
  console.log('Running with USE_IMPROVED_BUILDING_SELECTION=1\n');

  const addresses = getAllTestAddresses();
  const results: TestResult[] = [];
  let processed = 0;
  let matches = 0;
  let improvements = 0;
  let regressions = 0;

  // Test a subset first (10 addresses that had mismatches)
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

  for (const address of testAddresses) {
    processed++;
    const expectedBuildingNumber = getExpectedBuildingNumber(address);
    if (!expectedBuildingNumber) continue;

    console.log(`[${processed}/${testAddresses.length}] Testing: ${address}`);
    console.log(`  Expected: ${expectedBuildingNumber}`);

    try {
      const fullAddress = `${address}, Oslo`;
      
      // Set the environment variable to use improved selection
      process.env.USE_IMPROVED_BUILDING_SELECTION = '1';
      
      const apiResult = await resolveBuildingData(fullAddress);
      
      if (apiResult && apiResult.bygningsnummer) {
        const actualBuildingNumber = apiResult.bygningsnummer;
        const isMatch = expectedBuildingNumber === actualBuildingNumber;
        const wasMatch = previousMatchMap.get(address) || false;
        
        let improvement: TestResult['improvement'] = 'same';
        if (!wasMatch && isMatch) {
          improvement = 'better';
          improvements++;
        } else if (wasMatch && !isMatch) {
          improvement = 'worse';
          regressions++;
        } else if (!wasMatch && !isMatch) {
          improvement = 'same';
        } else {
          improvement = 'new_match';
        }
        
        results.push({
          address,
          expectedBuildingNumber,
          actualBuildingNumber,
          match: isMatch,
          improvement
        });
        
        if (isMatch) {
          matches++;
          console.log(`  ✅ MATCH: ${actualBuildingNumber} (${improvement})`);
        } else {
          console.log(`  ❌ Mismatch: Got ${actualBuildingNumber} (${improvement})`);
        }
      } else {
        results.push({
          address,
          expectedBuildingNumber,
          actualBuildingNumber: null,
          match: false,
          improvement: 'same',
          error: 'No building number returned'
        });
        console.log(`  ⚠️ No building number returned`);
      }
    } catch (error) {
      results.push({
        address,
        expectedBuildingNumber,
        actualBuildingNumber: null,
        match: false,
        improvement: 'same',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total addresses tested: ${processed}`);
  console.log(`Matches: ${matches} (${(matches/processed*100).toFixed(1)}%)`);
  console.log(`Improvements: ${improvements}`);
  console.log(`Regressions: ${regressions}`);
  console.log(`No change: ${processed - improvements - regressions}`);

  // Show improvements
  const improvedAddresses = results.filter(r => r.improvement === 'better');
  if (improvedAddresses.length > 0) {
    console.log('\n=== IMPROVEMENTS ===');
    improvedAddresses.forEach(r => {
      console.log(`✅ ${r.address}: Now correctly returns ${r.actualBuildingNumber}`);
    });
  }

  // Show regressions
  const regressedAddresses = results.filter(r => r.improvement === 'worse');
  if (regressedAddresses.length > 0) {
    console.log('\n=== REGRESSIONS ===');
    regressedAddresses.forEach(r => {
      console.log(`❌ ${r.address}: Now incorrectly returns ${r.actualBuildingNumber} (expected ${r.expectedBuildingNumber})`);
    });
  }

  // Save results
  const reportPath = path.join(process.cwd(), 'improved-selection-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// Run the test
testImprovedSelection().catch(console.error);
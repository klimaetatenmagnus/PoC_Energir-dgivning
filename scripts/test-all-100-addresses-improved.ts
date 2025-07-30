import { resolveBuildingData } from '../services/building-info-service';
import { residentialBuildingCache } from '../src/data/residential-building-cache';

async function testAll100AddressesImproved() {
  process.env.LIVE = '1';
  
  console.log('=== TESTING ALL 100 ADDRESSES WITH IMPROVED SELECTION ===\n');
  
  const addresses = Object.keys(residentialBuildingCache);
  const results = [];
  let correct = 0;
  let incorrect = 0;
  let errors = 0;
  
  console.log(`Total addresses to test: ${addresses.length}\n`);
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const expected = residentialBuildingCache[address].csvBuildingNumber;
    
    console.log(`[${i + 1}/${addresses.length}] Testing: ${address}`);
    console.log(`Expected: ${expected}`);
    
    try {
      const fullAddress = `${address}, Oslo`;
      
      // Test with improved selection
      const result = await resolveBuildingData(fullAddress, { 
        useImprovedSelection: true, 
        debug: false 
      });
      
      const actualNum = result.bygningsnummer || 'N/A';
      const isCorrect = actualNum === expected;
      
      if (isCorrect) {
        correct++;
        console.log(`Result: ${actualNum} ✅`);
      } else {
        incorrect++;
        console.log(`Result: ${actualNum} ❌`);
        results.push({
          address,
          expected,
          actual: actualNum,
          diff: actualNum !== 'N/A' ? Math.abs(parseInt(actualNum) - parseInt(expected)) : 'N/A'
        });
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors++;
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown'} ❌`);
      results.push({
        address,
        expected,
        actual: 'ERROR',
        diff: 'ERROR'
      });
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Summary
  console.log('\n=== FINAL RESULTS ===');
  console.log(`Total tested: ${addresses.length}`);
  console.log(`Correct: ${correct} (${(correct/addresses.length*100).toFixed(1)}%)`);
  console.log(`Incorrect: ${incorrect} (${(incorrect/addresses.length*100).toFixed(1)}%)`);
  console.log(`Errors: ${errors} (${(errors/addresses.length*100).toFixed(1)}%)`);
  
  if (incorrect > 0) {
    console.log('\n=== INCORRECT RESULTS ===');
    console.log('Address | Expected | Actual | Difference');
    console.log('--------|----------|--------|------------');
    results.filter(r => r.actual !== 'ERROR').forEach(r => {
      console.log(`${r.address} | ${r.expected} | ${r.actual} | ${r.diff}`);
    });
  }
  
  if (errors > 0) {
    console.log('\n=== ERRORS ===');
    results.filter(r => r.actual === 'ERROR').forEach(r => {
      console.log(`${r.address} - Expected: ${r.expected}`);
    });
  }
  
  // Save detailed results to file
  const detailedResults = {
    timestamp: new Date().toISOString(),
    summary: {
      total: addresses.length,
      correct,
      incorrect,
      errors,
      successRate: `${(correct/addresses.length*100).toFixed(1)}%`
    },
    incorrectResults: results.filter(r => r.actual !== 'ERROR'),
    errorResults: results.filter(r => r.actual === 'ERROR')
  };
  
  const fs = await import('fs');
  fs.writeFileSync(
    'test-100-addresses-improved-results.json',
    JSON.stringify(detailedResults, null, 2)
  );
  
  console.log('\nDetailed results saved to: test-100-addresses-improved-results.json');
}

testAll100AddressesImproved().catch(console.error);
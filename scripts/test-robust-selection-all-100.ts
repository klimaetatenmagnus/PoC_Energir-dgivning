import { resolveBuildingData } from '../services/building-info-service';
import { residentialBuildingCache } from '../src/data/residential-building-cache';

async function testRobustSelectionAll100() {
  process.env.LIVE = '1';
  
  console.log('=== TESTING ROBUST SELECTION ON ALL 100 ADDRESSES ===\n');
  
  const addresses = Object.keys(residentialBuildingCache);
  const results = [];
  let correct = 0;
  let incorrect = 0;
  let errors = 0;
  
  console.log(`Total addresses to test: ${addresses.length}\n`);
  
  // First test the 11 problematic addresses
  const problematicAddresses = [
    "Strømsborgveien 42",
    "Strømsborgveien 25",
    "Strømsborgveien 47",
    "Strømsborgveien 29",
    "Strømsborgveien 39",
    "Strømsborgveien 18",
    "Museumsveien 7",
    "Konsul Schjelderups vei 10",
    "Christian Benneches vei 16",
    "Huk terrasse 4",
    "Strømsborgveien 27"
  ];
  
  console.log('Testing problematic addresses first:\n');
  
  for (const address of problematicAddresses) {
    if (!residentialBuildingCache[address]) continue;
    
    const expected = residentialBuildingCache[address].csvBuildingNumber;
    console.log(`Testing: ${address} (expecting ${expected})`);
    
    try {
      const result = await resolveBuildingData(`${address}, Oslo`, { 
        useImprovedSelection: true, 
        debug: false 
      });
      
      const actualNum = result.bygningsnummer || 'N/A';
      const isCorrect = actualNum === expected;
      
      if (isCorrect) {
        console.log(`✅ ${actualNum}`);
        correct++;
      } else {
        console.log(`❌ ${actualNum} (diff: ${Math.abs(parseInt(actualNum) - parseInt(expected))})`);
        incorrect++;
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      errors++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('\n\nNow testing all addresses...\n');
  
  // Test all addresses
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const expected = residentialBuildingCache[address].csvBuildingNumber;
    
    if (i % 10 === 0) {
      console.log(`Progress: ${i}/${addresses.length}`);
    }
    
    try {
      const result = await resolveBuildingData(`${address}, Oslo`, { 
        useImprovedSelection: true, 
        debug: false 
      });
      
      const actualNum = result.bygningsnummer || 'N/A';
      const isCorrect = actualNum === expected;
      
      if (isCorrect) {
        correct++;
      } else {
        incorrect++;
        results.push({
          address,
          expected,
          actual: actualNum,
          diff: actualNum !== 'N/A' ? Math.abs(parseInt(actualNum) - parseInt(expected)) : 'N/A'
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors++;
      results.push({
        address,
        expected,
        actual: 'ERROR',
        diff: 'ERROR'
      });
    }
  }
  
  // Summary
  console.log('\n\n=== FINAL RESULTS WITH ROBUST SELECTION ===');
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
  
  // Save detailed results
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
    'test-robust-selection-results.json',
    JSON.stringify(detailedResults, null, 2)
  );
  
  console.log('\nDetailed results saved to: test-robust-selection-results.json');
}

testRobustSelectionAll100().catch(console.error);
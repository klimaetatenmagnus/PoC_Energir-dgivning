import { resolveBuildingData } from '../services/building-info-service';
import { residentialBuildingCache } from '../src/data/residential-building-cache';

// De 11 adressene som fortsatt feiler
const problematicAddresses = [
  { address: "Strømsborgveien 42", expected: "80010648", actual: "80797729" },
  { address: "Strømsborgveien 25", expected: "80010737", actual: "80834365" },
  { address: "Strømsborgveien 47", expected: "80010885", actual: "80010923" },
  { address: "Strømsborgveien 29", expected: "80010982", actual: "80018134" },
  { address: "Strømsborgveien 39", expected: "80011024", actual: "80794487" },
  { address: "Strømsborgveien 18", expected: "80011202", actual: "81111855" },
  { address: "Museumsveien 7", expected: "80011512", actual: "80615752" },
  { address: "Konsul Schjelderups vei 10", expected: "80011660", actual: "81209219" },
  { address: "Christian Benneches vei 16", expected: "80013108", actual: "80743092" },
  { address: "Huk terrasse 4", expected: "80013167", actual: "81096023" },
  { address: "Strømsborgveien 27", expected: "80013272", actual: "80786018" }
];

async function analyzeRemainingErrors() {
  process.env.LIVE = '1';
  
  console.log('=== ANALYZING REMAINING 11 ERROR ADDRESSES ===\n');
  
  // Analyze patterns
  const stromborgCount = problematicAddresses.filter(a => a.address.includes('Strømsborgveien')).length;
  console.log(`Strømsborgveien addresses: ${stromborgCount}/11 (${(stromborgCount/11*100).toFixed(0)}%)`);
  
  const largeNumbersCount = problematicAddresses.filter(a => a.actual.startsWith('8')).length;
  console.log(`Returns 80/81-series numbers: ${largeNumbersCount}/11 (${(largeNumbersCount/11*100).toFixed(0)}%)\n`);
  
  // Test each address with debug to understand what's happening
  for (const { address, expected, actual } of problematicAddresses) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Address: ${address}`);
    console.log(`Expected: ${expected} | Previously got: ${actual}`);
    console.log(`Building type: ${residentialBuildingCache[address]?.buildingType || 'Unknown'}`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      // First, let's see ALL buildings on this address
      console.log('Testing with debug enabled to see all buildings...\n');
      
      const debugResult = await resolveBuildingData(`${address}, Oslo`, { 
        useImprovedSelection: true, 
        debug: true 
      });
      
      console.log(`\nResult: ${debugResult.bygningsnummer || 'N/A'}`);
      
      // Also test without improved selection to compare
      console.log('\nTesting WITHOUT improved selection...');
      const standardResult = await resolveBuildingData(`${address}, Oslo`, { 
        useImprovedSelection: false, 
        debug: false 
      });
      console.log(`Standard result: ${standardResult.bygningsnummer || 'N/A'}`);
      
    } catch (error) {
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary of findings
  console.log('\n\n=== PATTERN ANALYSIS ===');
  console.log('\n1. Number patterns:');
  problematicAddresses.forEach(({ address, expected, actual }) => {
    const expectedNum = parseInt(expected);
    const actualNum = parseInt(actual);
    const diff = actualNum - expectedNum;
    const ratio = actualNum / expectedNum;
    console.log(`${address.padEnd(30)} | Diff: ${diff.toLocaleString().padStart(10)} | Ratio: ${ratio.toFixed(1)}`);
  });
  
  console.log('\n2. Building number prefixes:');
  const prefixMap = new Map<string, number>();
  problematicAddresses.forEach(({ actual }) => {
    const prefix = actual.substring(0, 2);
    prefixMap.set(prefix, (prefixMap.get(prefix) || 0) + 1);
  });
  prefixMap.forEach((count, prefix) => {
    console.log(`${prefix}xxxxx: ${count} addresses`);
  });
}

analyzeRemainingErrors().catch(console.error);
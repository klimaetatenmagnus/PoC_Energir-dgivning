import { resolveBuildingData } from '../services/building-info-service';

async function testFixedErrorAddresses() {
  process.env.LIVE = '1';
  
  const errorAddresses = [
    { address: "P. T. Mallings vei 27A", expected: "80011636" },
    { address: "P. T. Mallings vei 27B", expected: "80011644" },
    { address: "Schiøtts vei 2", expected: "80012691" }
  ];
  
  console.log('=== TESTING ERROR ADDRESSES WITH FIX ===\n');
  
  let successes = 0;
  
  for (const { address, expected } of errorAddresses) {
    console.log(`Testing: ${address}`);
    console.log(`Expected: ${expected}`);
    
    try {
      const result = await resolveBuildingData(`${address}, Oslo`, { 
        useImprovedSelection: true, 
        debug: false 
      });
      
      const actualNum = result.bygningsnummer || 'N/A';
      const isCorrect = actualNum === expected;
      
      if (isCorrect) {
        console.log(`Result: ${actualNum} ✅`);
        successes++;
      } else {
        console.log(`Result: ${actualNum} ❌`);
      }
      
    } catch (error) {
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown'} ❌`);
    }
    
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\nSummary: ${successes}/${errorAddresses.length} addresses now working correctly`);
}

testFixedErrorAddresses().catch(console.error);
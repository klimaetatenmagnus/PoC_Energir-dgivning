import { resolveBuildingData } from '../services/building-info-service';

async function testErrorAddresses() {
  process.env.LIVE = '1';
  
  const errorAddresses = [
    { address: "P. T. Mallings vei 27A", expected: "80011636" },
    { address: "P. T. Mallings vei 27B", expected: "80011644" },
    { address: "Schiøtts vei 2", expected: "80012691" }
  ];
  
  console.log('=== TESTING ERROR ADDRESSES WITH DIFFERENT FORMATTING ===\n');
  
  for (const { address, expected } of errorAddresses) {
    console.log(`\nTesting: ${address}`);
    console.log(`Expected: ${expected}`);
    console.log('-'.repeat(50));
    
    // Test different formatting variations
    const variations = [
      `${address}, Oslo`,  // Original
      `${address.replace('.', '')}, Oslo`,  // Remove periods
      `${address.replace('. ', '.')}, Oslo`,  // Remove space after period
      `${address.replace('.', '. ')}, Oslo`,  // Ensure space after period
      `${address.replace(/\s+/g, ' ')}, Oslo`,  // Normalize spaces
    ];
    
    for (const variation of variations) {
      console.log(`\nTrying: "${variation}"`);
      try {
        const result = await resolveBuildingData(variation, { 
          useImprovedSelection: true, 
          debug: false 
        });
        
        if (result.bygningsnummer) {
          const isCorrect = result.bygningsnummer === expected;
          console.log(`Result: ${result.bygningsnummer} ${isCorrect ? '✅' : '❌'}`);
          if (isCorrect) {
            console.log('SUCCESS! This formatting works!');
            break;
          }
        } else {
          console.log('No building number returned');
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  }
  
  // Also test some of the incorrect ones
  console.log('\n\n=== TESTING SOME INCORRECT ADDRESSES ===\n');
  
  const incorrectAddresses = [
    { address: "Strømsborgveien 42", expected: "80010648" },
    { address: "Museumsveien 7", expected: "80011512" },
  ];
  
  for (const { address, expected } of incorrectAddresses) {
    console.log(`\nTesting: ${address}`);
    console.log(`Expected: ${expected}`);
    
    try {
      // Test with debug enabled to see what's happening
      const result = await resolveBuildingData(`${address}, Oslo`, { 
        useImprovedSelection: true, 
        debug: true 
      });
      
      const actualNum = result.bygningsnummer || 'N/A';
      const isCorrect = actualNum === expected;
      console.log(`Result: ${actualNum} ${isCorrect ? '✅' : '❌'}`);
      
    } catch (error) {
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

testErrorAddresses().catch(console.error);
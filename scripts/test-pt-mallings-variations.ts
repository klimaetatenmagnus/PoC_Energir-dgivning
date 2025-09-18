import { resolveBuildingData } from '../services/building-info-service';

async function testPTMallingsVariations() {
  process.env.LIVE = '1';
  
  console.log('=== TESTING P. T. MALLINGS VEI VARIATIONS ===\n');
  
  const testAddresses = [
    "P. T. Mallings vei 27A",
    "P. T. Mallings vei 27B",
    "P. T. Mallings vei 20",  // A simpler address without letters
  ];
  
  const variations = [
    // Original format
    (addr: string) => `${addr}, Oslo`,
    // Remove all periods
    (addr: string) => `${addr.replace(/\./g, '')}, Oslo`,
    // PT without space between letters
    (addr: string) => `${addr.replace('P. T.', 'P.T.')}, Oslo`,
    // Full name possibilities
    (addr: string) => `${addr.replace('P. T.', 'Peter Thomas')}, Oslo`,
    (addr: string) => `${addr.replace('P. T.', 'P T')}, Oslo`,
    // Try different spacing
    (addr: string) => `${addr.replace('P. T. ', 'P.T. ')}, Oslo`,
    // Try lowercase
    (addr: string) => `${addr.toLowerCase()}, oslo`,
  ];
  
  for (const address of testAddresses) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing address: ${address}`);
    console.log(`${'='.repeat(60)}\n`);
    
    let foundWorking = false;
    
    for (let i = 0; i < variations.length; i++) {
      const variation = variations[i](address);
      console.log(`[${i + 1}/${variations.length}] Trying: "${variation}"`);
      
      try {
        const result = await resolveBuildingData(variation, { 
          useImprovedSelection: false,  // Use standard selection first
          debug: false 
        });
        
        if (result.bygningsnummer) {
          console.log(`✅ SUCCESS! Building number: ${result.bygningsnummer}`);
          foundWorking = true;
          
          // Also test with improved selection
          console.log('   Testing with improved selection...');
          const improvedResult = await resolveBuildingData(variation, { 
            useImprovedSelection: true,
            debug: false 
          });
          console.log(`   Improved result: ${improvedResult.bygningsnummer || 'N/A'}`);
          
          break;
        } else {
          console.log('❌ No building number returned');
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    if (!foundWorking) {
      console.log('\n⚠️  No working variation found for this address!');
    }
  }
  
  // Let's also check if the issue might be with the letter suffix
  console.log('\n\n=== TESTING WITHOUT LETTER SUFFIX ===\n');
  
  const baseAddresses = [
    "P. T. Mallings vei 27",  // Without A/B
  ];
  
  for (const address of baseAddresses) {
    console.log(`Testing: "${address}, Oslo"`);
    try {
      const result = await resolveBuildingData(`${address}, Oslo`, { 
        useImprovedSelection: true,
        debug: false 
      });
      
      if (result.bygningsnummer) {
        console.log(`✅ Building number: ${result.bygningsnummer}`);
      } else {
        console.log('❌ No building number');
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}

testPTMallingsVariations().catch(console.error);
import { resolveBuildingData } from '../services/building-info-service';
import { getExpectedBuildingNumber } from '../src/data/residential-building-cache';

async function testImprovedComprehensive() {
  process.env.LIVE = '1';
  
  const testAddresses = [
    "Dammanns vei 13",          // Close match (8 diff)
    "Christian Benneches vei 4C", // Very close match
    "Huk aveny 12A",            // Adjacent sections
    "Museumsveien 7B",          // Adjacent buildings
    "Bygdøylund 2",             // Row house
    "Bygdøylund 9",             // Row house
    "Strømsborgveien 55B",      // 300-series issue
  ];

  console.log('=== TESTING IMPROVED BUILDING SELECTION ===\n');
  
  const results = [];
  
  for (const address of testAddresses) {
    const expected = getExpectedBuildingNumber(address);
    if (!expected) continue;
    
    console.log(`Testing: ${address}`);
    console.log(`Expected: ${expected}`);
    
    try {
      const fullAddress = `${address}, Oslo`;
      
      // Standard selection
      const standard = await resolveBuildingData(fullAddress, { useImprovedSelection: false });
      const standardNum = standard.bygningsnummer || 'N/A';
      
      // Improved selection (no debug to reduce noise)
      const improved = await resolveBuildingData(fullAddress, { useImprovedSelection: true, debug: false });
      const improvedNum = improved.bygningsnummer || 'N/A';
      
      const standardMatch = standardNum === expected;
      const improvedMatch = improvedNum === expected;
      
      console.log(`Standard: ${standardNum} ${standardMatch ? '✅' : '❌'}`);
      console.log(`Improved: ${improvedNum} ${improvedMatch ? '✅' : '❌'}`);
      
      let status = 'SAME';
      if (!standardMatch && improvedMatch) status = 'BETTER ✨';
      else if (standardMatch && !improvedMatch) status = 'WORSE ⚠️';
      
      console.log(`Status: ${status}\n`);
      
      results.push({
        address,
        expected,
        standard: standardNum,
        improved: improvedNum,
        status
      });
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
  }
  
  // Summary
  console.log('=== SUMMARY ===');
  const better = results.filter(r => r.status.includes('BETTER')).length;
  const worse = results.filter(r => r.status.includes('WORSE')).length;
  const same = results.filter(r => r.status === 'SAME').length;
  
  console.log(`Total tested: ${results.length}`);
  console.log(`Improvements: ${better}`);
  console.log(`Regressions: ${worse}`);
  console.log(`No change: ${same}`);
  
  if (better > 0) {
    console.log('\n✨ Improvements:');
    results.filter(r => r.status.includes('BETTER')).forEach(r => {
      console.log(`  ${r.address}: ${r.standard} → ${r.improved} (expected ${r.expected})`);
    });
  }
}

testImprovedComprehensive().catch(console.error);
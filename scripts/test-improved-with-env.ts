// Set environment variables BEFORE importing
process.env.LIVE = '1';
process.env.LOG = '1';
process.env.USE_IMPROVED_BUILDING_SELECTION = '1';

console.log('Environment variables set:');
console.log('  LIVE:', process.env.LIVE);
console.log('  LOG:', process.env.LOG);
console.log('  USE_IMPROVED_BUILDING_SELECTION:', process.env.USE_IMPROVED_BUILDING_SELECTION);
console.log('');

// Now import after environment is set
import { resolveBuildingData } from '../services/building-info-service/index.js';

async function testWithImprovedSelection() {
  const testAddress = 'Dammanns vei 13, Oslo';
  console.log(`\nTesting address: ${testAddress}`);
  console.log('Expected building number: 80010575');
  
  try {
    const result = await resolveBuildingData(testAddress);
    console.log('\nResult:');
    console.log(`  Building number: ${result.bygningsnummer}`);
    console.log(`  Match: ${result.bygningsnummer === '80010575' ? '✅ YES' : '❌ NO'}`);
    console.log(`  Building type: ${result.bygningstype}`);
    console.log(`  Area: ${result.bruksarealM2} m²`);
    console.log(`  Built: ${result.byggeaar}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

testWithImprovedSelection().catch(console.error);
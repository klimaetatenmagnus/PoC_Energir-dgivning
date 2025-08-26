import { resolveBuildingData } from '../services/building-info-service';

async function testSingleAddress() {
  console.log('Testing single address with improved selection...\n');
  
  // Enable debug logging
  process.env.LOG = '1';
  process.env.USE_IMPROVED_BUILDING_SELECTION = '1';
  process.env.LIVE = '1';
  
  const address = 'Dammanns vei 13, Oslo';
  console.log(`Testing address: ${address}`);
  console.log(`USE_IMPROVED_BUILDING_SELECTION: ${process.env.USE_IMPROVED_BUILDING_SELECTION}`);
  
  try {
    const result = await resolveBuildingData(address);
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testSingleAddress().catch(console.error);
import { resolveBuildingData } from '../services/building-info-service';

async function testSingleImproved() {
  process.env.LIVE = '1';
  process.env.LOG = '1';
  
  const address = 'Dammanns vei 13, Oslo';
  console.log('Testing address:', address);
  console.log('Expected building number: 80010575\n');
  
  try {
    console.log('=== STANDARD SELECTION ===');
    const standard = await resolveBuildingData(address, { useImprovedSelection: false });
    console.log('Result:', standard.bygningsnummer);
    console.log('Match:', standard.bygningsnummer === '80010575' ? '✅' : '❌');
    
    console.log('\n=== IMPROVED SELECTION ===');
    const improved = await resolveBuildingData(address, { useImprovedSelection: true, debug: true });
    console.log('Result:', improved.bygningsnummer);
    console.log('Match:', improved.bygningsnummer === '80010575' ? '✅' : '❌');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSingleImproved().catch(console.error);
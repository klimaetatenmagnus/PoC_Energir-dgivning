import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveBuildingData } from '../services/building-info-service/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const USE_LIVE_API = process.env.LIVE === '1';

// Read the extracted addresses
const addressesPath = path.join(__dirname, '..', 'first-100-residential-addresses.json');
const addressData = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));

async function testSample() {
  console.log('='.repeat(80));
  console.log('Testing API vs CSV - Sample of 5 addresses');
  console.log(`Mode: ${USE_LIVE_API ? 'LIVE API' : 'MOCK MODE'}`);
  console.log('='.repeat(80));

  // Test first 5 addresses
  const sampleAddresses = addressData.addresses.slice(0, 5);

  for (const addressInfo of sampleAddresses) {
    console.log(`\n${'-'.repeat(40)}`);
    console.log(`Testing: ${addressInfo.address}`);
    console.log(`CSV Building Number: ${addressInfo.buildingNumber}`);
    console.log(`Building Type: ${addressInfo.buildingType}`);
    
    try {
      const fullAddress = addressInfo.address + ', Oslo';
      const buildingData = await resolveBuildingData(fullAddress);
      
      if (buildingData && buildingData.bygningsnummer) {
        console.log(`API Building Number: ${buildingData.bygningsnummer}`);
        console.log(`Match: ${addressInfo.buildingNumber === buildingData.bygningsnummer ? '✅ YES' : '❌ NO'}`);
        console.log(`API Bruksareal: ${buildingData.bruksarealM2} m²`);
        console.log(`API Building Type: ${buildingData.bygningstype}`);
      } else {
        console.log(`API Result: No building data returned`);
      }
    } catch (error: any) {
      console.log(`API Error: ${error.message}`);
    }
  }
}

// Run the test
testSample().catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
});
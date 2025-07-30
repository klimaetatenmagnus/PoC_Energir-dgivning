import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveBuildingData } from '../services/building-info-service/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const USE_LIVE_API = process.env.LIVE === '1';
const LOG = process.env.LOG === '1';

// Read the extracted addresses
const addressesPath = path.join(__dirname, '..', 'first-100-residential-addresses.json');
const addressData = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));

interface TestResult {
  address: string;
  csvBuildingNumber: string;
  apiBuildingNumber: string | null;
  match: boolean;
  error?: string;
  buildingType?: string;
  bruksareal?: number;
}

async function testAddress(addressInfo: any): Promise<TestResult> {
  const result: TestResult = {
    address: addressInfo.address,
    csvBuildingNumber: addressInfo.buildingNumber,
    apiBuildingNumber: null,
    match: false
  };

  try {
    // Add ", Oslo" to the address as the API expects it
    const fullAddress = addressInfo.address + ', Oslo';
    
    if (LOG) {
      console.log(`Testing: ${fullAddress}`);
    }

    const buildingData = await resolveBuildingData(fullAddress);
    
    if (buildingData && buildingData.bygningsnummer) {
      result.apiBuildingNumber = buildingData.bygningsnummer;
      result.match = result.csvBuildingNumber === result.apiBuildingNumber;
      result.buildingType = buildingData.bygningstype;
      result.bruksareal = buildingData.bruksarealM2;
    } else {
      result.error = 'No building data returned';
    }
  } catch (error: any) {
    result.error = error.message || 'Unknown error';
  }

  return result;
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('Testing API vs CSV Building Numbers');
  console.log(`Mode: ${USE_LIVE_API ? 'LIVE API' : 'MOCK MODE'}`);
  console.log(`Total addresses to test: ${addressData.totalAddresses}`);
  console.log('='.repeat(80));

  const results: TestResult[] = [];
  const batchSize = 5; // Process in small batches to avoid overwhelming the API

  for (let i = 0; i < addressData.addresses.length; i += batchSize) {
    const batch = addressData.addresses.slice(i, Math.min(i + batchSize, addressData.addresses.length));
    
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1} (addresses ${i + 1}-${Math.min(i + batchSize, addressData.addresses.length)})`);
    
    const batchResults = await Promise.all(batch.map(testAddress));
    results.push(...batchResults);
    
    // Add a small delay between batches to be respectful to the API
    if (i + batchSize < addressData.addresses.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Generate summary
  const matches = results.filter(r => r.match).length;
  const errors = results.filter(r => r.error).length;
  const mismatches = results.filter(r => !r.match && !r.error).length;

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tested: ${results.length}`);
  console.log(`Matches: ${matches} (${(matches / results.length * 100).toFixed(1)}%)`);
  console.log(`Mismatches: ${mismatches} (${(mismatches / results.length * 100).toFixed(1)}%)`);
  console.log(`Errors: ${errors} (${(errors / results.length * 100).toFixed(1)}%)`);

  // Show mismatches
  if (mismatches > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('MISMATCHES:');
    console.log('-'.repeat(80));
    results.filter(r => !r.match && !r.error).forEach(r => {
      console.log(`Address: ${r.address}`);
      console.log(`  CSV Building: ${r.csvBuildingNumber}`);
      console.log(`  API Building: ${r.apiBuildingNumber}`);
      console.log(`  Building Type: ${r.buildingType || 'N/A'}`);
      console.log(`  Bruksareal: ${r.bruksareal || 'N/A'} m²`);
      console.log();
    });
  }

  // Show errors
  if (errors > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('ERRORS:');
    console.log('-'.repeat(80));
    results.filter(r => r.error).forEach(r => {
      console.log(`Address: ${r.address}`);
      console.log(`  Error: ${r.error}`);
      console.log();
    });
  }

  // Save detailed results
  const outputPath = path.join(__dirname, '..', 'api-vs-csv-test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    testDate: new Date().toISOString(),
    mode: USE_LIVE_API ? 'LIVE' : 'MOCK',
    summary: {
      total: results.length,
      matches,
      mismatches,
      errors,
      matchRate: (matches / results.length * 100).toFixed(1) + '%'
    },
    results
  }, null, 2));

  console.log(`\nDetailed results saved to: ${outputPath}`);
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
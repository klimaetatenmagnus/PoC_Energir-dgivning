import { csvService } from '../src/services/csvService';
import { resolveBuildingData } from '../services/building-info-service';
import fs from 'fs';
import path from 'path';

const LIVE = process.env.LIVE === '1';

interface ComparisonResult {
  address: string;
  csvBuildingNumber: string;
  apiBuildingNumber: string | null;
  match: boolean;
  error?: string;
}

async function compareCSVwithAPI() {
  if (!LIVE) {
    console.log('Running in mock mode. Set LIVE=1 to use real API.');
    return;
  }

  console.log('Starting comparison of CSV building numbers with API results...\n');

  // Read CSV data
  const csvPath = path.join(process.cwd(), 'first-100-residential-addresses.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').slice(1); // Skip header
  
  const results: ComparisonResult[] = [];
  let processed = 0;
  let matches = 0;
  let errors = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Parse CSV line (handle quoted fields)
    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) continue;
    
    const [_, address, csvBuildingNumber, buildingType] = match;
    processed++;
    
    console.log(`[${processed}/100] Testing: ${address}`);
    
    try {
      // Add ", Oslo" to address for API
      const fullAddress = `${address}, Oslo`;
      
      const apiResult = await resolveBuildingData(fullAddress);
      
      if (apiResult && apiResult.bygningsnummer) {
        const apiBuildingNumber = apiResult.bygningsnummer;
        const isMatch = csvBuildingNumber === apiBuildingNumber;
        
        results.push({
          address,
          csvBuildingNumber,
          apiBuildingNumber,
          match: isMatch
        });
        
        if (isMatch) {
          matches++;
          console.log(`  ✅ Match: ${csvBuildingNumber}`);
        } else {
          console.log(`  ❌ Mismatch: CSV=${csvBuildingNumber}, API=${apiBuildingNumber}`);
        }
      } else {
        results.push({
          address,
          csvBuildingNumber,
          apiBuildingNumber: null,
          match: false,
          error: 'No building number returned'
        });
        errors++;
        console.log(`  ⚠️ No building number returned`);
      }
    } catch (error) {
      results.push({
        address,
        csvBuildingNumber,
        apiBuildingNumber: null,
        match: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      errors++;
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Add small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total addresses processed: ${processed}`);
  console.log(`Matches: ${matches} (${(matches/processed*100).toFixed(1)}%)`);
  console.log(`Mismatches: ${processed - matches - errors} (${((processed - matches - errors)/processed*100).toFixed(1)}%)`);
  console.log(`Errors: ${errors} (${(errors/processed*100).toFixed(1)}%)`);

  // Write detailed results to file
  const report = results.map(r => ({
    address: r.address,
    csv_building_number: r.csvBuildingNumber,
    api_building_number: r.apiBuildingNumber || 'N/A',
    match: r.match ? 'YES' : 'NO',
    error: r.error || ''
  }));

  const reportPath = path.join(process.cwd(), 'building-number-comparison-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);

  // Show mismatches
  const mismatches = results.filter(r => !r.match && r.apiBuildingNumber);
  if (mismatches.length > 0) {
    console.log('\n=== MISMATCHES ===');
    mismatches.forEach(m => {
      console.log(`${m.address}: CSV=${m.csvBuildingNumber}, API=${m.apiBuildingNumber}`);
    });
  }
}

// Run the comparison
compareCSVwithAPI().catch(console.error);
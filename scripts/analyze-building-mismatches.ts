import fs from 'fs';
import path from 'path';

interface ComparisonResult {
  address: string;
  csv_building_number: string;
  api_building_number: string | 'N/A';
  match: string;
  error: string;
}

// Analyze patterns in building number mismatches
function analyzeMismatches() {
  const reportPath = path.join(process.cwd(), 'building-number-comparison-report.json');
  const data: ComparisonResult[] = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  
  const mismatches = data.filter(d => d.match === 'NO' && d.api_building_number !== 'N/A');
  
  console.log('=== MISMATCH ANALYSIS ===\n');
  console.log(`Total mismatches: ${mismatches.length}\n`);
  
  // Pattern 1: Building number ranges
  console.log('1. Building Number Range Analysis:');
  const patterns = {
    similarRange: [] as ComparisonResult[],
    veryDifferent: [] as ComparisonResult[],
    biggerNumber: [] as ComparisonResult[],
    smallerNumber: [] as ComparisonResult[]
  };
  
  mismatches.forEach(m => {
    const csvNum = parseInt(m.csv_building_number);
    const apiNum = parseInt(m.api_building_number);
    const diff = Math.abs(csvNum - apiNum);
    
    if (diff < 100) {
      patterns.similarRange.push(m);
    } else {
      patterns.veryDifferent.push(m);
    }
    
    if (apiNum > csvNum) {
      patterns.biggerNumber.push(m);
    } else {
      patterns.smallerNumber.push(m);
    }
  });
  
  console.log(`  - Similar range (diff < 100): ${patterns.similarRange.length}`);
  console.log(`  - Very different (diff >= 100): ${patterns.veryDifferent.length}`);
  console.log(`  - API chose bigger number: ${patterns.biggerNumber.length}`);
  console.log(`  - API chose smaller number: ${patterns.smallerNumber.length}\n`);
  
  // Pattern 2: Address patterns
  console.log('2. Address Pattern Analysis:');
  const addressPatterns = {
    withLetter: [] as ComparisonResult[],
    rowHouse: [] as ComparisonResult[],
    regularNumber: [] as ComparisonResult[]
  };
  
  mismatches.forEach(m => {
    if (/\d+[A-Z]$/i.test(m.address)) {
      addressPatterns.withLetter.push(m);
    } else if (m.address.includes('Bygdøylund')) {
      addressPatterns.rowHouse.push(m);
    } else {
      addressPatterns.regularNumber.push(m);
    }
  });
  
  console.log(`  - Addresses with letters (e.g., 42B): ${addressPatterns.withLetter.length}`);
  console.log(`  - Row houses (Bygdøylund): ${addressPatterns.rowHouse.length}`);
  console.log(`  - Regular addresses: ${addressPatterns.regularNumber.length}\n`);
  
  // Pattern 3: Specific cases
  console.log('3. Specific Patterns:');
  
  // Check for 300-series numbers (might be newer buildings)
  const series300 = mismatches.filter(m => m.api_building_number.startsWith('300'));
  console.log(`  - API returned 300-series number: ${series300.length}`);
  if (series300.length > 0) {
    console.log('    Examples:');
    series300.slice(0, 5).forEach(s => {
      console.log(`      ${s.address}: CSV=${s.csv_building_number}, API=${s.api_building_number}`);
    });
  }
  
  // Check for very close numbers (might be neighboring buildings)
  console.log('\n4. Very Close Numbers (diff < 50):');
  patterns.similarRange
    .filter(m => Math.abs(parseInt(m.csv_building_number) - parseInt(m.api_building_number)) < 50)
    .slice(0, 10)
    .forEach(m => {
      console.log(`  ${m.address}: CSV=${m.csv_building_number}, API=${m.api_building_number}`);
    });
  
  // Row house analysis
  console.log('\n5. Row House (Bygdøylund) Analysis:');
  const bygdoylundMismatches = mismatches.filter(m => m.address.includes('Bygdøylund'));
  const uniqueApiNumbers = new Set(bygdoylundMismatches.map(m => m.api_building_number));
  console.log(`  - Total Bygdøylund mismatches: ${bygdoylundMismatches.length}`);
  console.log(`  - Unique API building numbers returned: ${uniqueApiNumbers.size}`);
  if (uniqueApiNumbers.size === 1) {
    console.log(`  - All returned same building number: ${[...uniqueApiNumbers][0]}`);
  }
  
  // Summary recommendations
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('1. For addresses with letters (A, B, C), the API often picks different sections');
  console.log('2. For row houses (Bygdøylund), the API returns the same building for all units');
  console.log('3. When multiple buildings exist, API might prioritize:');
  console.log('   - Newer buildings (300-series)');
  console.log('   - Larger buildings');
  console.log('   - Buildings with specific characteristics');
  console.log('\nConsider implementing:');
  console.log('- Special handling for known row house addresses');
  console.log('- Better section/letter matching logic');
  console.log('- Building age consideration in selection');
}

analyzeMismatches();
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Call API endpoint
async function fetchFromAPI(address) {
  try {
    // Dynamic import for ESM module
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('http://localhost:3001/api/address-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    // The API returns a single object, not an array
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error(`API call failed for "${address}": ${error.message}`);
    return [];
  }
}

// Simple CSV parser
function parseCSV(content) {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  const records = [];
  
  // Parse lines (skip empty ones)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(';').map(v => v.trim().replace(/"/g, ''));
    if (values.length !== headers.length) continue;
    
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index];
    });
    
    // Only residential buildings (type 11-17)
    const buildingType = record.Bygningstype?.substring(0, 2);
    if (['11', '12', '13', '14', '15', '16', '17'].includes(buildingType)) {
      records.push(record);
    }
  }
  
  return records;
}

async function testSpecificAddresses() {
  console.log("\n🎯 Testing specific known addresses first...\n");
  
  const testAddresses = [
    { address: "Lille Frøens vei 1A, 0371 Oslo", expectedBuilding: "80110219" },
    { address: "Kapellveien 156B, 0493 Oslo", expectedBuilding: "80181503" },
    { address: "Kjelsåsveien 97B, 0491 Oslo", expectedBuilding: "80181591" }
  ];
  
  for (const test of testAddresses) {
    console.log(`Testing: ${test.address}`);
    const apiResults = await fetchFromAPI(test.address);
    
    if (apiResults.length > 0) {
      const api = apiResults[0];
      console.log(`  ✓ Found - Building: ${api.bygningsnummer}, Area: ${api.bruksarealM2}m², Type: ${api.bygningstypeKode}`);
      if (api.bygningsnummer !== test.expectedBuilding) {
        console.log(`  ⚠️  Expected building ${test.expectedBuilding} but got ${api.bygningsnummer}`);
      }
    } else {
      console.log(`  ✗ Not found in API`);
    }
    console.log();
  }
}

async function compareAddresses(records, sampleSize = 10) {
  console.log(`\n📊 Comparing ${sampleSize} random addresses from spreadsheet with API...\n`);
  
  const results = {
    total: 0,
    foundInAPI: 0,
    notFoundInAPI: 0,
    perfectMatch: 0,
    differentBuilding: 0,
    differentArea: 0,
    differentType: 0,
    examples: {
      notFound: [],
      differentBuilding: [],
      differentArea: [],
      perfectMatch: []
    }
  };
  
  // Random sample
  const sampled = records
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);
  
  for (const record of sampled) {
    results.total++;
    process.stdout.write(`\rProcessing ${results.total}/${sampleSize}: ${record.GateAdresse.padEnd(40)}`);
    
    const apiResults = await fetchFromAPI(record.GateAdresse);
    
    if (apiResults.length === 0) {
      results.notFoundInAPI++;
      if (results.examples.notFound.length < 3) {
        results.examples.notFound.push(record.GateAdresse);
      }
    } else {
      results.foundInAPI++;
      const api = apiResults[0];
      
      let isPerfectMatch = true;
      
      // Compare building number
      if (record.BYGNINGS_NR !== api.bygningsnummer) {
        results.differentBuilding++;
        isPerfectMatch = false;
        if (results.examples.differentBuilding.length < 3) {
          results.examples.differentBuilding.push(
            `${record.GateAdresse}: CSV=${record.BYGNINGS_NR}, API=${api.bygningsnummer}`
          );
        }
      }
      
      // Compare area
      const csvArea = parseInt(record.BRUKSAREAL_TOTALT) || 0;
      if (Math.abs(csvArea - api.bruksarealM2) > 1) {
        results.differentArea++;
        isPerfectMatch = false;
        if (results.examples.differentArea.length < 3) {
          results.examples.differentArea.push(
            `${record.GateAdresse}: CSV=${csvArea}m², API=${api.bruksarealM2}m²`
          );
        }
      }
      
      // Compare type
      const csvType = record.Bygningstype?.substring(0, 3);
      if (csvType !== api.bygningstypeKode) {
        results.differentType++;
        isPerfectMatch = false;
      }
      
      if (isPerfectMatch) {
        results.perfectMatch++;
        if (results.examples.perfectMatch.length < 3) {
          results.examples.perfectMatch.push(record.GateAdresse);
        }
      }
    }
    
    // Small delay to not overwhelm API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n');
  return results;
}

async function main() {
  console.log("🔍 Spreadsheet vs API Comparison Analysis");
  console.log("=".repeat(50));
  
  try {
    // Check API health
    console.log("\nChecking API server...");
    const fetch = (await import('node-fetch')).default;
    const healthCheck = await fetch('http://localhost:3001/health');
    if (!healthCheck.ok) {
      throw new Error("API server is not running on http://localhost:3001");
    }
    console.log("✅ API server is running");
    
    // First test specific addresses
    await testSpecificAddresses();
    
    // Load CSV
    const csvPath = path.join(process.cwd(), 'data', 'raw', 'Matrikkel 2023.csv');
    console.log(`\nLoading spreadsheet: ${csvPath}`);
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(csvContent);
    console.log(`✅ Found ${records.length} residential buildings in spreadsheet`);
    
    // Compare sample
    const results = await compareAddresses(records, 20);
    
    // Display results
    console.log("\n" + "=".repeat(80));
    console.log("📊 RESULTS SUMMARY");
    console.log("=".repeat(80));
    
    console.log(`\nTotal addresses tested: ${results.total}`);
    console.log(`Found in API: ${results.foundInAPI} (${(results.foundInAPI/results.total*100).toFixed(1)}%)`);
    console.log(`Not found in API: ${results.notFoundInAPI} (${(results.notFoundInAPI/results.total*100).toFixed(1)}%)`);
    
    if (results.foundInAPI > 0) {
      console.log(`\nOf those found in API:`);
      console.log(`- Perfect match: ${results.perfectMatch} (${(results.perfectMatch/results.foundInAPI*100).toFixed(1)}%)`);
      console.log(`- Different building: ${results.differentBuilding} (${(results.differentBuilding/results.foundInAPI*100).toFixed(1)}%)`);
      console.log(`- Different area: ${results.differentArea} (${(results.differentArea/results.foundInAPI*100).toFixed(1)}%)`);
      console.log(`- Different type: ${results.differentType} (${(results.differentType/results.foundInAPI*100).toFixed(1)}%)`);
    }
    
    console.log("\n📝 EXAMPLES:");
    
    if (results.examples.notFound.length > 0) {
      console.log("\n❌ Not found in API:");
      results.examples.notFound.forEach(addr => console.log(`  - ${addr}`));
    }
    
    if (results.examples.differentBuilding.length > 0) {
      console.log("\n🏢 Different building selected:");
      results.examples.differentBuilding.forEach(ex => console.log(`  - ${ex}`));
    }
    
    if (results.examples.differentArea.length > 0) {
      console.log("\n📐 Different area reported:");
      results.examples.differentArea.forEach(ex => console.log(`  - ${ex}`));
    }
    
    if (results.examples.perfectMatch.length > 0) {
      console.log("\n✅ Perfect matches:");
      results.examples.perfectMatch.forEach(addr => console.log(`  - ${addr}`));
    }
    
    console.log("\n💡 KEY INSIGHTS:");
    console.log("1. Many addresses fail due to formatting differences (API expects exact format)");
    console.log("2. API uses sophisticated building selection logic:");
    console.log("   - Prioritizes main residential buildings");
    console.log("   - Handles sections/apartments differently");
    console.log("   - May select newer buildings for sectioned properties");
    console.log("3. Spreadsheet data is from 2023, API returns current data");
    console.log("4. Building numbers can differ when multiple buildings exist on property");
    
    // Save detailed results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `comparison-results-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify({
      summary: results,
      timestamp: new Date().toISOString(),
      totalInSpreadsheet: records.length,
      sampleSize: results.total
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${filename}`);
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nMake sure:");
    console.error("1. API server is running (npm run start:api or ./scripts/start-ui-only.sh)");
    console.error("2. 'Matrikkel 2023.csv' exists in data/raw/");
  }
}

// Run the script
main().catch(console.error);

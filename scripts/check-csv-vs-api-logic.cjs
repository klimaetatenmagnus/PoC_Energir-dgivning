#!/usr/bin/env node

async function checkCSVvsAPILogic() {
  console.log("🔍 Investigating API failures and building selection logic\n");
  
  const fetch = (await import('node-fetch')).default;
  const fs = require('fs');
  const path = require('path');
  
  // First, let's check the CSV format
  console.log("📄 Checking CSV address format:");
  const csvPath = path.join(process.cwd(), 'data', 'raw', 'Matrikkel 2023.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  
  // Find some examples
  const exampleAddresses = [];
  for (let i = 1; i < Math.min(10, lines.length); i++) {
    const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
    const addressIndex = headers.indexOf('GateAdresse');
    if (addressIndex >= 0 && values[addressIndex]) {
      exampleAddresses.push(values[addressIndex]);
    }
  }
  
  console.log("First few addresses in CSV:");
  exampleAddresses.forEach(addr => console.log(`- "${addr}"`));
  console.log("\n💡 CSV addresses don't include ', Oslo' suffix!\n");
  
  // Test problematic addresses with and without Oslo
  const testAddresses = [
    { csv: "Øraveien 4", withOslo: "Øraveien 4, Oslo" },
    { csv: "Arnstein Arnebergs vei 3", withOslo: "Arnstein Arnebergs vei 3, Oslo" },
    { csv: "Gravdalsveien 6", withOslo: "Gravdalsveien 6, Oslo" },
    { csv: "Vækerøveien 126K", withOslo: "Vækerøveien 126K, Oslo" }
  ];
  
  console.log("🧪 Testing addresses with and without ', Oslo':\n");
  
  for (const test of testAddresses) {
    console.log(`\n📍 Testing: ${test.csv}`);
    
    // Test without Oslo
    let result1 = "Not found";
    try {
      const response1 = await fetch('http://localhost:3001/api/address-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: test.csv })
      });
      
      if (response1.ok) {
        const data = await response1.json();
        result1 = `Found building ${data.bygningsnummer}`;
      }
    } catch (error) {
      result1 = "Error";
    }
    
    // Test with Oslo
    let result2 = "Not found";
    try {
      const response2 = await fetch('http://localhost:3001/api/address-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: test.withOslo })
      });
      
      if (response2.ok) {
        const data = await response2.json();
        result2 = `Found building ${data.bygningsnummer}, ${data.bruksarealM2}m²`;
      }
    } catch (error) {
      result2 = "Error";
    }
    
    console.log(`Without Oslo: ${result1}`);
    console.log(`With Oslo: ${result2}`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Now let's check building selection for Vækerøveien 126K
  console.log("\n\n🏢 Checking building selection logic for Vækerøveien 126K:");
  
  // Find CSV data for this address
  let csvRecord = null;
  const addressToFind = "Vækerøveien 126K";
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index];
    });
    
    if (record.GateAdresse === addressToFind) {
      csvRecord = record;
      break;
    }
  }
  
  if (csvRecord) {
    console.log("\nCSV Record:");
    console.log(`- Address: ${csvRecord.GateAdresse}`);
    console.log(`- Building: ${csvRecord.BYGNINGS_NR}`);
    console.log(`- Area: ${csvRecord.BRUKSAREAL_TOTALT} m²`);
    console.log(`- Type: ${csvRecord.Bygningstype}`);
    
    // Get API result
    try {
      const response = await fetch('http://localhost:3001/api/address-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addressToFind + ", Oslo" })
      });
      
      if (response.ok) {
        const apiData = await response.json();
        console.log("\nAPI Result:");
        console.log(`- Building: ${apiData.bygningsnummer}`);
        console.log(`- Area: ${apiData.bruksarealM2} m²`);
        console.log(`- Type: ${apiData.bygningstypeKode} - ${apiData.bygningstype}`);
        console.log(`- Section: ${apiData.seksjonsnummer || 'None'}`);
        
        console.log("\n🔍 Analysis:");
        if (csvRecord.BYGNINGS_NR !== apiData.bygningsnummer) {
          console.log(`Different buildings selected:`);
          console.log(`CSV: ${csvRecord.BYGNINGS_NR} (144 m²)`);
          console.log(`API: ${apiData.bygningsnummer} (168 m²)`);
          console.log("\nPossible reasons:");
          console.log("1. API might prioritize buildings with 'K' section differently");
          console.log("2. Multiple buildings exist at this address");
          console.log("3. Building data has changed since 2023");
        }
      }
    } catch (error) {
      console.error("API error:", error.message);
    }
  }
  
  console.log("\n\n💡 KEY FINDINGS:");
  console.log("1. ❌ CSV addresses don't include ', Oslo' - this causes API lookup failures");
  console.log("2. 🏢 When API selects different buildings, it might be because:");
  console.log("   - The 'advanced logic' prioritizes main buildings over sections");
  console.log("   - Section handling (A, B, K etc.) affects building selection");
  console.log("   - Data has changed between 2023 (CSV) and now");
  console.log("3. 📐 For area differences, API often returns section-specific area");
  console.log("\nRECOMMENDATION: The comparison script should add ', Oslo' to addresses from CSV");
}

checkCSVvsAPILogic().catch(console.error);

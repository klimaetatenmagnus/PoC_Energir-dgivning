const fs = require('fs');
const path = require('path');

// Read and parse CSV file
const csvPath = path.join(__dirname, '..', 'data', 'raw', 'Matrikkel 2023.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Split into lines and parse
const lines = csvContent.split('\n');
const headers = lines[0].split(';');

// Find column indices
const byggNrIndex = headers.findIndex(h => h.includes('BYGNINGS_NR'));
const gateAdresseIndex = headers.findIndex(h => h.includes('GateAdresse'));
const bygningsTypeIndex = headers.findIndex(h => h === 'Bygningstype');
const bygningsTypeNavnIndex = headers.findIndex(h => h.includes('Bygningstype_navn'));

console.log('Column indices:', {
  byggNr: byggNrIndex,
  gateAdresse: gateAdresseIndex,
  bygningsType: bygningsTypeIndex,
  bygningsTypeNavn: bygningsTypeNavnIndex
});

// Process data and filter for residential buildings
const residentialAddresses = [];
const residentialTypes = [
  '11 - Enebolig',
  '12 - Tomannsbolig', 
  '13 - Rekkehus, kjedehus, andre småhus',
  '14 - Store boligbygg',
  '15 - Bygård',
  '16 - Fritidsbolig',
  '17 - Hytter, sommerhus ol',
  '19 - Annen boligbygning'
];

for (let i = 1; i < lines.length && residentialAddresses.length < 100; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const columns = line.split(';');
  const bygningsType = columns[bygningsTypeIndex];
  const gateAdresse = columns[gateAdresseIndex];
  const byggNr = columns[byggNrIndex];
  
  // Check if it's a residential building
  const isResidential = residentialTypes.some(type => bygningsType && bygningsType.startsWith(type));
  
  // Skip addresses that are "#I/T" or empty
  if (isResidential && gateAdresse && gateAdresse !== '#I/T' && gateAdresse.trim() !== '') {
    residentialAddresses.push({
      address: gateAdresse.trim(),
      buildingNumber: byggNr.trim(),
      buildingType: bygningsType.trim()
    });
  }
}

// Save to file
const outputData = {
  extractedDate: new Date().toISOString(),
  totalAddresses: residentialAddresses.length,
  addresses: residentialAddresses
};

const outputPath = path.join(__dirname, '..', 'first-100-residential-addresses.json');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

console.log(`\nExtracted ${residentialAddresses.length} residential addresses`);
console.log(`Output saved to: ${outputPath}`);

// Also create a simple CSV for easy viewing
const csvOutput = 'Address,BuildingNumber,BuildingType\n' + 
  residentialAddresses.map(addr => 
    `"${addr.address}","${addr.buildingNumber}","${addr.buildingType}"`
  ).join('\n');

const csvOutputPath = path.join(__dirname, '..', 'first-100-residential-addresses.csv');
fs.writeFileSync(csvOutputPath, csvOutput);
console.log(`CSV output saved to: ${csvOutputPath}`);

// Show first 10 as preview
console.log('\nFirst 10 addresses:');
residentialAddresses.slice(0, 10).forEach((addr, i) => {
  console.log(`${i + 1}. ${addr.address} - Building: ${addr.buildingNumber}`);
});

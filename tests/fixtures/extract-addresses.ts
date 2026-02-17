// Utility for å ekstrahere boligadresser fra CSV
// Migrert fra scripts/extract-residential-addresses.cjs

import * as fs from "fs";
import * as path from "path";

interface ResidentialAddress {
  address: string;
  buildingNumber: string;
  buildingType: string;
}

interface ExtractionResult {
  extractedDate: string;
  totalAddresses: number;
  addresses: ResidentialAddress[];
}

const RESIDENTIAL_TYPES = [
  "11 - Enebolig",
  "12 - Tomannsbolig",
  "13 - Rekkehus, kjedehus, andre smahus",
  "14 - Store boligbygg",
  "15 - Bygard",
  "16 - Fritidsbolig",
  "17 - Hytter, sommerhus ol",
  "19 - Annen boligbygning",
];

export function extractResidentialAddresses(
  csvPath: string,
  maxAddresses = 100
): ExtractionResult {
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n");
  const headers = lines[0].split(";");

  // Find column indices
  const byggNrIndex = headers.findIndex((h) => h.includes("BYGNINGS_NR"));
  const gateAdresseIndex = headers.findIndex((h) => h.includes("GateAdresse"));
  const bygningsTypeIndex = headers.findIndex((h) => h === "Bygningstype");

  const residentialAddresses: ResidentialAddress[] = [];

  for (let i = 1; i < lines.length && residentialAddresses.length < maxAddresses; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(";");
    const bygningsType = columns[bygningsTypeIndex];
    const gateAdresse = columns[gateAdresseIndex];
    const byggNr = columns[byggNrIndex];

    // Check if it's a residential building
    const isResidential = RESIDENTIAL_TYPES.some(
      (type) => bygningsType && bygningsType.startsWith(type)
    );

    // Skip addresses that are "#I/T" or empty
    if (
      isResidential &&
      gateAdresse &&
      gateAdresse !== "#I/T" &&
      gateAdresse.trim() !== ""
    ) {
      residentialAddresses.push({
        address: gateAdresse.trim(),
        buildingNumber: byggNr.trim(),
        buildingType: bygningsType.trim(),
      });
    }
  }

  return {
    extractedDate: new Date().toISOString(),
    totalAddresses: residentialAddresses.length,
    addresses: residentialAddresses,
  };
}

export function saveExtractionToFile(
  result: ExtractionResult,
  outputPath: string
): void {
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
}

export function saveExtractionToCsv(
  result: ExtractionResult,
  outputPath: string
): void {
  const csvOutput =
    "Address,BuildingNumber,BuildingType\n" +
    result.addresses
      .map(
        (addr) =>
          `"${addr.address}","${addr.buildingNumber}","${addr.buildingType}"`
      )
      .join("\n");

  fs.writeFileSync(outputPath, csvOutput);
}

// CLI-kjoring
if (import.meta.url === `file://${process.argv[1]}`) {
  const csvPath = path.join(
    process.cwd(),
    "data",
    "raw",
    "matrikkel_bygg_2025.csv"
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV-fil ikke funnet: ${csvPath}`);
    process.exit(1);
  }

  const result = extractResidentialAddresses(csvPath, 100);
  console.log(`Ekstraherte ${result.totalAddresses} boligadresser`);

  const jsonPath = path.join(process.cwd(), "first-100-residential-addresses.json");
  const csvOutputPath = path.join(process.cwd(), "first-100-residential-addresses.csv");

  saveExtractionToFile(result, jsonPath);
  saveExtractionToCsv(result, csvOutputPath);

  console.log(`JSON output: ${jsonPath}`);
  console.log(`CSV output: ${csvOutputPath}`);

  console.log("\nForste 10 adresser:");
  result.addresses.slice(0, 10).forEach((addr, i) => {
    console.log(`${i + 1}. ${addr.address} - Building: ${addr.buildingNumber}`);
  });
}

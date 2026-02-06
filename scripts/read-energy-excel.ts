/**
 * Script for å lese energibehov-data fra Excel-filen
 */
import * as path from 'path';

async function main() {
  // Dynamisk import for xlsx (CommonJS-modul)
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default || xlsxModule;

  const excelPath = path.join(
    process.cwd(),
    'Dokumentasjon/Utvikling/Logikk og input til model (1).xlsx'
  );

  console.log('Leser Excel-fil:', excelPath);

  const workbook = XLSX.readFile(excelPath);

  console.log('\n=== Tilgjengelige faner ===');
  console.log(workbook.SheetNames);

  // Les fanen "Energibehov før tiltak"
  const sheetName = 'Energibehov før tiltak';
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    console.error(`Fanen "${sheetName}" finnes ikke!`);
    console.log('Tilgjengelige faner:', workbook.SheetNames);
    process.exit(1);
  }

  console.log(`\n=== Innhold i "${sheetName}" ===\n`);

  // Konverter til JSON for å se strukturen
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  // Vis de første 20 radene for å forstå strukturen
  console.log('Første 20 rader:');
  for (let i = 0; i < Math.min(20, data.length); i++) {
    console.log(`Rad ${i + 1}:`, data[i]);
  }

  // Spesifikt vis rad 13
  console.log('\n=== RAD 13 (estimerte total-tall) ===');
  if (data[12]) {
    console.log('Rad 13:', data[12]);
  }

  // Vis også rad 1-3 for å forstå kolonne-headers
  console.log('\n=== Headers (rad 1-3) ===');
  for (let i = 0; i < 3; i++) {
    if (data[i]) {
      console.log(`Rad ${i + 1}:`, data[i]);
    }
  }
}

main().catch(console.error);

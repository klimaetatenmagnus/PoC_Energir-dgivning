/**
 * Script for å hente energiattester fra Enova API for flere år
 *
 * Henter CSV-filer fra Enova API for årene 2005-2025, kombinerer dem,
 * filtrerer for Oslo (kommunenummer 0301), og dedupliserer slik at
 * kun det nyeste energimerket per bolig beholdes.
 *
 * Bruk:
 *   npx tsx scripts/fetch-enova-bulk-data.ts
 *
 * Krever:
 *   - API-nøkkel fra Enova (settes i .env som ENOVA_API_KEY)
 *   - Tilgang til Enova API via https://data.enova.no/
 *
 * Output:
 *   - data/raw/enova-energimerker-oslo.csv (deduplisert, kun nyeste per bolig)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT_DIR, 'data/raw');

// Configuration
const START_YEAR = 2005;
const END_YEAR = 2025;
const OSLO_KOMMUNENUMMER = ['0301', '301'];

// API configuration
const API_BASE_URL = 'https://api.data.enova.no/ems/offentlige-data/v1/Fil';
const API_KEY = process.env.ENOVA_API_KEY || '';

interface EnovaApiResponse {
  fromDate: string;
  toDate: string;
  bankFileUrl: string;
}

interface ParsedRow {
  raw: string;
  buildingKey: string;
  registrationDate: string;
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Track if we've shown debug info
let hasShownDebug = false;

// Fetch CSV URL for a specific year
async function fetchCsvUrlForYear(year: number): Promise<EnovaApiResponse | null> {
  // Try both header and query parameter approaches
  const url = `${API_BASE_URL}/${year}?subscription-key=${encodeURIComponent(API_KEY)}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Ocp-Apim-Subscription-Key': API_KEY,
  };

  // Show debug info once
  if (!hasShownDebug) {
    console.log(`   🔑 API-nøkkel: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)} (${API_KEY.length} tegn)`);
    hasShownDebug = true;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Ingen data tilgjengelig`);
        return null;
      }
      if (response.status === 401 || response.status === 403) {
        // Try to get more details from the response
        let errorDetail = '';
        try {
          const errorBody = await response.text();
          if (errorBody) errorDetail = ` - ${errorBody.substring(0, 100)}`;
        } catch { /* ignore */ }
        console.error(`Ugyldig API-nøkkel (${response.status})${errorDetail}`);
        return null;
      }
      console.error(`HTTP-feil ${response.status}`);
      return null;
    }

    const data = (await response.json()) as EnovaApiResponse;
    return data;
  } catch (error) {
    console.error(`   ❌ År ${year}: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
    return null;
  }
}

// Download CSV content from URL
async function downloadCsv(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download CSV: HTTP ${response.status}`);
  }

  return response.text();
}

// Column indices cache
interface ColumnIndices {
  kommunenummer: number;
  bygningsnummer: number;
  registreringsdato: number;
  // Matrikkel columns for fallback key generation
  gardsnummer: number;
  bruksnummer: number;
  festenummer: number;
  seksjonsnummer: number;
}

function findColumnIndices(headerColumns: string[]): ColumnIndices {
  const normalized = headerColumns.map(h => h.toLowerCase().trim());

  return {
    kommunenummer: normalized.findIndex(h =>
      h === 'kommunenummer' || h === 'kommune' || h === 'kommunenr' || h === 'knr'
    ),
    bygningsnummer: normalized.findIndex(h =>
      h === 'bygningsnummer' || h === 'bygningsnr' || h === 'byggnr'
    ),
    registreringsdato: normalized.findIndex(h =>
      h === 'registreringsdato' || h === 'registrertdato' || h === 'dato' ||
      h === 'opprettetdato' || h === 'gyldigfradato' || h === 'utstedtdato'
    ),
    gardsnummer: normalized.findIndex(h =>
      h === 'gardsnummer' || h === 'gårdsnummer' || h === 'gnr'
    ),
    bruksnummer: normalized.findIndex(h =>
      h === 'bruksnummer' || h === 'bnr'
    ),
    festenummer: normalized.findIndex(h =>
      h === 'festenummer' || h === 'fnr'
    ),
    seksjonsnummer: normalized.findIndex(h =>
      h === 'seksjonsnummer' || h === 'snr'
    ),
  };
}

// Generate a unique key for a building
function generateBuildingKey(columns: string[], indices: ColumnIndices, kommunenummer: string): string {
  // Try bygningsnummer first (most reliable)
  if (indices.bygningsnummer !== -1 && columns[indices.bygningsnummer]?.trim()) {
    return `${kommunenummer}-${columns[indices.bygningsnummer].trim()}`;
  }

  // Fallback to matrikkel combination
  const parts = [kommunenummer];
  if (indices.gardsnummer !== -1) parts.push(columns[indices.gardsnummer]?.trim() || '');
  if (indices.bruksnummer !== -1) parts.push(columns[indices.bruksnummer]?.trim() || '');
  if (indices.festenummer !== -1) parts.push(columns[indices.festenummer]?.trim() || '0');
  if (indices.seksjonsnummer !== -1) parts.push(columns[indices.seksjonsnummer]?.trim() || '0');

  return parts.join('-');
}

// Parse CSV and filter for Oslo, returning parsed rows with metadata
function parseAndFilterForOslo(
  csvContent: string,
  existingIndices?: ColumnIndices
): { rows: ParsedRow[]; header: string; indices: ColumnIndices } {
  const lines = csvContent.split('\n');
  const header = lines[0];
  const headerColumns = header.split(',');
  const indices = existingIndices || findColumnIndices(headerColumns);
  const filteredRows: ParsedRow[] = [];

  if (indices.kommunenummer === -1) {
    console.warn('   ⚠️  Kunne ikke finne kommunenummer-kolonne');
    console.warn(`   📋 Tilgjengelige kolonner: ${headerColumns.slice(0, 15).join(', ')}...`);
    return { header, rows: [], indices };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',');
    const kommunenummer = columns[indices.kommunenummer]?.trim();

    if (!OSLO_KOMMUNENUMMER.includes(kommunenummer)) continue;

    const buildingKey = generateBuildingKey(columns, indices, kommunenummer);
    const registrationDate = indices.registreringsdato !== -1
      ? columns[indices.registreringsdato]?.trim() || ''
      : '';

    filteredRows.push({
      raw: line,
      buildingKey,
      registrationDate,
    });
  }

  return { header, rows: filteredRows, indices };
}

// Deduplicate rows, keeping only the newest energy certificate per building
function deduplicateRows(rows: ParsedRow[]): string[] {
  const buildingMap = new Map<string, ParsedRow>();

  for (const row of rows) {
    const existing = buildingMap.get(row.buildingKey);

    if (!existing) {
      buildingMap.set(row.buildingKey, row);
      continue;
    }

    // Compare dates - keep the newer one
    // If no date available, later rows (from newer years) are assumed newer
    if (row.registrationDate && existing.registrationDate) {
      if (row.registrationDate > existing.registrationDate) {
        buildingMap.set(row.buildingKey, row);
      }
    } else {
      // No date comparison possible, keep the newer row (from later in processing)
      buildingMap.set(row.buildingKey, row);
    }
  }

  return Array.from(buildingMap.values()).map(r => r.raw);
}

// Main execution
async function main() {
  console.log('🏠 Enova Energimerke Bulk Data Fetcher');
  console.log('=====================================\n');

  // Check for API key
  if (!API_KEY) {
    console.log('❌ ENOVA_API_KEY er ikke satt i .env\n');
    console.log('For å få API-nøkkel:');
    console.log('');
    console.log('1. Gå til https://data.enova.no/ og registrer deg');
    console.log('   (bruk firmaets navn og felles e-postadresse)');
    console.log('');
    console.log('2. Logg inn og gå til "Products"');
    console.log('');
    console.log('3. Finn "Energimerkesystemet - Offentlige data" og abonner');
    console.log('');
    console.log('4. Gå til din profil og kopier "Primary key" eller "Secondary key"');
    console.log('');
    console.log('5. Legg til i .env:');
    console.log('   ENOVA_API_KEY=din-api-nøkkel-her');
    console.log('');
    console.log('6. Kjør scriptet på nytt:');
    console.log('   npx tsx scripts/fetch-enova-bulk-data.ts');
    console.log('');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Opprettet mappe: ${OUTPUT_DIR}\n`);
  }

  const years = Array.from(
    { length: END_YEAR - START_YEAR + 1 },
    (_, i) => START_YEAR + i
  );

  console.log(`📅 Henter data for ${years.length} år (${START_YEAR}-${END_YEAR})...\n`);

  let combinedHeader = '';
  let columnIndices: ColumnIndices | undefined;
  const allOsloRows: ParsedRow[] = [];
  const yearStats: { year: number; total: number; oslo: number }[] = [];

  for (const year of years) {
    process.stdout.write(`📥 År ${year}: `);

    // Fetch CSV URL from API
    const apiResponse = await fetchCsvUrlForYear(year);

    if (!apiResponse || !apiResponse.bankFileUrl) {
      yearStats.push({ year, total: 0, oslo: 0 });
      continue;
    }

    console.log(`Laster ned fra ${apiResponse.fromDate} til ${apiResponse.toDate}...`);

    try {
      // Download CSV
      const csvContent = await downloadCsv(apiResponse.bankFileUrl);
      const totalRows = csvContent.split('\n').length - 2; // Minus header and empty line

      // Parse and filter for Oslo
      const { header, rows, indices } = parseAndFilterForOslo(csvContent, columnIndices);

      if (!combinedHeader && header) {
        combinedHeader = header;
        columnIndices = indices;

        // Log which columns we found for deduplication
        console.log(`   📋 Kolonner funnet:`);
        if (indices.bygningsnummer !== -1) {
          console.log(`      - Bygningsnummer (kolonne ${indices.bygningsnummer})`);
        }
        if (indices.registreringsdato !== -1) {
          console.log(`      - Registreringsdato (kolonne ${indices.registreringsdato})`);
        }
        if (indices.bygningsnummer === -1 && indices.gardsnummer !== -1) {
          console.log(`      - Matrikkel (gnr/bnr/fnr/snr)`);
        }
      }

      allOsloRows.push(...rows);

      console.log(`   ✅ ${totalRows.toLocaleString()} rader totalt, ${rows.length.toLocaleString()} i Oslo`);
      yearStats.push({ year, total: totalRows, oslo: rows.length });

      // Rate limiting
      await delay(500);
    } catch (error) {
      console.error(`   ❌ Feil ved nedlasting: ${error instanceof Error ? error.message : 'Ukjent feil'}`);
      yearStats.push({ year, total: 0, oslo: 0 });
    }
  }

  // Deduplicate and write combined Oslo data
  if (allOsloRows.length > 0) {
    console.log('\n🔄 Dedupliserer data (beholder kun nyeste per bolig)...');
    const deduplicatedRows = deduplicateRows(allOsloRows);

    const osloOutputPath = resolve(OUTPUT_DIR, 'enova-energimerker-oslo.csv');
    const osloContent = combinedHeader + '\n' + deduplicatedRows.join('\n');
    writeFileSync(osloOutputPath, osloContent, 'utf-8');

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ Ferdig!\n');
    console.log(`📊 Statistikk:`);
    console.log(`   Totalt rader før deduplisering: ${allOsloRows.length.toLocaleString()}`);
    console.log(`   Unike boliger (etter deduplisering): ${deduplicatedRows.length.toLocaleString()}`);
    console.log(`   Duplikater fjernet: ${(allOsloRows.length - deduplicatedRows.length).toLocaleString()}`);
    console.log(`   År med data: ${yearStats.filter(y => y.oslo > 0).length}`);
    console.log(`\n📁 Output lagret til:`);
    console.log(`   ${osloOutputPath}`);

    // Print year summary
    console.log('\n📅 Oversikt per år:\n');
    console.log('| År   | Totalt   | Oslo     |');
    console.log('|------|----------|----------|');
    for (const stat of yearStats) {
      if (stat.total > 0) {
        console.log(
          `| ${stat.year} | ${stat.total.toLocaleString().padStart(8)} | ${stat.oslo.toLocaleString().padStart(8)} |`
        );
      }
    }

    console.log('\n💡 Neste steg:');
    console.log('   Kjør: npx tsx scripts/aggregate-district-statistics.ts');
    console.log('   for å aggregere bydelsstatistikk.');
  } else {
    console.log('\n❌ Ingen data ble hentet.');
    console.log('   Sjekk at API-nøkkelen er korrekt og at du har tilgang til API-et.');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

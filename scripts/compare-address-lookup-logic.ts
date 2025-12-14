/**
 * Testscript for å sammenligne original og forbedret adresseoppslag-logikk
 *
 * Dette scriptet tester adresseoppslag mot en rekke edge-cases for å:
 * 1. Identifisere problemadresser som henger eller gir feil resultat
 * 2. Sammenligne ytelse (tid) mellom original og forbedret logikk
 * 3. Dokumentere eventuelle forskjeller i resultater
 *
 * Bruk:
 *   npx tsx scripts/compare-address-lookup-logic.ts [--verbose] [--timeout=30000] [--address="..."]
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import fetch from 'node-fetch';

// ============================================================================
// TYPES
// ============================================================================

interface BuildingResult {
  gnr?: number;
  bnr?: number;
  bruksarealM2?: number;
  byggeaar?: number;
  bygningstype?: string;
  bygningstypeKode?: string;
  adresse?: string;
  csvData?: {
    bruksarealTotalt?: number;
    bygningstype3siffer?: string;
    bygningstypeNavn?: string;
    bygningsNr?: string;
  };
  sol_kwh_bygg_tot?: number;
  filteredSolarEnergy?: number;
  _meta?: {
    source?: string;
    fallbackUsed?: boolean;
    timeoutOccurred?: boolean;
    csvFallback?: boolean;
  };
}

interface TestResult {
  address: string;
  category: string;
  originalResult: BuildingResult | { error: string };
  improvedResult: BuildingResult | { error: string };
  originalTimeMs: number;
  improvedTimeMs: number;
  differences: string[];
  status: 'pass' | 'fail' | 'improved' | 'regression' | 'timeout';
}

interface TestAddress {
  address: string;
  category: string;
  expectedBehavior: string;
  expectedArea?: number;
  expectedType?: string;
  expectedYear?: number;
}

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_ADDRESSES: TestAddress[] = [
  // Problemadresse - adressen som trigget analysen
  {
    address: 'Kapellveien 156A, 0493 Oslo',
    category: 'problem-garasje',
    expectedBehavior: 'Enebolig + garasje på separat grunneiendom - skal returnere enebolig 205 m²',
    expectedArea: 205,
    expectedType: 'Enebolig',
    expectedYear: 1981,
  },

  // Seksjonert eiendom (samme gatenummer, forskjellige gnr/bnr)
  {
    address: 'Kapellveien 156B, 0493 Oslo',
    category: 'seksjon-standard',
    expectedBehavior: 'Seksjon B på gnr/bnr 73/704 - tomannsbolig',
    expectedArea: 186,
    expectedType: 'Tomannsbolig',
    expectedYear: 1952,
  },
  {
    address: 'Kapellveien 156C, 0493 Oslo',
    category: 'seksjon-standard',
    expectedBehavior: 'Seksjon C på gnr/bnr 73/704 - tomannsbolig',
    expectedArea: 159,
    expectedType: 'Tomannsbolig',
    expectedYear: 1952,
  },
  {
    address: 'Kapellveien 156D, 0493 Oslo',
    category: 'seksjon-standard',
    expectedBehavior: 'Seksjon D på gnr/bnr 73/704 - tomannsbolig',
  },
  {
    address: 'Kapellveien 156E, 0493 Oslo',
    category: 'seksjon-standard',
    expectedBehavior: 'Seksjon E på gnr/bnr 73/704 - tomannsbolig',
  },

  // Rekkehus med bokstav
  {
    address: 'Kjelsåsveien 97B, 0491 Oslo',
    category: 'rekkehus',
    expectedBehavior: 'Rekkehus med flere seksjoner',
  },
  {
    address: 'Kjelsåsveien 97C, 0491 Oslo',
    category: 'rekkehus',
    expectedBehavior: 'Rekkehus med flere seksjoner',
  },

  // Boligblokk
  {
    address: 'Kapellveien 160A, 0493 Oslo',
    category: 'boligblokk',
    expectedBehavior: 'Boligblokk - skal returnere blokk-data',
  },

  // Tomannsbolig
  {
    address: 'Kapellveien 164A, 0493 Oslo',
    category: 'tomannsbolig',
    expectedBehavior: 'Tomannsbolig - separat seksjon',
  },
  {
    address: 'Kapellveien 164B, 0493 Oslo',
    category: 'tomannsbolig',
    expectedBehavior: 'Tomannsbolig - separat seksjon',
  },

  // Enkel enebolig (baseline)
  {
    address: 'Grenseveien 99, 0663 Oslo',
    category: 'baseline-enebolig',
    expectedBehavior: 'Standard enebolig-oppslag - skal fungere normalt',
  },

  // Adresse med kun husnummer (ingen bokstav)
  {
    address: 'Kapellveien 150, 0493 Oslo',
    category: 'uten-bokstav',
    expectedBehavior: 'Adresse uten bokstav-suffiks',
  },

  // Flere bygninger på samme adresse
  {
    address: 'Fallanveien 29, 0491 Oslo',
    category: 'flere-bygninger',
    expectedBehavior: 'Adresse med flere bygninger - skal velge riktig',
  },
];

// ============================================================================
// SERVICE MANAGEMENT
// ============================================================================

interface ManagedProcess {
  name: string;
  child: ChildProcess;
}

const managed: ManagedProcess[] = [];
let shuttingDown = false;

function startService(name: string, args: string[], envOverrides: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, ...envOverrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  managed.push({ name, child });

  child.stdout?.on('data', (data) => {
    if (process.env.VERBOSE === '1') {
      process.stdout.write(`[${name}] ${data}`);
    }
  });
  child.stderr?.on('data', (data) => {
    if (process.env.VERBOSE === '1') {
      process.stderr.write(`[${name}:err] ${data}`);
    }
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = typeof code === 'number' ? `code ${code}` : `signal ${signal ?? 'unknown'}`;
    console.error(`❌ Service ${name} terminated unexpectedly (${reason}).`);
  });

  return child;
}

async function stopAll(timeoutMs = 5_000) {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.allSettled(
    managed.map(async ({ child }) => {
      if (child.killed || child.exitCode !== null) return;
      child.kill('SIGTERM');
      try {
        await Promise.race([
          once(child, 'exit'),
          delay(timeoutMs).then(() => {
            if (child.exitCode === null) child.kill('SIGKILL');
          }),
        ]);
      } catch {
        // ignore
      }
    })
  );
}

async function waitForHttp(name: string, url: string, attempts = 30, intervalMs = 1_000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.status >= 200 && response.status < 400) return;
    } catch {
      // continue
    }
    if (attempt < attempts) {
      console.log(`↻ Venter på ${name}... (${attempt}/${attempts})`);
      await delay(intervalMs);
    }
  }
  throw new Error(`Timeout: ${name} svarte ikke på ${url}`);
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function lookupAddress(
  address: string,
  _useImprovedSelection: boolean,
  timeoutMs: number
): Promise<{ result: BuildingResult | { error: string }; timeMs: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Building-info-service bruker GET /lookup?adresse=...
    const url = `http://localhost:4000/lookup?adresse=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const timeMs = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        result: { error: `HTTP ${response.status}: ${errorBody}` },
        timeMs,
      };
    }

    const result = (await response.json()) as BuildingResult;
    return { result, timeMs };
  } catch (error) {
    clearTimeout(timeoutId);
    const timeMs = Date.now() - start;

    if (error instanceof Error && error.name === 'AbortError') {
      return { result: { error: `TIMEOUT etter ${timeMs} ms` }, timeMs };
    }

    return {
      result: { error: error instanceof Error ? error.message : String(error) },
      timeMs,
    };
  }
}

function compareResults(
  original: BuildingResult | { error: string },
  improved: BuildingResult | { error: string }
): string[] {
  const differences: string[] = [];

  const origIsError = 'error' in original;
  const impIsError = 'error' in improved;

  if (origIsError && !impIsError) {
    differences.push(`Original feilet, forbedret returnerte data`);
    return differences;
  }

  if (!origIsError && impIsError) {
    differences.push(`REGRESJON: Original returnerte data, forbedret feilet: ${(improved as { error: string }).error}`);
    return differences;
  }

  if (origIsError && impIsError) {
    const origErr = (original as { error: string }).error;
    const impErr = (improved as { error: string }).error;
    if (origErr !== impErr) {
      differences.push(`Begge feilet, men med forskjellige feil: "${origErr}" vs "${impErr}"`);
    }
    return differences;
  }

  // Begge returnerte data
  const orig = original as BuildingResult;
  const imp = improved as BuildingResult;

  if (orig.bruksarealM2 !== imp.bruksarealM2) {
    differences.push(`Areal: ${orig.bruksarealM2} → ${imp.bruksarealM2} m²`);
  }
  if (orig.bygningstype !== imp.bygningstype) {
    differences.push(`Type: ${orig.bygningstype} → ${imp.bygningstype}`);
  }
  if (orig.byggeaar !== imp.byggeaar) {
    differences.push(`År: ${orig.byggeaar} → ${imp.byggeaar}`);
  }
  if (orig.gnr !== imp.gnr || orig.bnr !== imp.bnr) {
    differences.push(`Matrikkel: ${orig.gnr}/${orig.bnr} → ${imp.gnr}/${imp.bnr}`);
  }
  if (orig.csvData?.bygningsNr !== imp.csvData?.bygningsNr) {
    differences.push(`BygningsNr: ${orig.csvData?.bygningsNr} → ${imp.csvData?.bygningsNr}`);
  }

  return differences;
}

function determineStatus(
  original: BuildingResult | { error: string },
  improved: BuildingResult | { error: string },
  differences: string[],
  originalTimeMs: number,
  improvedTimeMs: number,
  testAddress: TestAddress
): TestResult['status'] {
  const origIsError = 'error' in original;
  const impIsError = 'error' in improved;
  const origTimeout = origIsError && (original as { error: string }).error.includes('TIMEOUT');
  const impTimeout = impIsError && (improved as { error: string }).error.includes('TIMEOUT');

  // Hvis original timet ut men forbedret ikke - forbedring
  if (origTimeout && !impTimeout) return 'improved';

  // Hvis forbedret timet ut men original ikke - regresjon
  if (!origTimeout && impTimeout) return 'regression';

  // Begge timet ut
  if (origTimeout && impTimeout) return 'timeout';

  // Original feilet, forbedret fungerte - forbedring
  if (origIsError && !impIsError) return 'improved';

  // Original fungerte, forbedret feilet - regresjon
  if (!origIsError && impIsError) return 'regression';

  // Begge feilet
  if (origIsError && impIsError) return 'fail';

  // Begge fungerte - sjekk om forbedret gir bedre resultat
  const imp = improved as BuildingResult;

  // Sjekk mot forventede verdier
  if (testAddress.expectedArea && imp.bruksarealM2 === testAddress.expectedArea) {
    const orig = original as BuildingResult;
    if (orig.bruksarealM2 !== testAddress.expectedArea) {
      return 'improved';
    }
  }

  // Ingen endring eller forbedring verifisert
  if (differences.length === 0) return 'pass';

  // Forskjeller funnet - sjekk om det er forbedring eller regresjon
  if (differences.some(d => d.startsWith('REGRESJON'))) return 'regression';

  return 'pass';
}

async function runTest(
  testAddress: TestAddress,
  timeoutMs: number,
  verbose: boolean
): Promise<TestResult> {
  if (verbose) {
    console.log(`\n🔍 Tester: ${testAddress.address}`);
    console.log(`   Kategori: ${testAddress.category}`);
    console.log(`   Forventet: ${testAddress.expectedBehavior}`);
  }

  // Test original logikk (useImprovedSelection: false)
  const originalLookup = await lookupAddress(testAddress.address, false, timeoutMs);

  // Test forbedret logikk (useImprovedSelection: true)
  const improvedLookup = await lookupAddress(testAddress.address, true, timeoutMs);

  const differences = compareResults(originalLookup.result, improvedLookup.result);
  const status = determineStatus(
    originalLookup.result,
    improvedLookup.result,
    differences,
    originalLookup.timeMs,
    improvedLookup.timeMs,
    testAddress
  );

  return {
    address: testAddress.address,
    category: testAddress.category,
    originalResult: originalLookup.result,
    improvedResult: improvedLookup.result,
    originalTimeMs: originalLookup.timeMs,
    improvedTimeMs: improvedLookup.timeMs,
    differences,
    status,
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function printReport(results: TestResult[]) {
  const pass = results.filter(r => r.status === 'pass').length;
  const improved = results.filter(r => r.status === 'improved').length;
  const regression = results.filter(r => r.status === 'regression').length;
  const fail = results.filter(r => r.status === 'fail').length;
  const timeout = results.filter(r => r.status === 'timeout').length;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    ADRESSEOPPSLAG: SAMMENLIGNING AV LOGIKK                 ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Testet: ${results.length} adresser`.padEnd(77) + '║');
  console.log(`║ Pass: ${pass} | Forbedret: ${improved} | Regresjoner: ${regression} | Feil: ${fail} | Timeout: ${timeout}`.padEnd(77) + '║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');

  for (const result of results) {
    const icon = {
      pass: '✅',
      improved: '🔧',
      regression: '❌',
      fail: '⚠️ ',
      timeout: '⏱️ ',
    }[result.status];

    console.log('║' + ' '.repeat(76) + '║');
    console.log(`║ ${icon} ${result.address}`.padEnd(77) + '║');

    const origIsError = 'error' in result.originalResult;
    const impIsError = 'error' in result.improvedResult;

    if (origIsError) {
      const err = (result.originalResult as { error: string }).error;
      console.log(`║    Original: ${err.substring(0, 60)}`.padEnd(77) + '║');
    } else {
      const orig = result.originalResult as BuildingResult;
      console.log(`║    Original: ${orig.bruksarealM2} m², ${orig.bygningstype || 'ukjent type'}, ${orig.byggeaar || '?'} (${result.originalTimeMs} ms)`.padEnd(77) + '║');
    }

    if (impIsError) {
      const err = (result.improvedResult as { error: string }).error;
      console.log(`║    Forbedret: ${err.substring(0, 60)}`.padEnd(77) + '║');
    } else {
      const imp = result.improvedResult as BuildingResult;
      console.log(`║    Forbedret: ${imp.bruksarealM2} m², ${imp.bygningstype || 'ukjent type'}, ${imp.byggeaar || '?'} (${result.improvedTimeMs} ms)`.padEnd(77) + '║');
    }

    const statusText = {
      pass: 'PASS (identisk resultat)',
      improved: 'FORBEDRET',
      regression: 'REGRESJON',
      fail: 'FEIL (begge feilet)',
      timeout: 'TIMEOUT (begge timet ut)',
    }[result.status];
    console.log(`║    Status: ${statusText}`.padEnd(77) + '║');

    if (result.differences.length > 0) {
      for (const diff of result.differences) {
        console.log(`║      → ${diff}`.padEnd(77) + '║');
      }
    }
  }

  console.log('║' + ' '.repeat(76) + '║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  // Vis tidsoversikt
  const avgOriginal = results.reduce((sum, r) => sum + r.originalTimeMs, 0) / results.length;
  const avgImproved = results.reduce((sum, r) => sum + r.improvedTimeMs, 0) / results.length;

  console.log('\n📊 Tidsstatistikk:');
  console.log(`   Original gjennomsnitt: ${Math.round(avgOriginal)} ms`);
  console.log(`   Forbedret gjennomsnitt: ${Math.round(avgImproved)} ms`);
  console.log(`   Forskjell: ${Math.round(avgOriginal - avgImproved)} ms (${((avgOriginal - avgImproved) / avgOriginal * 100).toFixed(1)}%)`);
}

// ============================================================================
// MAIN
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  let verbose = false;
  let timeoutMs = 30_000;
  let singleAddress: string | null = null;

  for (const arg of args) {
    if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg.startsWith('--timeout=')) {
      timeoutMs = parseInt(arg.split('=')[1] ?? '30000', 10);
    } else if (arg.startsWith('--address=')) {
      singleAddress = arg.split('=').slice(1).join('=');
    }
  }

  return { verbose, timeoutMs, singleAddress };
}

async function main() {
  const { verbose, timeoutMs, singleAddress } = parseArgs();

  if (verbose) {
    process.env.VERBOSE = '1';
  }

  console.log('🧪 Starter sammenligning av adresseoppslag-logikk');
  console.log(`   Timeout per oppslag: ${timeoutMs} ms`);
  console.log(`   Verbose: ${verbose}`);

  // Start nødvendige tjenester
  console.log('\n🚀 Starter tjenester...');

  startService('solar-service', ['--import', 'tsx', 'services/solar-service/index.ts'], {
    SOLAR_SERVICE_MOCK: '1',
  });

  startService('building-info-service', ['--import', 'tsx', 'services/building-info-service/index.ts']);

  // Vent på at tjenestene er klare
  try {
    await waitForHttp('building-info-service', 'http://localhost:4000/health');
    console.log('✅ building-info-service klar');
  } catch (error) {
    console.error('❌ Klarte ikke starte building-info-service:', error);
    throw error;
  }

  // Velg testadresser
  let addressesToTest: TestAddress[];
  if (singleAddress) {
    addressesToTest = [{
      address: singleAddress,
      category: 'manuell-test',
      expectedBehavior: 'Manuelt spesifisert adresse',
    }];
  } else {
    addressesToTest = TEST_ADDRESSES;
  }

  console.log(`\n📋 Kjører ${addressesToTest.length} tester...\n`);

  const results: TestResult[] = [];

  for (const testAddress of addressesToTest) {
    const result = await runTest(testAddress, timeoutMs, verbose);
    results.push(result);

    // Vis fremdrift
    const icon = {
      pass: '✅',
      improved: '🔧',
      regression: '❌',
      fail: '⚠️',
      timeout: '⏱️',
    }[result.status];
    console.log(`${icon} ${result.address} (${result.improvedTimeMs} ms)`);
  }

  printReport(results);

  // Avslutt med exit-kode basert på resultater
  const hasRegression = results.some(r => r.status === 'regression');
  if (hasRegression) {
    console.log('\n❌ Det ble funnet regresjoner!');
    process.exitCode = 1;
  } else {
    console.log('\n✅ Ingen regresjoner funnet.');
  }
}

// Signal handling
const signals: Array<NodeJS.Signals> = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n⚠️  Mottok ${signal}, avslutter...`);
    await stopAll();
    process.exit();
  });
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Uventet feil:', error);
  await stopAll();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ Uventet promise-avvisning:', reason);
  await stopAll();
  process.exit(1);
});

main()
  .catch(async (error) => {
    console.error('❌ Test feilet:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopAll();
  });

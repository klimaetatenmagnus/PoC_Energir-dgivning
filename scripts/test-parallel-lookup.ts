/**
 * Test: Parallellisert resolveBuildingData vs. original sekvensiell versjon
 *
 * Kjorer begge versjoner mot et sett av adresser og sammenligner:
 *   1. Resultatlikhet (alle felter identiske)
 *   2. Tidsbruk (original vs. optimalisert)
 *
 * Krever nettverkstilgang til Kartverket/Enova, og solar-service paa localhost:4003.
 *
 * Bruk:
 *   node --import tsx scripts/test-parallel-lookup.ts
 *   node --import tsx scripts/test-parallel-lookup.ts --address="Hesteskoen 4M, Oslo"
 *   node --import tsx scripts/test-parallel-lookup.ts --quick   # bare 3 adresser
 */

import process from 'node:process';
import { resolveBuildingData } from '../services/building-info-service/matrikkel.ts';
import { resolveBuildingDataOptimized } from './parallel-lookup-candidate.ts';

// ─── Testadresser ────────────────────────────────────────────────────────────
// Miks av enkle og komplekse oppslag. Hesteskoen-adressene er seksjonerte
// eiendommer (rekkehus) som genererer mange SOAP-kall.

const FULL_TEST_ADDRESSES = [
  'Hesteskoen 4M, Oslo',
  'Hesteskoen 4A, Oslo',
  'Hesteskoen 4L, Oslo',
  'Kapellveien 156B, 0493 Oslo',
  'Kapellveien 156C, 0493 Oslo',
  'Fallanveien 29, 0495 Oslo',
  'Grenseveien 99, 0663 Oslo',
  'Dammanns vei 13, Oslo',
  'Bygdoy terrasse 16, Oslo',
  'Stromsborgveien 55B, Oslo',
];

const QUICK_TEST_ADDRESSES = [
  'Hesteskoen 4M, Oslo',
  'Kapellveien 156C, 0493 Oslo',
  'Fallanveien 29, 0495 Oslo',
];

// ─── CLI-argumenter ──────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let addresses: string[] | null = null;
  let quick = false;

  for (const arg of args) {
    if (arg.startsWith('--address=')) {
      addresses = [arg.slice('--address='.length)];
    } else if (arg === '--quick') {
      quick = true;
    }
  }

  if (addresses) return addresses;
  return quick ? QUICK_TEST_ADDRESSES : FULL_TEST_ADDRESSES;
}

// ─── Sammenligningslogikk ────────────────────────────────────────────────────

interface FieldDiff {
  field: string;
  original: unknown;
  optimized: unknown;
}

function deepCompare(
  original: Record<string, unknown>,
  optimized: Record<string, unknown>,
  prefix = ''
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(original), ...Object.keys(optimized)]);

  for (const key of allKeys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const a = original[key];
    const b = optimized[key];

    // Skip _meta – det er timing/debug-info som alltid vil variere
    if (key === '_meta') continue;

    if (a === b) continue;

    // Skip funksjoner (f.eks. representasjonspunkt.toPBE)
    if (typeof a === 'function' || typeof b === 'function') continue;

    if (a === null || a === undefined || b === null || b === undefined) {
      diffs.push({ field: fullKey, original: a, optimized: b });
      continue;
    }

    if (typeof a === 'number' && typeof b === 'number') {
      // Tillat smaa flytallsforskjeller (f.eks. koordinater)
      if (Math.abs(a - b) < 0.001) continue;
      diffs.push({ field: fullKey, original: a, optimized: b });
      continue;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diffs.push({ field: fullKey, original: a, optimized: b });
      }
      continue;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      diffs.push(
        ...deepCompare(
          a as Record<string, unknown>,
          b as Record<string, unknown>,
          fullKey
        )
      );
      continue;
    }

    if (a !== b) {
      diffs.push({ field: fullKey, original: a, optimized: b });
    }
  }

  return diffs;
}

// ─── Kjoring ─────────────────────────────────────────────────────────────────

interface TestResult {
  address: string;
  originalMs: number;
  optimizedMs: number;
  speedup: string;
  diffs: FieldDiff[];
  originalError?: string;
  optimizedError?: string;
}

async function timeCall<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - start) };
}

async function runTest(address: string): Promise<TestResult> {
  console.log(`\n  Tester: ${address}`);

  // Kjor original forst
  let originalResult: Record<string, unknown> | null = null;
  let originalMs = 0;
  let originalError: string | undefined;

  try {
    const r = await timeCall(() => resolveBuildingData(address));
    originalResult = r.result as unknown as Record<string, unknown>;
    originalMs = r.ms;
    console.log(`    Original:    ${originalMs} ms`);
  } catch (err) {
    originalError = err instanceof Error ? err.message : String(err);
    console.log(`    Original:    FEIL - ${originalError}`);
  }

  // Kjor optimalisert
  let optimizedResult: Record<string, unknown> | null = null;
  let optimizedMs = 0;
  let optimizedError: string | undefined;

  try {
    const r = await timeCall(() => resolveBuildingDataOptimized(address));
    optimizedResult = r.result as unknown as Record<string, unknown>;
    optimizedMs = r.ms;
    console.log(`    Optimalisert: ${optimizedMs} ms`);
  } catch (err) {
    optimizedError = err instanceof Error ? err.message : String(err);
    console.log(`    Optimalisert: FEIL - ${optimizedError}`);
  }

  // Sammenlign
  let diffs: FieldDiff[] = [];
  if (originalResult && optimizedResult) {
    diffs = deepCompare(originalResult, optimizedResult);
  } else if (originalError !== optimizedError) {
    diffs = [{ field: '__error__', original: originalError, optimized: optimizedError }];
  }

  const speedup = originalMs > 0
    ? `${((1 - optimizedMs / originalMs) * 100).toFixed(0)}% raskere`
    : 'N/A';

  if (diffs.length === 0) {
    console.log(`    Resultat:    IDENTISK (${speedup})`);
  } else {
    console.log(`    Resultat:    ${diffs.length} AVVIK:`);
    for (const d of diffs) {
      console.log(`      ${d.field}: original=${JSON.stringify(d.original)} vs optimalisert=${JSON.stringify(d.optimized)}`);
    }
  }

  return { address, originalMs, optimizedMs, speedup, diffs, originalError, optimizedError };
}

async function main() {
  const addresses = parseArgs();

  console.log('='.repeat(80));
  console.log('  PARALLELLISERINGS-TEST: Original vs. Optimalisert resolveBuildingData');
  console.log('='.repeat(80));
  console.log(`  Antall adresser: ${addresses.length}`);
  console.log(`  Tidspunkt: ${new Date().toISOString()}`);

  const results: TestResult[] = [];

  for (const address of addresses) {
    const result = await runTest(address);
    results.push(result);
  }

  // ─── Oppsummering ────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('  OPPSUMMERING');
  console.log('='.repeat(80));

  const colAddr = 35;
  const colMs = 12;

  console.log(
    '\n  ' +
    'Adresse'.padEnd(colAddr) +
    'Original'.padStart(colMs) +
    'Optim.'.padStart(colMs) +
    'Speedup'.padStart(colMs) +
    '  Status'
  );
  console.log('  ' + '-'.repeat(colAddr + colMs * 3 + 10));

  let totalOriginal = 0;
  let totalOptimized = 0;
  let totalDiffs = 0;

  for (const r of results) {
    totalOriginal += r.originalMs;
    totalOptimized += r.optimizedMs;
    totalDiffs += r.diffs.length;

    const status = r.diffs.length === 0
      ? (r.originalError ? 'BEGGE FEILET' : 'OK')
      : `${r.diffs.length} avvik`;

    console.log(
      '  ' +
      r.address.substring(0, colAddr - 1).padEnd(colAddr) +
      `${r.originalMs} ms`.padStart(colMs) +
      `${r.optimizedMs} ms`.padStart(colMs) +
      r.speedup.padStart(colMs) +
      `  ${status}`
    );
  }

  console.log('  ' + '-'.repeat(colAddr + colMs * 3 + 10));

  const totalSpeedup = totalOriginal > 0
    ? `${((1 - totalOptimized / totalOriginal) * 100).toFixed(0)}%`
    : 'N/A';

  console.log(
    '  ' +
    'TOTALT'.padEnd(colAddr) +
    `${totalOriginal} ms`.padStart(colMs) +
    `${totalOptimized} ms`.padStart(colMs) +
    totalSpeedup.padStart(colMs) +
    `  ${totalDiffs === 0 ? 'ALLE IDENTISKE' : `${totalDiffs} AVVIK TOTALT`}`
  );

  console.log('');

  if (totalDiffs > 0) {
    console.log('  ADVARSEL: Optimalisert versjon gir IKKE identiske resultater!');
    console.log('  Rett avvikene for du implementerer i produksjonskoden.\n');
    process.exitCode = 1;
  } else {
    console.log('  Alle resultater er identiske. Trygt aa implementere.\n');
  }
}

main().catch((err) => {
  console.error('Uventet feil:', err);
  process.exitCode = 1;
});

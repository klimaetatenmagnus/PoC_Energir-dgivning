#!/usr/bin/env node

/**
 * Sammenlign resultatene fra test-solar-adrid.ts med referanse-CSVene i data/raw/.
 *
 * Kjører CLI-scriptet for definerte adresser, parser konsolloutput og sammenlikner
 * areal/innstråling/filtrert energi mot tall hentet fra referansefilene.
 */

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { TextDecoder } from 'util';

type ScriptMetrics = {
  takAreal: number;
  avgIrr: number;
  totalIrr: number;
  filtered: number;
};

type CsvMetrics = {
  surfaces: number;
  takAreal: number;
  avgIrr: number | null;
  totalIrr: number | null;
  filtered: number;
};

type ComparisonCase = {
  label: string;
  address: string;
  csvPath: string;
  delta: number;
  extraArgs?: string[];
  byggnr?: string;
};

const SOLAR_PANEL_EFFICIENCY = 0.2;
const MIN_RADIATION = 800; // kWh/m²

const CASES: ComparisonCase[] = [
  {
    label: 'Kjelsåsveien 97B',
    address: 'Kjelsåsveien 97B, Oslo',
    csvPath: 'data/raw/Kjels\u00e5sveien 97b.csv',
    delta: 5,
    extraArgs: ['--primary-building'],
    byggnr: '80184506',
  },
  {
    label: 'Kapellveien 156C',
    address: 'Kapellveien 156C, Oslo',
    csvPath: 'data/raw/Kapellveien 156c.csv',
    delta: 5,
    extraArgs: ['--primary-building'],
    byggnr: '80179073',
  },
  {
    label: 'Fallanveien 29',
    address: 'Fallanveien 29, Oslo',
    csvPath: 'data/raw/Fallanveien 29.csv',
    delta: 5,
    extraArgs: ['--primary-building'],
    byggnr: '80190816',
  },
  {
    label: 'Hesteskoen 12K',
    address: 'Hesteskoen 12K, Oslo',
    csvPath: 'data/raw/Hesteskoen12k, 0493 Oslo.csv',
    delta: 5,
    extraArgs: ['--primary-building'],
    byggnr: '81479399',
  },
];

function parseNumber(str: string): number {
  const cleaned = str.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  return Number.parseFloat(cleaned);
}

function runSolarScript(address: string, delta: number, byggnr: string | undefined, extraArgs: string[] = []): ScriptMetrics {
  const result = spawnSync(
    'node',
    [
      '--import',
      'tsx',
      'scripts/test-solar-adrid.ts',
      `--address=${address}`,
      `--delta=${delta}`,
      ...(byggnr ? [`--byggnr=${byggnr}`] : []),
      ...extraArgs,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    throw new Error(
      `Script feilet for adresse "${address}": ${result.stderr || result.stdout}`
    );
  }

  const lines = result.stdout.split(/\r?\n/);
  const metrics: Partial<ScriptMetrics> = {};

  const matchers: Record<keyof ScriptMetrics, RegExp> = {
    takAreal: /Takareal \(m²\):\s*([0-9.,]+)/,
    avgIrr: /Gj\.snitt innstråling \(kWh\/m²·år\):\s*([0-9.,]+)/,
    totalIrr: /Total innstråling \(kWh\/år\):\s*([0-9.,]+)/,
    filtered: /Filtrert solenergi .*:\s*([0-9.,]+)/,
  };

  for (const line of lines) {
    for (const [key, regex] of Object.entries(matchers)) {
      const match = line.match(regex);
      if (match) {
        metrics[key as keyof ScriptMetrics] = Number.parseFloat(
          match[1].replace(/\s+/g, '')
        );
      }
    }
  }

  const missing = Object.entries(metrics)
    .filter(([, value]) => typeof value !== 'number' || Number.isNaN(value))
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Fant ikke alle metrikker i script-output for "${address}". Mangler: ${missing.join(
        ', '
      )}.\nOutput:\n${result.stdout}`
    );
  }

  return metrics as ScriptMetrics;
}

function loadCsvMetrics(path: string): CsvMetrics {
  const buffer = readFileSync(path);
  const decoder = new TextDecoder('latin1');
  const content = decoder.decode(buffer);
  const lines = content.trim().split(/\r?\n/);

  if (lines.length <= 1) {
    throw new Error(`Ingen data i ${path}`);
  }

  let surfaces = 0;
  let sumArea = 0;
  let sumIrrWeighted = 0;
  let filtered = 0;

  const dataLines = lines.slice(1); // hopp over header
  for (const rawLine of dataLines) {
    const line = rawLine.trim();
    if (!line) continue;

    const cells = line.split(';');
    if (cells.length < 3) continue;

    const irr = parseNumber(cells[1]);
    const area = parseNumber(cells[2]);
    if (!Number.isFinite(irr) || !Number.isFinite(area)) continue;

    surfaces += 1;
    sumArea += area;
    sumIrrWeighted += irr * area;

    if (irr > MIN_RADIATION) {
      filtered += irr * area * SOLAR_PANEL_EFFICIENCY;
    }
  }

  if (surfaces === 0) {
    throw new Error(`Fant ingen gyldige flater i ${path}`);
  }

  const avgIrr = sumArea > 0 ? sumIrrWeighted / sumArea : null;

  return {
    surfaces,
    takAreal: sumArea,
    avgIrr,
    totalIrr: sumIrrWeighted,
    filtered,
  };
}

function formatDiff(value: number | null, other: number | null): string {
  if (value === null || other === null) {
    return 'n/a';
  }
  const diff = value - other;
  const pct = other !== 0 ? (diff / other) * 100 : NaN;
  const diffStr = diff.toFixed(2);
  const pctStr = Number.isFinite(pct) ? `${pct.toFixed(2)}%` : 'n/a';
  return `${diffStr} (${pctStr})`;
}

function compareCase(testCase: ComparisonCase): void {
  const script = runSolarScript(testCase.address, testCase.delta, testCase.byggnr, testCase.extraArgs ?? []);
  const csv = loadCsvMetrics(testCase.csvPath);

  console.log(`\nAdresse: ${testCase.label}`);
  console.log(`  Script – Takareal: ${script.takAreal.toFixed(2)} m²`);
  console.log(`  CSV    – Takareal: ${csv.takAreal.toFixed(2)} m²`);
  console.log(`    Avvik: ${formatDiff(script.takAreal, csv.takAreal)}`);

  if (csv.avgIrr !== null) {
    console.log(
      `  Script – Gj.snitt irr: ${script.avgIrr.toFixed(2)} kWh/m²·år`
    );
    console.log(
      `  CSV    – Gj.snitt irr: ${csv.avgIrr.toFixed(2)} kWh/m²·år`
    );
    console.log(`    Avvik: ${formatDiff(script.avgIrr, csv.avgIrr)}`);
  } else {
    console.log('  CSV mangler gjennomsnittlig innstråling.');
  }

  if (csv.totalIrr !== null) {
    console.log(
      `  Script – Total innstråling: ${script.totalIrr.toFixed(2)} kWh/år`
    );
    console.log(
      `  CSV    – Total innstråling: ${csv.totalIrr.toFixed(2)} kWh/år`
    );
    console.log(`    Avvik: ${formatDiff(script.totalIrr, csv.totalIrr)}`);
  } else {
    console.log('  CSV mangler total innstråling.');
  }

  console.log(
    `  Script – Filtrert energi (>800 kWh/m²): ${script.filtered.toFixed(
      2
    )} kWh/år`
  );
  console.log(
    `  CSV    – Filtrert energi (>800 kWh/m²): ${csv.filtered.toFixed(
      2
    )} kWh/år`
  );
  console.log(`    Avvik: ${formatDiff(script.filtered, csv.filtered)}`);
  console.log(`  Antall flater i CSV: ${csv.surfaces}`);
}

async function main() {
  for (const testCase of CASES) {
    try {
      compareCase(testCase);
    } catch (error) {
      console.error(
        `\n❌ Feil ved sammenligning for ${testCase.label}:`,
        error
      );
    }
  }
}

void main();

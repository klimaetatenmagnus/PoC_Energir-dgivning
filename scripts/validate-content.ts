import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';

import { TiltakContentSchema } from '../content/tiltak/schema';
import { TilskuddContentSchema } from '../content/tilskudd/schema';

type ValidationSummary = {
  label: string;
  filesChecked: number;
  filesValid: number;
  errors: { file: string; issues: string[] }[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function readJsonFile(filePath: string) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function validateDirectory(
  relativeDir: string,
  label: string,
  schema: typeof TiltakContentSchema | typeof TilskuddContentSchema
): Promise<ValidationSummary> {
  const dir = path.join(repoRoot, relativeDir);
  const entries = await readdir(dir);
  const jsonFiles = entries.filter((entry) => entry.endsWith('.json'));

  const summary: ValidationSummary = {
    label,
    filesChecked: jsonFiles.length,
    filesValid: 0,
    errors: [],
  };

  for (const fileName of jsonFiles) {
    const fullPath = path.join(dir, fileName);
    try {
      const data = await readJsonFile(fullPath);
      schema.parse(data);
      summary.filesValid += 1;
    } catch (error) {
      if (error instanceof ZodError) {
        summary.errors.push({
          file: `${relativeDir}/${fileName}`,
          issues: error.issues.map(
            (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
          ),
        });
        continue;
      }

      summary.errors.push({
        file: `${relativeDir}/${fileName}`,
        issues: [(error as Error).message],
      });
    }
  }

  return summary;
}

function printSummary(summary: ValidationSummary) {
  console.log(`\n📁 ${summary.label}`);
  console.log(
    `   Valid: ${summary.filesValid}/${summary.filesChecked}${
      summary.errors.length === 0 ? '' : ` (feil i ${summary.errors.length})`
    }`
  );

  if (summary.errors.length === 0) {
    return;
  }

  for (const error of summary.errors) {
    console.error(`\n  ✖ ${error.file}`);
    for (const issue of error.issues) {
      console.error(`     • ${issue}`);
    }
  }
}

async function main() {
  const summaries = await Promise.all([
    validateDirectory('content/tiltak', 'Tiltak', TiltakContentSchema),
    validateDirectory('content/tilskudd', 'Tilskudd', TilskuddContentSchema),
  ]);

  let hasErrors = false;
  for (const summary of summaries) {
    printSummary(summary);
    if (summary.errors.length > 0) {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n❌ En eller flere filer validerte ikke mot schema. Rett opp før publisering.');
    process.exit(1);
  }

  console.log('\n✅ Alle content-filer validerte mot gjeldende schema.');
}

main().catch((error) => {
  console.error('Uventet feil under validering:', error);
  process.exit(1);
});

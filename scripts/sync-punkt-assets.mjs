#!/usr/bin/env node
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const source = path.resolve(
  projectRoot,
  "node_modules/@oslokommune/punkt-assets/dist/icons"
);
const destination = path.resolve(
  projectRoot,
  "public/punkt-assets/icons"
);

async function ensureSourceExists() {
  try {
    await stat(source);
  } catch (error) {
    console.error(
      `[sync:punkt-assets] Fant ikke kilde-mappen ${source}. Har du kjørt npm install?`
    );
    throw error;
  }
}

async function syncIcons() {
  await ensureSourceExists();
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
  console.info(
    `[sync:punkt-assets] Synkroniserte ikoner til ${destination}`
  );
}

syncIcons().catch((error) => {
  console.error("[sync:punkt-assets] Feil under synk:", error);
  process.exitCode = 1;
});

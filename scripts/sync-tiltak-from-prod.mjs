#!/usr/bin/env node

/**
 * Script for å synkronisere tiltak-tekster fra produksjonsløsningen
 * til de lokale JSON-filene i content/tiltak/
 *
 * Henter følgende felt fra produksjon og overskriver lokale verdier:
 * - introParagraphs
 * - buildingTypeParagraphs
 * - variants[].introParagraphs
 * - variants[].buildingTypeParagraphs
 *
 * Kjøring: node scripts/sync-tiltak-from-prod.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, '..', 'content', 'tiltak');
const PROD_BASE_URL = 'https://xn--energinkkelen-hnb.no/config/content/tiltak';

// Liste over felter som skal synkroniseres fra produksjon
const FIELDS_TO_SYNC = ['introParagraphs', 'buildingTypeParagraphs'];
const VARIANT_FIELDS_TO_SYNC = ['introParagraphs', 'buildingTypeParagraphs'];

async function fetchFromProd(tiltakId) {
  const url = `${PROD_BASE_URL}/${tiltakId}.json`;
  console.log(`  Henter fra: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Kunne ikke hente ${tiltakId} fra prod: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getTiltakIds() {
  const files = await fs.readdir(CONTENT_DIR);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

function syncVariants(localVariants, prodVariants) {
  if (!prodVariants || !Array.isArray(prodVariants)) {
    return localVariants;
  }

  // Lag en map over prod-varianter for rask oppslag
  const prodVariantMap = new Map(
    prodVariants.map(v => [v.audience, v])
  );

  return localVariants.map(localVariant => {
    const prodVariant = prodVariantMap.get(localVariant.audience);
    if (!prodVariant) {
      console.log(`    Variant "${localVariant.audience}" finnes ikke i prod, beholder lokal versjon`);
      return localVariant;
    }

    const updatedVariant = { ...localVariant };
    for (const field of VARIANT_FIELDS_TO_SYNC) {
      if (prodVariant[field] !== undefined) {
        console.log(`    Oppdaterer variant.${field} for "${localVariant.audience}"`);
        updatedVariant[field] = prodVariant[field];
      }
    }
    return updatedVariant;
  });
}

async function syncTiltak(tiltakId) {
  console.log(`\nBehandler: ${tiltakId}`);

  // Les lokal fil
  const localPath = path.join(CONTENT_DIR, `${tiltakId}.json`);
  const localContent = await fs.readFile(localPath, 'utf-8');
  const localData = JSON.parse(localContent);

  // Hent fra prod
  let prodData;
  try {
    prodData = await fetchFromProd(tiltakId);
  } catch (error) {
    console.log(`  ADVARSEL: Kunne ikke hente fra prod: ${error.message}`);
    return { id: tiltakId, success: false, error: error.message };
  }

  // Synkroniser hovedfelter
  let hasChanges = false;
  for (const field of FIELDS_TO_SYNC) {
    if (prodData[field] !== undefined) {
      const localJson = JSON.stringify(localData[field]);
      const prodJson = JSON.stringify(prodData[field]);

      if (localJson !== prodJson) {
        console.log(`  Oppdaterer ${field}`);
        localData[field] = prodData[field];
        hasChanges = true;
      } else {
        console.log(`  ${field} er allerede lik prod`);
      }
    }
  }

  // Synkroniser variants
  if (localData.variants && Array.isArray(localData.variants)) {
    const originalVariants = JSON.stringify(localData.variants);
    localData.variants = syncVariants(localData.variants, prodData.variants);

    if (JSON.stringify(localData.variants) !== originalVariants) {
      hasChanges = true;
    }
  }

  // Oppdater metadata
  if (hasChanges) {
    localData.metadata = {
      ...localData.metadata,
      updatedBy: 'sync-from-prod-script',
      updatedAt: new Date().toISOString(),
      changeSummary: 'Synkronisert intro- og byggtypetekster fra produksjon'
    };

    // Skriv tilbake til fil
    await fs.writeFile(
      localPath,
      JSON.stringify(localData, null, 2) + '\n',
      'utf-8'
    );
    console.log(`  Fil oppdatert: ${localPath}`);
  } else {
    console.log(`  Ingen endringer nødvendig`);
  }

  return { id: tiltakId, success: true, hasChanges };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Synkroniserer tiltak-tekster fra produksjon');
  console.log('='.repeat(60));
  console.log(`\nKildedir: ${CONTENT_DIR}`);
  console.log(`Prod-URL: ${PROD_BASE_URL}`);

  const tiltakIds = await getTiltakIds();
  console.log(`\nFant ${tiltakIds.length} tiltak: ${tiltakIds.join(', ')}`);

  const results = [];
  for (const id of tiltakIds) {
    const result = await syncTiltak(id);
    results.push(result);
  }

  // Oppsummering
  console.log('\n' + '='.repeat(60));
  console.log('Oppsummering');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const updated = results.filter(r => r.success && r.hasChanges);
  const unchanged = results.filter(r => r.success && !r.hasChanges);

  console.log(`\nVellykket: ${successful.length}`);
  console.log(`  - Oppdatert: ${updated.length}`);
  console.log(`  - Uendret: ${unchanged.length}`);
  console.log(`Feilet: ${failed.length}`);

  if (updated.length > 0) {
    console.log('\nOppdaterte filer:');
    updated.forEach(r => console.log(`  - ${r.id}`));
  }

  if (failed.length > 0) {
    console.log('\nFeil:');
    failed.forEach(r => console.log(`  - ${r.id}: ${r.error}`));
  }

  console.log('\nFerdig!');
}

main().catch(err => {
  console.error('Kritisk feil:', err);
  process.exit(1);
});

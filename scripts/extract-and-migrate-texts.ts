#!/usr/bin/env npx tsx
/**
 * Script som automatisk ekstraherer hardkodede tekster fra TSX-komponenter
 * og migrerer dem til JSON-filer.
 *
 * Kjør med: npx tsx scripts/extract-and-migrate-texts.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tiltakDir = path.join(
  __dirname,
  '..',
  'src',
  'components',
  'FigmaBlokk',
  'components',
  'Tiltak'
);
const contentDir = path.join(__dirname, '..', 'content', 'tiltak');

interface ExtractedTexts {
  soknadspliktBody: string | null;
  energySourceDescription: string | null;
}

interface ComponentMapping {
  tsxFile: string;
  jsonFile: string;
}

const componentMappings: ComponentMapping[] = [
  { tsxFile: 'Tetting.tsx', jsonFile: 'tetting.json' },
  { tsxFile: 'Ventilasjon.tsx', jsonFile: 'ventilasjon.json' },
  { tsxFile: 'Temperaturstyring.tsx', jsonFile: 'temperaturstyring.json' },
  { tsxFile: 'Varmepumpe.tsx', jsonFile: 'varmepumpe.json' },
  { tsxFile: 'Solenergi.tsx', jsonFile: 'solenergi.json' },
  { tsxFile: 'UtskiftningAvVindu.tsx', jsonFile: 'vinduer.json' },
  { tsxFile: 'EtterisoleringYttervegg.tsx', jsonFile: 'etterisolering-yttervegg.json' },
  { tsxFile: 'IsoleringAvKjellerOgLoft.tsx', jsonFile: 'etterisolering-kjeller-loft.json' }
];

/**
 * Ekstraherer søknadsplikt-teksten fra en TSX-fil.
 * Søker etter tekst i hvit boks - den unike teksten per tiltak.
 *
 * Strukturen i komponentene er:
 * - Hvit boks: Unik søknadsplikt-tekst per tiltak (denne skal ekstraheres)
 * - Blå boks: Generell tekst "Er tiltaket ditt søknadspliktig..." (skal IKKE ekstraheres)
 */
function extractSoknadspliktText(tsxContent: string): string | null {
  // Liste over spesifikke søknadsplikttekster vi leter etter
  // Disse er de unike tekstene i hvit boks, ikke den generelle blå boks-teksten
  const specificPatterns: Array<{ pattern: RegExp; prefix?: string }> = [
    // Tetting
    {
      pattern: /Tetting regnes som vedlikehold og er normalt ikke søknadspliktig[^<\n]+/
    },
    // Ventilasjon
    {
      pattern: /Mindre tiltak som vedlikehold av eksisterende ventiler er normalt ikke søknadspliktig[^<\n]+/
    },
    // Temperaturstyring - kan ha varianter
    {
      pattern: /Temperaturstyring innebærer vanligvis ikke inngrep[^<\n]+/
    },
    // Varmepumpe
    {
      pattern: /Varmepumpe kan være søknadspliktig hvis den endrer fasadens karakter[^<\n]+/
    },
    // Solenergi
    {
      pattern: /Solcelleanlegg er som regel søknadspliktig fordi det regnes som teknisk installasjon[^<\n]+/
    },
    // Vinduer
    {
      pattern: /Vindusoppgradering kan være søknadspliktig[^<\n]+/
    },
    {
      pattern: /Vindusutskifting påvirker fasaden[^<\n]+/
    },
    // Etterisolering yttervegg
    {
      pattern: /Etterisolering som endrer fasaden er søknadspliktig[^<\n]+/
    },
    // Etterisolering kjeller/loft
    {
      pattern: /Etterisolering som ikke endrer bygningens utseende er som regel ikke søknadspliktig[^<\n]+/
    }
  ];

  for (const { pattern, prefix } of specificPatterns) {
    const match = tsxContent.match(pattern);
    if (match) {
      let text = match[0].trim();
      // Fjern eventuelle JSX-uttrykk og whitespace
      text = text.replace(/\s+/g, ' ').trim();
      // Fjern trailing JSX
      text = text.replace(/\s*\{[^}]*$/, '').trim();
      if (prefix) {
        text = prefix + text;
      }
      if (text.length > 50) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Ekstraherer kilde/energySourceDescription fra en TSX-fil.
 * Søker etter tekst i Kilde-tooltip.
 */
function extractEnergySourceDescription(tsxContent: string): string | null {
  // Mønster 1: Søk etter "Besparelsene estimeres" (standard tekst for de fleste tiltak)
  const besparelserMatch = tsxContent.match(
    /Besparelsene estimeres fra datasett basert på bygningstype, bruksareal og teknisk forskrift\.[^<\n]+/
  );
  if (besparelserMatch) {
    return besparelserMatch[0].replace(/\s+/g, ' ').trim();
  }

  // Mønster 2: Søk etter "Data for årlig sol" (solenergi - med lenke)
  // Må håndtere at teksten inneholder en <a> tag
  const solStartMatch = tsxContent.match(
    /Data for årlig solinnst[åa]rlig[^<]+/
  );
  if (solStartMatch) {
    // Finn hele teksten inkludert etter lenken
    const fullSolMatch = tsxContent.match(
      /Data for årlig solinnst[åa]rlig og areal for ulike takflater blir hentet fra Oslo kommunes[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>([^<\n]+)/
    );
    if (fullSolMatch) {
      const url = fullSolMatch[1];
      const linkText = fullSolMatch[2];
      const afterLink = fullSolMatch[3];
      const beforeLink = 'Data for årlig solinnstråling og areal for ulike takflater blir hentet fra Oslo kommunes ';
      const fullText = `${beforeLink}${linkText} (${url})${afterLink}`;
      return fullText.replace(/\s+/g, ' ').trim();
    }
  }

  // Mønster 3: Søk etter resolvedTiltakContent?.energySourceDescription fallback
  const fallbackMatch = tsxContent.match(
    /resolvedTiltakContent\?\.energySourceDescription\s*\?\?\s*['"`]([^'"`]+)['"`]/
  );
  if (fallbackMatch) {
    return fallbackMatch[1].replace(/\s+/g, ' ').trim();
  }

  return null;
}

function extractTextsFromTsx(tsxPath: string): ExtractedTexts {
  const content = fs.readFileSync(tsxPath, 'utf-8');

  return {
    soknadspliktBody: extractSoknadspliktText(content),
    energySourceDescription: extractEnergySourceDescription(content)
  };
}

function updateJsonFile(
  jsonPath: string,
  extracted: ExtractedTexts,
  componentName: string
): boolean {
  if (!fs.existsSync(jsonPath)) {
    console.log(`⚠️  JSON-fil ikke funnet: ${jsonPath}`);
    return false;
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const json = JSON.parse(jsonContent);
  let changed = false;

  // Oppdater søknadsplikt body
  if (extracted.soknadspliktBody) {
    if (!json.accordion) {
      json.accordion = [];
    }

    const soknadspliktIndex = json.accordion.findIndex(
      (item: { id: string }) => item.id === 'soknadsplikt'
    );

    const newBody = [extracted.soknadspliktBody];

    if (soknadspliktIndex >= 0) {
      const currentBody = json.accordion[soknadspliktIndex].body;
      if (JSON.stringify(currentBody) !== JSON.stringify(newBody)) {
        console.log(`  📝 Oppdaterer søknadsplikt-body fra ${componentName}`);
        console.log(`     Gammel: "${(currentBody[0] || '').substring(0, 60)}..."`);
        console.log(`     Ny:     "${extracted.soknadspliktBody.substring(0, 60)}..."`);
        json.accordion[soknadspliktIndex].body = newBody;
        changed = true;
      }
    } else {
      console.log(`  ➕ Legger til søknadsplikt-accordion`);
      json.accordion.push({
        id: 'soknadsplikt',
        title: 'Søknadsplikt',
        body: newBody,
        links: []
      });
      changed = true;
    }
  }

  // Oppdater energySourceDescription
  if (extracted.energySourceDescription) {
    if (json.energySourceDescription !== extracted.energySourceDescription) {
      console.log(`  🔋 Oppdaterer energySourceDescription fra ${componentName}`);
      console.log(`     "${extracted.energySourceDescription.substring(0, 60)}..."`);
      json.energySourceDescription = extracted.energySourceDescription;
      changed = true;
    }
  }

  if (changed) {
    json.metadata = {
      ...json.metadata,
      updatedBy: 'extract-and-migrate-texts',
      updatedAt: new Date().toISOString(),
      changeSummary: 'Automatisk ekstrahert hardkodede tekster fra TSX-komponenter'
    };

    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    return true;
  }

  return false;
}

function main() {
  console.log('🚀 Starter automatisk ekstraksjon av hardkodede tekster...\n');

  let totalUpdated = 0;

  for (const mapping of componentMappings) {
    const tsxPath = path.join(tiltakDir, mapping.tsxFile);
    const jsonPath = path.join(contentDir, mapping.jsonFile);

    console.log(`\n📂 ${mapping.tsxFile} → ${mapping.jsonFile}`);

    if (!fs.existsSync(tsxPath)) {
      console.log(`  ⚠️  TSX-fil ikke funnet: ${tsxPath}`);
      continue;
    }

    const extracted = extractTextsFromTsx(tsxPath);

    if (!extracted.soknadspliktBody && !extracted.energySourceDescription) {
      console.log(`  ℹ️  Ingen tekster funnet å ekstrahere`);
      continue;
    }

    console.log(
      `  Funnet: søknadsplikt=${extracted.soknadspliktBody ? 'ja' : 'nei'}, kilde=${extracted.energySourceDescription ? 'ja' : 'nei'}`
    );

    const updated = updateJsonFile(jsonPath, extracted, mapping.tsxFile);
    if (updated) {
      totalUpdated++;
      console.log(`  ✅ Oppdatert`);
    } else {
      console.log(`  ⏭️  Ingen endringer nødvendig`);
    }
  }

  console.log(`\n✨ Ferdig! ${totalUpdated} JSON-filer ble oppdatert.`);
  console.log('\nNeste steg:');
  console.log('1. Kjør "npm run content:validate" for å verifisere');
  console.log('2. Oppdater TSX-komponentene til å lese fra JSON');
}

main();

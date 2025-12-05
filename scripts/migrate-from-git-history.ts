#!/usr/bin/env npx tsx
/**
 * Script som henter originale hardkodede tekster fra git-historikk
 * og migrerer dem til JSON-filer.
 *
 * Dette scriptet bruker git show for å hente originale TSX-filer
 * fra før migreringen startet, og ekstraherer de korrekte tekstene.
 *
 * Kjør med: npx tsx scripts/migrate-from-git-history.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentDir = path.join(__dirname, '..', 'content', 'tiltak');

// Git commits der originale tekster finnes
const SOKNADSPLIKT_COMMIT = '99487b3'; // "ferdige tiltakskort"
const KILDE_COMMIT = '5f42b5a'; // "ferdige kildebokser på tiltakskortene"

interface ComponentConfig {
  tsxFile: string;
  jsonFile: string;
  hasEnergyCalculation: boolean;
}

const componentConfigs: ComponentConfig[] = [
  { tsxFile: 'Tetting.tsx', jsonFile: 'tetting.json', hasEnergyCalculation: false },
  { tsxFile: 'Ventilasjon.tsx', jsonFile: 'ventilasjon.json', hasEnergyCalculation: false },
  { tsxFile: 'Temperaturstyring.tsx', jsonFile: 'temperaturstyring.json', hasEnergyCalculation: false },
  { tsxFile: 'Varmepumpe.tsx', jsonFile: 'varmepumpe.json', hasEnergyCalculation: false },
  { tsxFile: 'Solenergi.tsx', jsonFile: 'solenergi.json', hasEnergyCalculation: true },
  { tsxFile: 'UtskiftningAvVindu.tsx', jsonFile: 'vinduer.json', hasEnergyCalculation: true },
  { tsxFile: 'EtterisoleringYttervegg.tsx', jsonFile: 'etterisolering-yttervegg.json', hasEnergyCalculation: true },
  { tsxFile: 'IsoleringAvKjellerOgLoft.tsx', jsonFile: 'etterisolering-kjeller-loft.json', hasEnergyCalculation: true }
];

/**
 * Henter fil-innhold fra en spesifikk git-commit
 */
function getFileFromGit(commit: string, filePath: string): string | null {
  try {
    const result = execSync(
      `git show ${commit}:${filePath}`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    return result;
  } catch (error) {
    console.log(`  ⚠️  Kunne ikke hente ${filePath} fra commit ${commit}`);
    return null;
  }
}

/**
 * Ekstraherer søknadsplikt-teksten fra TSX-innhold.
 * Søker etter tekst i den hvite boksen (unik per tiltak).
 */
function extractSoknadspliktText(tsxContent: string): string | null {
  // Søk etter <p style={{ margin: 0 }}> etterfulgt av søknadsplikt-tekst
  // Dette er den hvite boksen med unik tekst per tiltak

  // Mønster som matcher tekst etter <p style={{ margin: 0 }}> i søknadsplikt-seksjonen
  const patterns = [
    // Tetting
    /Tetting regnes som vedlikehold og er normalt ikke søknadspliktig[^<]+/,
    // Ventilasjon
    /Mindre tiltak som vedlikehold av eksisterende ventiler er normalt ikke søknadspliktig[^<]+/,
    // Temperaturstyring
    /Tiltak som å bytte ut ovner, termostater eller sette inn styring er normalt ikke søknadspliktig[^<]+/,
    // Varmepumpe
    /Varmepumpe kan være søknadspliktig hvis den endrer fasadens karakter[^<]+/,
    // Solenergi
    /Solcelleanlegg er som regel søknadspliktig fordi det regnes som teknisk installasjon[^<]+/,
    // Vinduer
    /Mindre arbeider, som vedlikehold av eksisterende vinduer, er ikke søknadspliktig[^<]+/,
    // Etterisolering yttervegg
    /Etterisolering som endrer fasaden er søknadspliktig[^<]+/,
    // Etterisolering kjeller/loft
    /Etterisolering som ikke endrer bygningens utseende er som regel ikke søknadspliktig[^<]+/
  ];

  for (const pattern of patterns) {
    const match = tsxContent.match(pattern);
    if (match) {
      // Rens teksten
      let text = match[0]
        .replace(/\s+/g, ' ')  // Normaliser whitespace
        .replace(/\{[^}]*\}/g, '') // Fjern JSX-uttrykk
        .trim();

      // Fjern trailing punktum hvis det er flere
      text = text.replace(/\.+$/, '.');

      if (text.length > 50) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Ekstraherer kilde/energySourceDescription fra TSX-innhold.
 */
function extractEnergySourceDescription(tsxContent: string, componentName: string): string | null {
  // Spesialhåndtering for Solenergi som har annen tekst
  if (componentName === 'Solenergi.tsx') {
    // Solenergi har en tekst med lenke som må konverteres
    const solMatch = tsxContent.match(
      /Data for årlig solinnst[åa]rlig[^<]+<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>([^<]+)/
    );
    if (solMatch) {
      const url = solMatch[1];
      const linkText = solMatch[2];
      const afterLink = solMatch[3].trim().replace(/^\.\s*/, ''); // Fjern ledende punktum
      const beforeLink = 'Data for årlig solinnstråling og areal for ulike takflater blir hentet fra Oslo kommunes ';
      return `${beforeLink}${linkText} (${url}). ${afterLink}`.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim();
    }

    // Fallback: prøv å finne hele teksten
    const solFallback = tsxContent.match(
      /Data for årlig solinnst[åa]rlig og areal for ulike takflater[^}]+/
    );
    if (solFallback) {
      return solFallback[0]
        .replace(/<[^>]+>/g, '') // Fjern HTML-tags
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // Standard kilde-tekst for andre komponenter
  const standardMatch = tsxContent.match(
    /Besparelsene estimeres fra datasett basert på bygningstype, bruksareal og teknisk forskrift\.[^<]+/
  );
  if (standardMatch) {
    return standardMatch[0].replace(/\s+/g, ' ').trim();
  }

  return null;
}

/**
 * Ekstraherer søknadsplikt-lenker fra TSX-innhold
 */
function extractSoknadspliktLinks(tsxContent: string): Array<{id: string, label: string, url: string}> {
  const links: Array<{id: string, label: string, url: string}> = [];

  // Standard lenker som de fleste tiltak har
  const standardLinks = [
    {
      id: 'pbe-soknadsplikt',
      label: 'Sjekk nærmere om tiltaket ditt er søknadspliktig',
      url: 'https://www.oslo.kommune.no/plan-bygg-og-eiendom/byggesaksveiledning/'
    },
    {
      id: 'pbe-veiledning',
      label: 'Gratis veiledningstime hos Plan- og bygningsetaten for generell informasjon om søknadsplikt',
      url: 'https://www.oslo.kommune.no/plan-bygg-og-eiendom/trenger-du-veiledning/'
    },
    {
      id: 'pbe-konkret',
      label: 'Kontakt Plan- og bygningsetaten for en konkret vurdering av søknadsplikt for ditt tiltak, mot gebyr',
      url: 'https://www.oslo.kommune.no/plan-bygg-og-eiendom/sok-om-a-bygge/forhåndskonferanse/'
    }
  ];

  // Sjekk om disse lenkene finnes i TSX-en
  for (const link of standardLinks) {
    if (tsxContent.includes(link.label) || tsxContent.includes('Sjekk nærmere om tiltaket')) {
      links.push(link);
    }
  }

  // Hvis ingen lenker funnet, returner standard set
  if (links.length === 0) {
    return standardLinks;
  }

  return links;
}

/**
 * Oppdaterer en JSON-fil med ekstraherte tekster
 */
function updateJsonFile(
  jsonPath: string,
  soknadspliktText: string | null,
  energySourceDescription: string | null,
  soknadspliktLinks: Array<{id: string, label: string, url: string}>,
  componentName: string
): boolean {
  if (!fs.existsSync(jsonPath)) {
    console.log(`  ⚠️  JSON-fil ikke funnet: ${jsonPath}`);
    return false;
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const json = JSON.parse(jsonContent);
  let changed = false;

  // Oppdater søknadsplikt accordion
  if (soknadspliktText) {
    if (!json.accordion) {
      json.accordion = [];
    }

    const soknadspliktIndex = json.accordion.findIndex(
      (item: { id: string }) => item.id === 'soknadsplikt'
    );

    const newAccordion = {
      id: 'soknadsplikt',
      title: 'Søknadsplikt og ansvar',
      body: [soknadspliktText],
      links: soknadspliktLinks
    };

    if (soknadspliktIndex >= 0) {
      const currentBody = json.accordion[soknadspliktIndex].body?.[0] || '';
      if (currentBody !== soknadspliktText) {
        console.log(`  📝 Oppdaterer søknadsplikt-body`);
        console.log(`     Gammel: "${currentBody.substring(0, 60)}..."`);
        console.log(`     Ny:     "${soknadspliktText.substring(0, 60)}..."`);
        json.accordion[soknadspliktIndex] = newAccordion;
        changed = true;
      }
    } else {
      console.log(`  ➕ Legger til søknadsplikt-accordion`);
      json.accordion.push(newAccordion);
      changed = true;
    }
  }

  // Oppdater energySourceDescription
  if (energySourceDescription) {
    if (json.energySourceDescription !== energySourceDescription) {
      console.log(`  🔋 Oppdaterer energySourceDescription`);
      console.log(`     "${energySourceDescription.substring(0, 60)}..."`);
      json.energySourceDescription = energySourceDescription;
      changed = true;
    }
  }

  if (changed) {
    json.metadata = {
      ...json.metadata,
      updatedBy: 'migrate-from-git-history',
      updatedAt: new Date().toISOString(),
      changeSummary: 'Migrert originale hardkodede tekster fra git-historikk'
    };

    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    return true;
  }

  return false;
}

function main() {
  console.log('🚀 Starter migrering av tekster fra git-historikk...\n');
  console.log(`   Søknadsplikt-tekster fra commit: ${SOKNADSPLIKT_COMMIT}`);
  console.log(`   Kilde-tekster fra commit: ${KILDE_COMMIT}\n`);

  let totalUpdated = 0;
  const tsxBasePath = 'src/components/FigmaBlokk/components/Tiltak';

  for (const config of componentConfigs) {
    console.log(`\n📂 ${config.tsxFile} → ${config.jsonFile}`);

    const tsxPath = `${tsxBasePath}/${config.tsxFile}`;
    const jsonPath = path.join(contentDir, config.jsonFile);

    // Hent søknadsplikt-tekst fra git
    const soknadspliktTsx = getFileFromGit(SOKNADSPLIKT_COMMIT, tsxPath);
    let soknadspliktText: string | null = null;
    let soknadspliktLinks: Array<{id: string, label: string, url: string}> = [];

    if (soknadspliktTsx) {
      soknadspliktText = extractSoknadspliktText(soknadspliktTsx);
      soknadspliktLinks = extractSoknadspliktLinks(soknadspliktTsx);
      if (soknadspliktText) {
        console.log(`  ✅ Fant søknadsplikt-tekst (${soknadspliktText.length} tegn)`);
      } else {
        console.log(`  ⚠️  Kunne ikke ekstrahere søknadsplikt-tekst`);
      }
    }

    // Hent kilde-tekst fra git (kun for komponenter med energiberegning)
    let energySourceDescription: string | null = null;
    if (config.hasEnergyCalculation) {
      const kildeTsx = getFileFromGit(KILDE_COMMIT, tsxPath);
      if (kildeTsx) {
        energySourceDescription = extractEnergySourceDescription(kildeTsx, config.tsxFile);
        if (energySourceDescription) {
          console.log(`  ✅ Fant kilde-tekst (${energySourceDescription.length} tegn)`);
        } else {
          console.log(`  ⚠️  Kunne ikke ekstrahere kilde-tekst`);
        }
      }
    } else {
      console.log(`  ℹ️  Ingen energiberegning - hopper over kilde-tekst`);
    }

    // Oppdater JSON-fil
    if (soknadspliktText || energySourceDescription) {
      const updated = updateJsonFile(
        jsonPath,
        soknadspliktText,
        energySourceDescription,
        soknadspliktLinks,
        config.tsxFile
      );
      if (updated) {
        totalUpdated++;
        console.log(`  ✅ JSON oppdatert`);
      } else {
        console.log(`  ⏭️  Ingen endringer nødvendig`);
      }
    } else {
      console.log(`  ❌ Ingen tekster funnet å migrere`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✨ Ferdig! ${totalUpdated} JSON-filer ble oppdatert.`);
  console.log(`\nNeste steg:`);
  console.log(`1. Kjør "npm run content:validate" for å verifisere`);
  console.log(`2. Oppdater TSX-komponentene til å lese fra JSON`);
  console.log(`3. Test at tekstene vises korrekt i frontend`);
}

main();

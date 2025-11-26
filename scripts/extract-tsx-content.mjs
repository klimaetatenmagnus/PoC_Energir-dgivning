#!/usr/bin/env node
/**
 * extract-tsx-content.mjs
 *
 * Ekstraherer tekstinnhold fra legacy TSX-komponenter i main-branchen
 * og oppdaterer tilsvarende JSON-filer med det eksakte innholdet.
 *
 * Bruk:
 *   node scripts/extract-tsx-content.mjs varmepumpe
 *   node scripts/extract-tsx-content.mjs varmepumpe --dry-run
 *   node scripts/extract-tsx-content.mjs --all
 *
 * Flagg:
 *   --dry-run    Vis endringer uten å skrive til fil
 *   --all        Kjør for alle tiltak
 *   --diff       Vis diff mellom eksisterende og ekstrahert innhold
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Mapping mellom tiltak-slug og TSX-filnavn (standard)
const TILTAK_MAP = {
  'varmepumpe': 'Varmepumpe.tsx',
  'solenergi': 'Solenergi.tsx',
  'tetting': 'Tetting.tsx',
  'ventilasjon': 'Ventilasjon.tsx',
  'temperaturstyring': 'Temperaturstyring.tsx',
  'vinduer': 'UtskiftningAvVindu.tsx',
  'etterisolering-kjeller-loft': 'IsoleringAvKjellerOgLoft.tsx',
  'etterisolering-yttervegg': 'EtterisoleringYttervegg.tsx'
};

// Mapping mellom tiltak-slug og gul liste TSX-filnavn
const TILTAK_GUL_MAP = {
  'varmepumpe': 'VarmepumpeGul.tsx',
  'solenergi': 'SolenergiGul.tsx',
  'tetting': 'TettingGul.tsx',
  'ventilasjon': 'VentilasjonGul.tsx',
  'temperaturstyring': 'TemperaturstyringGul.tsx',
  'vinduer': 'UtskiftningAvVinduGul.tsx',
  'etterisolering-kjeller-loft': 'IsoleringAvKjellerOgLoftGul.tsx',
  'etterisolering-yttervegg': 'EtterisoleringYtterveggGul.tsx'
};

/**
 * Henter TSX-fil fra main-branchen
 */
function getTsxFromMain(tsxFileName, subFolder = '') {
  const basePath = 'src/components/FigmaBlokk/components/Tiltak';
  const path = subFolder ? `${basePath}/${subFolder}/${tsxFileName}` : `${basePath}/${tsxFileName}`;
  try {
    const content = execSync(`git show main:${path}`, {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT
    });
    return content;
  } catch (error) {
    // Ikke logg feil for gul liste-filer som kanskje ikke finnes
    if (!subFolder) {
      console.error(`Kunne ikke hente ${path} fra main-branchen:`, error.message);
    }
    return null;
  }
}

/**
 * Ekstraherer tekst fra <p>-tagger i TSX
 */
function extractParagraphText(content, startMarker, endMarker) {
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return [];

  const endIdx = endMarker ? content.indexOf(endMarker, startIdx) : content.length;
  const section = content.substring(startIdx, endIdx);

  const paragraphs = [];
  // Match tekst mellom > og </p> eller </ (for self-closing scenarios)
  const pTagRegex = /<p[^>]*>\s*([\s\S]*?)\s*<\/p>/g;
  let match;

  while ((match = pTagRegex.exec(section)) !== null) {
    let text = match[1]
      .replace(/\s+/g, ' ')  // Normaliser whitespace
      .replace(/^\s+|\s+$/g, '')  // Trim
      .replace(/\{[^}]+\}/g, '')  // Fjern JSX-uttrykk
      .trim();

    if (text && text.length > 10) {  // Ignorer korte/tomme strenger
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

/**
 * Ekstraherer tab-innhold fra TSX
 * Støtter flere tab-strukturer: Varmepumpe (Luft-luft, etc.) og Vinduer (Vedlikehold, etc.)
 */
function extractTabContent(tsxContent) {
  const tabs = [];

  // Alle mulige tab-konfigurasjoner
  const allTabConfigs = [
    // Varmepumpe tabs
    { id: 'luft-luft', title: 'Luft-luft', marker: "{activeButton === 'Luft-luft' && (" },
    { id: 'luft-vann', title: 'Luft-vann', marker: "{activeButton === 'Luft-vann' && (" },
    { id: 'vaeske-vann', title: 'Væske-vann', marker: "{activeButton === 'Væske-vann' && (" },
    { id: 'ventilasjon', title: 'Ventilasjon', marker: "{activeButton === 'Ventilasjon' && (" },
    // Vinduer tabs
    { id: 'generelt', title: 'Generelt', marker: "{activeButton === 'Generelt' && (" },
    { id: 'vedlikehold', title: 'Vedlikehold', marker: "{activeButton === 'Vedlikehold' && (" },
    { id: 'oppgradering', title: 'Oppgradering', marker: "{activeButton === 'Oppgradering' && (" },
    { id: 'utskiftning', title: 'Utskiftning', marker: "{activeButton === 'Utskiftning' && (" }
  ];

  for (const config of allTabConfigs) {
    const markerIdx = tsxContent.indexOf(config.marker);
    if (markerIdx === -1) continue;

    // Finn foreignObject-seksjonen rett etter markøren
    const foreignStart = tsxContent.indexOf('<foreignObject', markerIdx);
    if (foreignStart === -1) continue;

    const foreignEnd = tsxContent.indexOf('</foreignObject>', foreignStart);
    if (foreignEnd === -1) continue;

    const section = tsxContent.substring(foreignStart, foreignEnd);

    // Sjekk om denne seksjonen har buildingType-betingelser
    const hasBuildingTypeConditions = section.includes('buildingType');

    if (hasBuildingTypeConditions) {
      // Ekstraher buildingTypeBody for hver byggtype
      const tabData = {
        id: config.id,
        title: config.title,
        body: [],
        buildingTypeBody: {}
      };

      // Ekstraher byggtype-spesifikke tekster
      const buildingTypeExtract = extractBuildingTypeFromSection(section);
      if (Object.keys(buildingTypeExtract).length > 0) {
        tabData.buildingTypeBody = buildingTypeExtract;
      }

      // Ekstraher standard body (tekst før første buildingType-betingelse)
      const firstCondition = section.indexOf('buildingType');
      if (firstCondition !== -1) {
        const beforeCondition = section.substring(0, firstCondition);
        const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
        let match;
        while ((match = pTagRegex.exec(beforeCondition)) !== null) {
          let text = match[1]
            .replace(/<style>[\s\S]*?<\/style>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/\{[^}]+\}/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (text && text.length > 10) {
            tabData.body.push(text);
          }
        }
      }

      if (tabData.body.length > 0 || Object.keys(tabData.buildingTypeBody).length > 0) {
        tabs.push(tabData);
      }
    } else {
      // Ingen buildingType-betingelser - ekstraher all tekst som body
      const paragraphs = [];
      const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
      let match;

      while ((match = pTagRegex.exec(section)) !== null) {
        let text = match[1]
          .replace(/<style>[\s\S]*?<\/style>/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\{[^}]+\}/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (text && text.length > 10) {
          paragraphs.push(text);
        }
      }

      if (paragraphs.length > 0) {
        tabs.push({
          id: config.id,
          title: config.title,
          body: paragraphs
        });
      }
    }
  }

  return tabs;
}

/**
 * Hjelpefunksjon for å ekstrahere buildingType-tekster fra en seksjon
 */
function extractBuildingTypeFromSection(section) {
  const buildingTypes = {};

  const patterns = [
    { key: 'enebolig', patterns: [
      /buildingType\s*&&\s*buildingType\.toLowerCase\(\)\s*===\s*'enebolig'/,
      /buildingType\?\.toLowerCase\(\)\s*===\s*'enebolig'/
    ]},
    { key: 'rekkehus', patterns: [
      /buildingType\.toLowerCase\(\)\s*===\s*'rekkehus'/,
      /buildingType\?\.toLowerCase\(\)\s*===\s*'rekkehus'/
    ]},
    { key: 'tomannsbolig', patterns: [
      /buildingType\.toLowerCase\(\)\s*===\s*'tomannsbolig'/,
      /buildingType\?\.toLowerCase\(\)\s*===\s*'tomannsbolig'/
    ]},
    { key: 'blokk', patterns: [
      /buildingType\.toLowerCase\(\)\s*===\s*'blokk'/,
      /buildingType\?\.toLowerCase\(\)\s*===\s*'blokk'/
    ]}
  ];

  for (const { key, patterns: patternList } of patterns) {
    let match = null;
    for (const pattern of patternList) {
      match = section.match(pattern);
      if (match) break;
    }
    if (!match) continue;

    const conditionStart = section.indexOf(match[0]);
    const searchStart = conditionStart + match[0].length;

    // Finn starten av blokken
    let parenStart = section.indexOf('(', searchStart);
    if (parenStart === -1 || parenStart > searchStart + 100) continue;

    // Parse parentes-blokken
    let depth = 0;
    let blockStart = parenStart;
    let blockEnd = -1;

    for (let i = parenStart; i < section.length; i++) {
      if (section[i] === '(') {
        depth++;
      } else if (section[i] === ')') {
        depth--;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }

    if (blockStart !== -1 && blockEnd !== -1) {
      const block = section.substring(blockStart, blockEnd);
      const paragraphs = [];

      const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
      let pMatch;

      while ((pMatch = pTagRegex.exec(block)) !== null) {
        let text = pMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/\{[^}]+\}/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (text && text.length > 10) {
          paragraphs.push(text);
        }
      }

      if (paragraphs.length > 0) {
        buildingTypes[key] = paragraphs;
      }
    }
  }

  // Ekstraher default/else-blokk (brukes for blokk og andre byggtyper)
  // Finn mønsteret ") : (" som indikerer else-blokken i ternary
  const defaultMatch = extractDefaultBlock(section);
  if (defaultMatch && defaultMatch.length > 0) {
    buildingTypes['default'] = defaultMatch;
  }

  return buildingTypes;
}

/**
 * Ekstraherer default/else-blokken fra en ternary conditional
 * Finner den siste ") : (" og ekstraherer innholdet
 */
function extractDefaultBlock(section) {
  // Finn alle forekomster av ") : (" som indikerer else-blokk
  const elsePattern = /\)\s*:\s*\(/g;
  let lastElseMatch = null;
  let match;

  while ((match = elsePattern.exec(section)) !== null) {
    lastElseMatch = match;
  }

  if (!lastElseMatch) return null;

  // Finn starten av else-blokken (etter ": (")
  const elseStart = lastElseMatch.index + lastElseMatch[0].length - 1; // -1 for å inkludere åpningsparentesen

  // Parse parentes-blokken
  let depth = 0;
  let blockStart = elseStart;
  let blockEnd = -1;

  for (let i = elseStart; i < section.length; i++) {
    if (section[i] === '(') {
      depth++;
    } else if (section[i] === ')') {
      depth--;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }

  if (blockStart === -1 || blockEnd === -1) return null;

  const block = section.substring(blockStart, blockEnd);
  const paragraphs = [];

  const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let pMatch;

  while ((pMatch = pTagRegex.exec(block)) !== null) {
    let text = pMatch[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\{[^}]+\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text && text.length > 10) {
      paragraphs.push(text);
    }
  }

  return paragraphs.length > 0 ? paragraphs : null;
}

/**
 * Ekstraherer byggtype-spesifikke avsnitt
 * Håndterer både tiltak med tabs og uten tabs
 */
function extractBuildingTypeParagraphs(tsxContent) {
  const buildingTypes = {};

  // Patterns for byggtype-betingelser - støtter flere syntakser
  const patterns = [
    { key: 'enebolig', patterns: [
      /buildingType\?\.toLowerCase\(\)\s*===\s*'enebolig'/,
      /buildingType\s*&&\s*buildingType\.toLowerCase\(\)\s*===\s*'enebolig'/
    ]},
    { key: 'rekkehus', patterns: [
      /buildingType\?\.toLowerCase\(\)\s*===\s*'rekkehus'/,
      /buildingType\s*&&\s*\(buildingType\.toLowerCase\(\)\s*===\s*'rekkehus'/
    ]},
    { key: 'tomannsbolig', patterns: [
      /buildingType\?\.toLowerCase\(\)\s*===\s*'tomannsbolig'/,
      /buildingType\.toLowerCase\(\)\s*===\s*'tomannsbolig'/
    ]},
    { key: 'leilighet', patterns: [
      /buildingType\?\.toLowerCase\(\)\s*===\s*'leilighet'/,
      /buildingType\.toLowerCase\(\)\s*===\s*'leilighet'/
    ]},
    { key: 'blokk', patterns: [
      /buildingType\?\.toLowerCase\(\)\s*===\s*'blokk'/,
      /buildingType\.toLowerCase\(\)\s*===\s*'blokk'/
    ]},
  ];

  // Finn innholdsseksjonen - enten Generelt-fanen eller første foreignObject
  let contentSection;
  const genereltStart = tsxContent.indexOf("activeButton === 'Generelt'");

  if (genereltStart !== -1) {
    const foreignStart = tsxContent.indexOf('<foreignObject', genereltStart);
    const foreignEnd = tsxContent.indexOf('</foreignObject>', foreignStart);
    contentSection = tsxContent.substring(foreignStart, foreignEnd);
  } else {
    const foreignStart = tsxContent.indexOf('<foreignObject');
    if (foreignStart === -1) return buildingTypes;
    const foreignEnd = tsxContent.indexOf('</foreignObject>', foreignStart);
    contentSection = tsxContent.substring(foreignStart, foreignEnd);
  }

  for (const { key, patterns: patternList } of patterns) {
    let match = null;
    for (const pattern of patternList) {
      match = contentSection.match(pattern);
      if (match) break;
    }
    if (!match) continue;

    const conditionStart = contentSection.indexOf(match[0]);

    // Finn tilhørende JSX-blokk - søk etter ( etter betingelsen
    let searchStart = conditionStart + match[0].length;

    // Finn starten av blokken (første ( etter ? eller &&)
    let parenStart = contentSection.indexOf('(', searchStart);
    if (parenStart === -1 || parenStart > searchStart + 50) {
      // Prøv alternativ: finn neste <p> tag
      const nextP = contentSection.indexOf('<p', searchStart);
      if (nextP !== -1) {
        // Finn slutten av denne <p>-blokken
        const pEnd = contentSection.indexOf('</p>', nextP);
        if (pEnd !== -1) {
          const pContent = contentSection.substring(nextP, pEnd + 4);
          const text = pContent
            .replace(/<[^>]+>/g, '')
            .replace(/\{[^}]+\}/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (text && text.length > 10) {
            buildingTypes[key] = [text];
          }
        }
      }
      continue;
    }

    // Parse parentes-blokken
    let depth = 0;
    let blockStart = parenStart;
    let blockEnd = -1;

    for (let i = parenStart; i < contentSection.length; i++) {
      if (contentSection[i] === '(') {
        depth++;
      } else if (contentSection[i] === ')') {
        depth--;
        if (depth === 0) {
          blockEnd = i;
          break;
        }
      }
    }

    if (blockStart !== -1 && blockEnd !== -1) {
      const block = contentSection.substring(blockStart, blockEnd);
      const paragraphs = [];

      const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
      let pMatch;

      while ((pMatch = pTagRegex.exec(block)) !== null) {
        let text = pMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/\{[^}]+\}/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (text && text.length > 10) {
          paragraphs.push(text);
        }
      }

      if (paragraphs.length > 0) {
        buildingTypes[key] = paragraphs;
      }
    }
  }

  // Ekstraher default/else-blokk (brukes for blokk og andre byggtyper)
  const defaultParagraphs = extractDefaultBlock(contentSection);
  if (defaultParagraphs && defaultParagraphs.length > 0) {
    buildingTypes['default'] = defaultParagraphs;
  }

  return buildingTypes;
}

/**
 * Ekstraherer intro-avsnitt (første <p> som ikke er betinget)
 * Håndterer både tiltak med tabs (activeButton) og uten tabs
 */
function extractIntroParagraphs(tsxContent) {
  let contentSection;

  // Sjekk om dette er et tiltak med tabs (Varmepumpe-struktur)
  const genereltStart = tsxContent.indexOf("activeButton === 'Generelt'");

  if (genereltStart !== -1) {
    // Tiltak med tabs - finn Generelt-seksjonen
    const foreignStart = tsxContent.indexOf('<foreignObject', genereltStart);
    const foreignEnd = tsxContent.indexOf('</foreignObject>', foreignStart);
    contentSection = tsxContent.substring(foreignStart, foreignEnd);
  } else {
    // Tiltak uten tabs - finn første foreignObject med tekstinnhold
    const foreignStart = tsxContent.indexOf('<foreignObject');
    if (foreignStart === -1) return [];

    const foreignEnd = tsxContent.indexOf('</foreignObject>', foreignStart);
    contentSection = tsxContent.substring(foreignStart, foreignEnd);
  }

  // Finn første <p> som ikke er inne i en betingelse
  const firstPStart = contentSection.indexOf('<p style=');
  if (firstPStart === -1) return [];

  // Sjekk om dette er før første buildingType-betingelse
  // Støtter både "buildingType?" og "buildingType &&" patterns
  const condition1 = contentSection.indexOf('buildingType?');
  const condition2 = contentSection.indexOf('buildingType &&');
  const firstCondition = Math.min(
    condition1 !== -1 ? condition1 : Infinity,
    condition2 !== -1 ? condition2 : Infinity
  );

  const introParagraphs = [];

  // Ekstraher tekst fra ubetingede <p>-tagger
  const sectionBeforeConditions = firstCondition !== Infinity
    ? contentSection.substring(0, firstCondition)
    : contentSection;

  const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let match;

  while ((match = pTagRegex.exec(sectionBeforeConditions)) !== null) {
    let text = match[1]
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\{[^}]+\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text && text.length > 20) {
      introParagraphs.push(text);
    }
  }

  return introParagraphs;
}

/**
 * Ekstraherer fordeler (benefits) fra TSX
 */
function extractBenefits(tsxContent) {
  const benefits = [];

  // Finn tekst-elementer med grønn bakgrunn (#C7F6C9)
  const benefitPatterns = [
    /Redusert støy/,
    /Ivaretar boligen/,
    /Bedre bokvalitet/,
    /Lavere strømregning/,
    /Bedre inneklima/,
    /Mer komfort/,
    /Sparer energi/,
    /Økt verdi/
  ];

  for (const pattern of benefitPatterns) {
    const match = tsxContent.match(pattern);
    if (match) {
      benefits.push({
        title: match[0],
        // Beskrivelser finnes ikke i TSX, beholder fra JSON
        description: null
      });
    }
  }

  return benefits;
}

/**
 * Hovedfunksjon for ekstraksjon fra én TSX-fil
 */
function extractFromTsx(slug) {
  const tsxFileName = TILTAK_MAP[slug];
  if (!tsxFileName) {
    console.error(`Ukjent tiltak: ${slug}`);
    return null;
  }

  console.log(`\nHenter ${tsxFileName} fra main-branchen...`);
  const tsxContent = getTsxFromMain(tsxFileName);
  if (!tsxContent) return null;

  console.log(`Ekstraherer innhold fra ${tsxFileName}...`);

  const extracted = {
    introParagraphs: extractIntroParagraphs(tsxContent),
    buildingTypeParagraphs: extractBuildingTypeParagraphs(tsxContent),
    tabs: extractTabContent(tsxContent),
    benefits: extractBenefits(tsxContent)
  };

  return extracted;
}

/**
 * Ekstraherer innhold fra gul liste TSX-fil
 */
function extractFromGulListeTsx(slug) {
  const gulFileName = TILTAK_GUL_MAP[slug];
  if (!gulFileName) {
    return null;
  }

  console.log(`\nHenter ${gulFileName} fra main-branchen (gul liste)...`);
  const gulContent = getTsxFromMain(gulFileName, 'GulListeTiltak');
  if (!gulContent) {
    console.log(`   (Ingen gul liste-fil funnet for ${slug})`);
    return null;
  }

  console.log(`Ekstraherer gul liste-innhold fra ${gulFileName}...`);

  const extracted = {
    introParagraphs: extractIntroParagraphs(gulContent),
    buildingTypeParagraphs: extractBuildingTypeParagraphs(gulContent),
    tabs: extractTabContent(gulContent)
  };

  return extracted;
}

/**
 * Oppdaterer JSON-fil med ekstrahert innhold
 */
function updateJsonFile(slug, extracted, extractedGul, dryRun = false) {
  const jsonPath = join(PROJECT_ROOT, 'content', 'tiltak', `${slug}.json`);

  if (!existsSync(jsonPath)) {
    console.error(`JSON-fil finnes ikke: ${jsonPath}`);
    return false;
  }

  const jsonContent = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const originalJson = JSON.stringify(jsonContent, null, 2);

  // === STANDARD INNHOLD ===

  // Oppdater introParagraphs hvis ekstrahert
  if (extracted.introParagraphs.length > 0) {
    console.log(`\n📝 introParagraphs (standard):`);
    console.log(`   Eksisterende: ${JSON.stringify(jsonContent.introParagraphs).substring(0, 100)}...`);
    console.log(`   Ekstrahert:   ${JSON.stringify(extracted.introParagraphs).substring(0, 100)}...`);
    jsonContent.introParagraphs = extracted.introParagraphs;
  }

  // Oppdater buildingTypeParagraphs
  if (Object.keys(extracted.buildingTypeParagraphs).length > 0) {
    console.log(`\n📝 buildingTypeParagraphs (standard):`);
    for (const [key, value] of Object.entries(extracted.buildingTypeParagraphs)) {
      console.log(`   ${key}: ${JSON.stringify(value).substring(0, 80)}...`);
      jsonContent.buildingTypeParagraphs[key] = value;
    }
  }

  // Oppdater tabs (for tiltak som har tabs)
  if (extracted.tabs.length > 0 && jsonContent.tabs) {
    console.log(`\n📝 tabs (standard):`);

    // For vinduer: inkluder generelt-tab, for andre: ekskluder den
    const contentTabs = extracted.tabs;

    if (contentTabs.length > 0) {
      // Oppdater eksisterende tabs-struktur
      for (const tabSection of jsonContent.tabs) {
        if (tabSection.tabs) {
          for (const tab of tabSection.tabs) {
            const extractedTab = contentTabs.find(t =>
              t.id === tab.id ||
              t.title.toLowerCase() === tab.title.toLowerCase()
            );
            if (extractedTab) {
              // Oppdater body - bruk default fra buildingTypeBody hvis ingen eksplisitt body
              if (extractedTab.body && extractedTab.body.length > 0) {
                console.log(`   ${tab.title} body: ${JSON.stringify(extractedTab.body).substring(0, 60)}...`);
                tab.body = extractedTab.body;
              } else if (extractedTab.buildingTypeBody?.default?.length > 0) {
                // Bruk default-teksten som body (fallback for blokk etc.)
                console.log(`   ${tab.title} body (fra default): ${JSON.stringify(extractedTab.buildingTypeBody.default).substring(0, 60)}...`);
                tab.body = extractedTab.buildingTypeBody.default;
              }
              // Oppdater buildingTypeBody hvis det finnes
              if (extractedTab.buildingTypeBody && Object.keys(extractedTab.buildingTypeBody).length > 0) {
                console.log(`   ${tab.title} buildingTypeBody: ${Object.keys(extractedTab.buildingTypeBody).join(', ')}`);
                // Kopier alle unntatt 'default' til buildingTypeBody (default er nå i body)
                const filteredBuildingTypeBody = {};
                for (const [key, value] of Object.entries(extractedTab.buildingTypeBody)) {
                  if (key !== 'default') {
                    filteredBuildingTypeBody[key] = value;
                  }
                }
                if (Object.keys(filteredBuildingTypeBody).length > 0) {
                  tab.buildingTypeBody = filteredBuildingTypeBody;
                }
              }
            }
          }
        }
      }
    }
  }

  // === GUL LISTE-INNHOLD ===

  if (extractedGul && jsonContent.variants) {
    // Finn gul liste-varianten
    const gulVariant = jsonContent.variants.find(v => v.audience === 'gulliste');

    if (gulVariant) {
      console.log(`\n🟡 GUL LISTE-VARIANT:`);

      // Oppdater introParagraphs for gul liste
      if (extractedGul.introParagraphs.length > 0) {
        console.log(`\n📝 introParagraphs (gulliste):`);
        console.log(`   Eksisterende: ${JSON.stringify(gulVariant.introParagraphs || []).substring(0, 100)}...`);
        console.log(`   Ekstrahert:   ${JSON.stringify(extractedGul.introParagraphs).substring(0, 100)}...`);
        gulVariant.introParagraphs = extractedGul.introParagraphs;
      }

      // Oppdater buildingTypeParagraphs for gul liste
      if (Object.keys(extractedGul.buildingTypeParagraphs).length > 0) {
        console.log(`\n📝 buildingTypeParagraphs (gulliste):`);
        if (!gulVariant.buildingTypeParagraphs) {
          gulVariant.buildingTypeParagraphs = {};
        }
        for (const [key, value] of Object.entries(extractedGul.buildingTypeParagraphs)) {
          console.log(`   ${key}: ${JSON.stringify(value).substring(0, 80)}...`);
          gulVariant.buildingTypeParagraphs[key] = value;
        }
      }

      // Oppdater tabs for gul liste (hvis de finnes)
      if (extractedGul.tabs.length > 0 && gulVariant.tabs) {
        console.log(`\n📝 tabs (gulliste):`);
        const contentTabs = extractedGul.tabs;

        if (contentTabs.length > 0) {
          for (const tabSection of gulVariant.tabs) {
            if (tabSection.tabs) {
              for (const tab of tabSection.tabs) {
                const extractedTab = contentTabs.find(t =>
                  t.id === tab.id ||
                  t.title.toLowerCase() === tab.title.toLowerCase()
                );
                if (extractedTab) {
                  // Oppdater body - bruk default fra buildingTypeBody hvis ingen eksplisitt body
                  if (extractedTab.body && extractedTab.body.length > 0) {
                    console.log(`   ${tab.title} body: ${JSON.stringify(extractedTab.body).substring(0, 60)}...`);
                    tab.body = extractedTab.body;
                  } else if (extractedTab.buildingTypeBody?.default?.length > 0) {
                    console.log(`   ${tab.title} body (fra default): ${JSON.stringify(extractedTab.buildingTypeBody.default).substring(0, 60)}...`);
                    tab.body = extractedTab.buildingTypeBody.default;
                  }
                  if (extractedTab.buildingTypeBody && Object.keys(extractedTab.buildingTypeBody).length > 0) {
                    console.log(`   ${tab.title} buildingTypeBody: ${Object.keys(extractedTab.buildingTypeBody).join(', ')}`);
                    // Kopier alle unntatt 'default' til buildingTypeBody
                    const filteredBuildingTypeBody = {};
                    for (const [key, value] of Object.entries(extractedTab.buildingTypeBody)) {
                      if (key !== 'default') {
                        filteredBuildingTypeBody[key] = value;
                      }
                    }
                    if (Object.keys(filteredBuildingTypeBody).length > 0) {
                      tab.buildingTypeBody = filteredBuildingTypeBody;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      console.log(`\n⚠️  Ingen gulliste-variant funnet i JSON for ${slug}`);
    }
  }

  const updatedJson = JSON.stringify(jsonContent, null, 2);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - Ingen filer ble endret');
    if (originalJson !== updatedJson) {
      console.log('\nEndringer som ville blitt gjort:');
      // Vis enkel diff
      const origLines = originalJson.split('\n');
      const newLines = updatedJson.split('\n');
      for (let i = 0; i < Math.max(origLines.length, newLines.length); i++) {
        if (origLines[i] !== newLines[i]) {
          if (origLines[i]) console.log(`- ${origLines[i]}`);
          if (newLines[i]) console.log(`+ ${newLines[i]}`);
        }
      }
    } else {
      console.log('\nIngen endringer å gjøre.');
    }
  } else {
    if (originalJson !== updatedJson) {
      writeFileSync(jsonPath, updatedJson, 'utf-8');
      console.log(`\n✅ Oppdatert: ${jsonPath}`);
    } else {
      console.log(`\n✅ Ingen endringer nødvendig for ${jsonPath}`);
    }
  }

  return true;
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const runAll = args.includes('--all');
  const skipGul = args.includes('--skip-gul');

  const slugs = runAll
    ? Object.keys(TILTAK_MAP)
    : args.filter(a => !a.startsWith('--'));

  if (slugs.length === 0) {
    console.log('Bruk: node scripts/extract-tsx-content.mjs <tiltak-slug> [--dry-run] [--skip-gul]');
    console.log('      node scripts/extract-tsx-content.mjs --all [--dry-run] [--skip-gul]');
    console.log('\nFlagg:');
    console.log('  --dry-run   Vis endringer uten å skrive til fil');
    console.log('  --skip-gul  Hopp over gul liste-varianter');
    console.log('  --all       Kjør for alle tiltak');
    console.log('\nTilgjengelige tiltak:');
    for (const slug of Object.keys(TILTAK_MAP)) {
      console.log(`  - ${slug}`);
    }
    process.exit(1);
  }

  for (const slug of slugs) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Behandler: ${slug}`);
    console.log('='.repeat(60));

    // Ekstraher standard innhold
    const extracted = extractFromTsx(slug);
    if (!extracted) continue;

    // Ekstraher gul liste-innhold (hvis ikke --skip-gul)
    let extractedGul = null;
    if (!skipGul) {
      extractedGul = extractFromGulListeTsx(slug);
    }

    // Oppdater JSON-fil med begge
    updateJsonFile(slug, extracted, extractedGul, dryRun);
  }

  console.log('\n✅ Ferdig!');
}

main();

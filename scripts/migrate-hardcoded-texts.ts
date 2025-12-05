#!/usr/bin/env npx tsx
/**
 * Migreringsscript for hardkodede tekster i tiltakskomponenter
 *
 * Dette scriptet:
 * 1. Ekstraherer hardkodede søknadsplikt-tekster fra React-komponentene
 * 2. Legger til energySourceDescription der det er relevant
 * 3. Oppdaterer JSON-filene med de korrekte tekstene
 *
 * Kjør med: npx tsx scripts/migrate-hardcoded-texts.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentDir = path.join(__dirname, '..', 'content', 'tiltak');

// Mapping av hardkodede tekster fra komponentene
// Disse er ekstrahert manuelt fra React-komponentene

interface MigrationData {
  jsonFile: string;
  soknadspliktBody: string[];
  energySourceDescription?: string;
}

const migrations: MigrationData[] = [
  {
    jsonFile: 'tetting.json',
    soknadspliktBody: [
      'Tetting regnes som vedlikehold og er normalt ikke søknadspliktig, så lenge tiltaket ikke endrer bygningens uttrykk, fasade eller detaljer. Inngrep som påvirker verneverdige vinduer eller dører, kan likevel være søknadspliktige. Er du i tvil, eller planlegger å gjøre inngrep i eldre konstruksjoner, kan du ta kontakt med Byantikvaren for gratis veiledning før du setter i gang. Du kan også kontakte Plan- og bygningsetaten og mot gebyr få en konkret vurdering av søknadsplikt.'
    ]
    // Tetting har ikke energiberegninger
  },
  {
    jsonFile: 'ventilasjon.json',
    soknadspliktBody: [
      'Mindre tiltak som vedlikehold av eksisterende ventiler er normalt ikke søknadspliktig. Hvis du skal installere nytt ventilasjonsanlegg, eller gjøre inngrep i fasaden eller i konstruksjonen, er det vanligvis søknadspliktig. Plan- og bygningsetaten gir nærmere veiledning om søknadsplikt og eventuelt om du må kontakte en fagperson (arkitekt, byggmester eller entreprenør) til å hjelpe deg.'
    ]
    // Ventilasjon har ikke energiberegninger
  },
  {
    jsonFile: 'temperaturstyring.json',
    soknadspliktBody: [
      'Temperaturstyring innebærer vanligvis ikke inngrep i byggets konstruksjon eller fasade, og er derfor sjelden søknadspliktig. Installasjon av termostater, smarte styringsenheter eller oppgradering av eksisterende varmeanlegg regnes som normalt vedlikehold. Hvis du er usikker på om tiltaket ditt krever søknad, kan du kontakte Plan- og bygningsetaten for veiledning.'
    ]
    // Temperaturstyring har ikke energiberegninger (placeholder)
  },
  {
    jsonFile: 'varmepumpe.json',
    soknadspliktBody: [
      'Varmepumpe kan være søknadspliktig hvis den endrer fasadens karakter. Om det endrer fasadens karakter eller ikke vurderes fra sak til sak. Større installasjoner regnes ofte som byggteknisk installasjon, som også er søknadspliktig. Plan- og bygningsetaten gir veiledning om søknadsplikt og eventuelt om du må kontakte en fagperson (arkitekt, byggmester eller entreprenør) til å hjelpe deg.'
    ]
    // Varmepumpe har placeholder for energiberegninger
  },
  {
    jsonFile: 'solenergi.json',
    soknadspliktBody: [
      'Solcelleanlegg er som regel søknadspliktig fordi det regnes som teknisk installasjon og fasadeendring. Du må derfor kontakte en fagperson (arkitekt, byggmester eller entreprenør) som søker om tillatelse fra Plan- og bygningsetaten for deg. Ved søknad om solenergianlegg får du 100% rabatt for saksbehandling, samt ved forespørsel om søknadsplikt.'
    ],
    energySourceDescription:
      'Data for årlig solinnstråling og areal for ulike takflater blir hentet fra Oslo kommunes Solkart (https://od2.pbe.oslo.kommune.no/solkart/). For alle takflater med årlig solpotensial over 800 kWh/m², så summeres produktene av innstrålingen og takflatearealet. Deretter antas det at 85% av takarealet kan utnyttes til solceller, og at solcellene har en virkningsgrad på 20%.'
  },
  {
    jsonFile: 'vinduer.json',
    soknadspliktBody: [
      'Vindusoppgradering kan være søknadspliktig hvis den endrer fasadens karakter. Mindre tiltak som vedlikehold, maling eller utskifting av glass i eksisterende rammer er som regel ikke søknadspliktig. Utskifting av hele vinduet til en annen type eller størrelse krever normalt søknad. Plan- og bygningsetaten gir nærmere veiledning om søknadsplikt og eventuelt om du må kontakte en fagperson (arkitekt, byggmester eller entreprenør) til å hjelpe deg.'
    ],
    energySourceDescription:
      'Besparelsene estimeres fra datasett basert på bygningstype, bruksareal og teknisk forskrift. Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som ikke tar hensyn til tidligere oppgraderinger av bygget. Strømprisen er satt til 1.1kr/kWh.'
  },
  {
    jsonFile: 'etterisolering-yttervegg.json',
    soknadspliktBody: [
      'Etterisolering som endrer fasaden er søknadspliktig. Du må derfor kontakte en fagperson (arkitekt, byggmester eller entreprenør) som søker om tillatelse fra Plan- og bygningsetaten for deg. Etterisolering fra innsiden er som regel ikke søknadspliktig, så lenge du ikke endrer bygningens utseende eller bærende konstruksjon.'
    ],
    energySourceDescription:
      'Besparelsene estimeres fra datasett basert på bygningstype, bruksareal og teknisk forskrift. Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som ikke tar hensyn til tidligere oppgraderinger av bygget. Strømprisen er satt til 1.1kr/kWh.'
  },
  {
    jsonFile: 'etterisolering-kjeller-loft.json',
    soknadspliktBody: [
      'Etterisolering som ikke endrer bygningens utseende er som regel ikke søknadspliktig. Men hvis tiltaket berører bærende konstruksjoner eller fasade, bør du sjekke med Plan- og bygningsetaten. De kan også gi råd om du bør bruke fagperson (arkitekt, byggmester eller entreprenør) til å søke for deg.'
    ],
    energySourceDescription:
      'Besparelsene estimeres fra datasett basert på bygningstype, bruksareal og teknisk forskrift. Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som ikke tar hensyn til tidligere oppgraderinger av bygget. Strømprisen er satt til 1.1kr/kWh.'
  }
];

function updateJsonFile(migration: MigrationData): void {
  const filePath = path.join(contentDir, migration.jsonFile);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fil ikke funnet: ${migration.jsonFile}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);

  let changed = false;

  // Finn eller opprett søknadsplikt-accordion
  if (!json.accordion) {
    json.accordion = [];
  }

  const soknadspliktIndex = json.accordion.findIndex(
    (item: { id: string }) => item.id === 'soknadsplikt'
  );

  if (soknadspliktIndex >= 0) {
    // Sjekk om body er forskjellig
    const currentBody = json.accordion[soknadspliktIndex].body;
    if (JSON.stringify(currentBody) !== JSON.stringify(migration.soknadspliktBody)) {
      console.log(`📝 Oppdaterer søknadsplikt-body i ${migration.jsonFile}`);
      console.log(`   Gammel: ${JSON.stringify(currentBody).substring(0, 80)}...`);
      console.log(
        `   Ny:     ${JSON.stringify(migration.soknadspliktBody).substring(0, 80)}...`
      );
      json.accordion[soknadspliktIndex].body = migration.soknadspliktBody;
      changed = true;
    }
  } else {
    console.log(`➕ Legger til søknadsplikt-accordion i ${migration.jsonFile}`);
    json.accordion.push({
      id: 'soknadsplikt',
      title: 'Søknadsplikt',
      body: migration.soknadspliktBody,
      links: []
    });
    changed = true;
  }

  // Legg til energySourceDescription hvis relevant
  if (migration.energySourceDescription) {
    if (json.energySourceDescription !== migration.energySourceDescription) {
      console.log(`🔋 Legger til/oppdaterer energySourceDescription i ${migration.jsonFile}`);
      json.energySourceDescription = migration.energySourceDescription;
      changed = true;
    }
  }

  if (changed) {
    // Oppdater metadata
    json.metadata = {
      ...json.metadata,
      updatedBy: 'migrate-hardcoded-texts',
      updatedAt: new Date().toISOString(),
      changeSummary: 'Migrert hardkodede tekster fra komponenter til JSON'
    };

    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
    console.log(`✅ Lagret ${migration.jsonFile}\n`);
  } else {
    console.log(`⏭️  Ingen endringer nødvendig i ${migration.jsonFile}\n`);
  }
}

function main() {
  console.log('🚀 Starter migrering av hardkodede tekster...\n');

  for (const migration of migrations) {
    try {
      updateJsonFile(migration);
    } catch (error) {
      console.error(`❌ Feil ved behandling av ${migration.jsonFile}:`, error);
    }
  }

  console.log('✨ Migrering fullført!');
  console.log('\nNeste steg:');
  console.log('1. Kjør "npm run content:validate" for å verifisere JSON-filene');
  console.log('2. Sjekk diff i JSON-filene');
  console.log('3. Oppdater React-komponentene til å lese fra JSON');
}

main();

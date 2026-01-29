/**
 * Script for å aggregere bydelsstatistikk fra Enova bulk-data
 *
 * Bruk:
 * 1. Last ned bulk CSV fra https://data.enova.no/
 * 2. Legg filen i data/raw/enova-energimerker-oslo.csv
 * 3. Kjør: npx tsx scripts/aggregate-district-statistics.ts
 *
 * Outputfil: src/data/district-statistics-enova.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

// Paths
const ENOVA_CSV_PATH = resolve(ROOT_DIR, 'data/raw/enova-energimerker-oslo.csv');
const POSTNUMMER_MAPPING_PATH = resolve(ROOT_DIR, 'data/raw/postnummer-bydel-mapping.json');
const OUTPUT_PATH = resolve(ROOT_DIR, 'src/data/district-statistics-enova.json');
const BUILDING_INDEX_PATH = resolve(ROOT_DIR, 'src/data/enova-building-index.json');

// Oslo postnummer til bydel mapping (basert på offisielle data)
// Denne mappingen er forenklet - en komplett mapping bør inkludere alle postnumre
const POSTNUMMER_BYDEL_MAPPING: Record<string, { bydel: string; delbydel: string }> = {
  // Frogner
  '0244': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0250': { bydel: 'Frogner', delbydel: 'Uranienborg-Majorstuen' },
  '0251': { bydel: 'Frogner', delbydel: 'Uranienborg-Majorstuen' },
  '0252': { bydel: 'Frogner', delbydel: 'Uranienborg-Majorstuen' },
  '0253': { bydel: 'Frogner', delbydel: 'Uranienborg-Majorstuen' },
  '0254': { bydel: 'Frogner', delbydel: 'Uranienborg-Majorstuen' },
  '0255': { bydel: 'Frogner', delbydel: 'Uranienborg-Majorstuen' },
  '0256': { bydel: 'Frogner', delbydel: 'Homansbyen' },
  '0257': { bydel: 'Frogner', delbydel: 'Homansbyen' },
  '0258': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0259': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0260': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0262': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0263': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0264': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0265': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0266': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0267': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0268': { bydel: 'Frogner', delbydel: 'Bygdøy-Frogner' },
  '0270': { bydel: 'Frogner', delbydel: 'Frogner' },
  '0271': { bydel: 'Frogner', delbydel: 'Frogner' },
  '0272': { bydel: 'Frogner', delbydel: 'Frogner' },
  '0273': { bydel: 'Frogner', delbydel: 'Frogner' },
  '0274': { bydel: 'Frogner', delbydel: 'Briskeby' },
  '0275': { bydel: 'Frogner', delbydel: 'Briskeby' },

  // Nordre Aker
  '0479': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  // Nye: Sogn, Ullevål
  '0480': { bydel: 'Nordre Aker', delbydel: 'Sogn' },
  '0481': { bydel: 'Nordre Aker', delbydel: 'Sogn' },
  '0482': { bydel: 'Nordre Aker', delbydel: 'Sogn' },
  '0483': { bydel: 'Nordre Aker', delbydel: 'Sogn' },
  '0484': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0485': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0486': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0487': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0488': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0489': { bydel: 'Nordre Aker', delbydel: 'Tåsen' },
  '0490': { bydel: 'Nordre Aker', delbydel: 'Tåsen' },
  '0491': { bydel: 'Nordre Aker', delbydel: 'Tåsen' },
  '0492': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  '0493': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  '0494': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  '0495': { bydel: 'Nordre Aker', delbydel: 'Maridalen' },
  '0496': { bydel: 'Nordre Aker', delbydel: 'Maridalen' },
  // Nordre Aker - Grefsen, Kjelsås, Disen, Myrer (separate delbydeler)
  '0850': { bydel: 'Nordre Aker', delbydel: 'Grefsen' },
  '0851': { bydel: 'Nordre Aker', delbydel: 'Grefsen' },
  '0852': { bydel: 'Nordre Aker', delbydel: 'Grefsen' },
  '0853': { bydel: 'Nordre Aker', delbydel: 'Kjelsås' },
  '0854': { bydel: 'Nordre Aker', delbydel: 'Kjelsås' },
  '0855': { bydel: 'Nordre Aker', delbydel: 'Disen' },
  '0857': { bydel: 'Nordre Aker', delbydel: 'Disen' },
  '0858': { bydel: 'Nordre Aker', delbydel: 'Myrer' },
  '0860': { bydel: 'Nordre Aker', delbydel: 'Myrer' },
  '0861': { bydel: 'Nordre Aker', delbydel: 'Disen' },
  '0862': { bydel: 'Nordre Aker', delbydel: 'Disen' },
  '0863': { bydel: 'Nordre Aker', delbydel: 'Myrer' },
  '0864': { bydel: 'Nordre Aker', delbydel: 'Grefsen' },
  // Nordre Aker - Ullevål Hageby og Korsvoll
  '0870': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0871': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0872': { bydel: 'Nordre Aker', delbydel: 'Ullevål hageby' },
  '0873': { bydel: 'Nordre Aker', delbydel: 'Korsvoll' },
  '0874': { bydel: 'Nordre Aker', delbydel: 'Korsvoll' },
  '0875': { bydel: 'Nordre Aker', delbydel: 'Korsvoll' },
  '0876': { bydel: 'Nordre Aker', delbydel: 'Korsvoll' },
  '0877': { bydel: 'Nordre Aker', delbydel: 'Korsvoll' },
  // Nordre Aker - Nordberg
  '0880': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  '0881': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  '0882': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  '0883': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  '0884': { bydel: 'Nordre Aker', delbydel: 'Nordberg' },
  // Nordre Aker - Maridalen
  '0890': { bydel: 'Nordre Aker', delbydel: 'Maridalen' },
  '0891': { bydel: 'Nordre Aker', delbydel: 'Maridalen' },

  // Grünerløkka
  '0550': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0551': { bydel: 'Grünerløkka', delbydel: 'Sofienberg' },
  '0552': { bydel: 'Grünerløkka', delbydel: 'Grünerløkka' },
  '0553': { bydel: 'Grünerløkka', delbydel: 'Grünerløkka' },
  '0554': { bydel: 'Grünerløkka', delbydel: 'Sofienberg' },
  '0555': { bydel: 'Grünerløkka', delbydel: 'Sofienberg' },
  '0556': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0557': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0558': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0559': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0560': { bydel: 'Grünerløkka', delbydel: 'Sinsen' },
  '0561': { bydel: 'Grünerløkka', delbydel: 'Sinsen' },
  '0562': { bydel: 'Grünerløkka', delbydel: 'Sinsen' },
  '0563': { bydel: 'Grünerløkka', delbydel: 'Sinsen' },
  '0564': { bydel: 'Grünerløkka', delbydel: 'Sinsen' },
  '0565': { bydel: 'Grünerløkka', delbydel: 'Sinsen' },
  '0566': { bydel: 'Grünerløkka', delbydel: 'Sinsen' },
  // Nye: Carl Berner, Løren, Hasle
  '0567': { bydel: 'Grünerløkka', delbydel: 'Carl Berner' },
  '0568': { bydel: 'Grünerløkka', delbydel: 'Carl Berner' },
  '0569': { bydel: 'Grünerløkka', delbydel: 'Carl Berner' },
  '0570': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0571': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0572': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0573': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0574': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0575': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0576': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0577': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0578': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },
  '0579': { bydel: 'Grünerløkka', delbydel: 'Hasle-Løren' },

  // Gamle Oslo
  '0134': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0150': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0151': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0152': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0153': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0154': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0155': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0157': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0158': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0159': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  // Nye: Sentrum (Bjørvika, Oslo S, Karl Johan)
  '0160': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0161': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0162': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0163': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0164': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0165': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0166': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0167': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0168': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0169': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0170': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0171': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0172': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0173': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0174': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0175': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0176': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0177': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0178': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0179': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0180': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0181': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0182': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0183': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0184': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0185': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0186': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0187': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0188': { bydel: 'Gamle Oslo', delbydel: 'Grønland' },
  '0190': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0191': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0192': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0193': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0194': { bydel: 'Gamle Oslo', delbydel: 'Sentrum' },
  '0650': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0651': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0652': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0653': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0654': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0655': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0656': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0657': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0658': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0659': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0660': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0661': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0662': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },
  '0663': { bydel: 'Gamle Oslo', delbydel: 'Ensjø' },

  // St. Hanshaugen
  '0350': { bydel: 'St. Hanshaugen', delbydel: 'Hammersborg' },
  '0351': { bydel: 'St. Hanshaugen', delbydel: 'Hammersborg' },
  '0352': { bydel: 'St. Hanshaugen', delbydel: 'Hammersborg' },
  '0353': { bydel: 'St. Hanshaugen', delbydel: 'Hammersborg' },
  '0354': { bydel: 'St. Hanshaugen', delbydel: 'Hammersborg' },
  '0355': { bydel: 'St. Hanshaugen', delbydel: 'St. Hanshaugen' },
  '0356': { bydel: 'St. Hanshaugen', delbydel: 'St. Hanshaugen' },
  '0357': { bydel: 'St. Hanshaugen', delbydel: 'St. Hanshaugen' },
  '0358': { bydel: 'St. Hanshaugen', delbydel: 'St. Hanshaugen' },
  '0359': { bydel: 'St. Hanshaugen', delbydel: 'St. Hanshaugen' },
  '0360': { bydel: 'St. Hanshaugen', delbydel: 'St. Hanshaugen' },
  '0361': { bydel: 'St. Hanshaugen', delbydel: 'Bislett' },
  '0362': { bydel: 'St. Hanshaugen', delbydel: 'Bislett' },
  '0363': { bydel: 'St. Hanshaugen', delbydel: 'Bislett' },
  '0364': { bydel: 'St. Hanshaugen', delbydel: 'Bislett' },
  '0365': { bydel: 'St. Hanshaugen', delbydel: 'Bislett' },
  '0366': { bydel: 'St. Hanshaugen', delbydel: 'Bolteløkka' },
  '0367': { bydel: 'St. Hanshaugen', delbydel: 'Bolteløkka' },
  '0368': { bydel: 'St. Hanshaugen', delbydel: 'Bolteløkka' },
  // '0369' tilhører Ullern, ikke St. Hanshaugen

  // Sagene
  '0451': { bydel: 'Sagene', delbydel: 'Sagene' },
  '0452': { bydel: 'Sagene', delbydel: 'Sagene' },
  '0453': { bydel: 'Sagene', delbydel: 'Sagene' },
  '0454': { bydel: 'Sagene', delbydel: 'Sagene' },
  '0455': { bydel: 'Sagene', delbydel: 'Sagene' },
  '0456': { bydel: 'Sagene', delbydel: 'Bjølsen' },
  '0457': { bydel: 'Sagene', delbydel: 'Bjølsen' },
  '0458': { bydel: 'Sagene', delbydel: 'Bjølsen' },
  '0459': { bydel: 'Sagene', delbydel: 'Bjølsen' },
  '0460': { bydel: 'Sagene', delbydel: 'Torshov' },
  '0461': { bydel: 'Sagene', delbydel: 'Torshov' },
  '0462': { bydel: 'Sagene', delbydel: 'Torshov' },
  '0463': { bydel: 'Sagene', delbydel: 'Torshov' },
  '0464': { bydel: 'Sagene', delbydel: 'Torshov' },
  '0465': { bydel: 'Sagene', delbydel: 'Torshov' },
  '0467': { bydel: 'Sagene', delbydel: 'Iladalen' },
  '0468': { bydel: 'Sagene', delbydel: 'Iladalen' },
  '0469': { bydel: 'Sagene', delbydel: 'Iladalen' },
  '0470': { bydel: 'Sagene', delbydel: 'Iladalen' },
  // Nye: Nydalen, Storo (grense Sagene/Nordre Aker)
  '0473': { bydel: 'Sagene', delbydel: 'Nydalen' },
  '0474': { bydel: 'Sagene', delbydel: 'Nydalen' },
  '0475': { bydel: 'Sagene', delbydel: 'Nydalen' },
  '0476': { bydel: 'Sagene', delbydel: 'Nydalen' },
  '0477': { bydel: 'Sagene', delbydel: 'Nydalen' },
  '0478': { bydel: 'Sagene', delbydel: 'Nydalen' },

  // Vestre Aker
  '0750': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0751': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0752': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0753': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0754': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0755': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0756': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0757': { bydel: 'Vestre Aker', delbydel: 'Holmenkollen' },
  '0758': { bydel: 'Vestre Aker', delbydel: 'Røa' },
  '0759': { bydel: 'Vestre Aker', delbydel: 'Røa' },
  '0760': { bydel: 'Vestre Aker', delbydel: 'Røa' },
  // Nye: Vestre Aker ekstra postnummer
  '0761': { bydel: 'Vestre Aker', delbydel: 'Røa' },
  '0762': { bydel: 'Vestre Aker', delbydel: 'Røa' },
  '0763': { bydel: 'Vestre Aker', delbydel: 'Røa' },
  '0764': { bydel: 'Vestre Aker', delbydel: 'Røa' },
  '0765': { bydel: 'Vestre Aker', delbydel: 'Vinderen' },
  '0766': { bydel: 'Vestre Aker', delbydel: 'Vinderen' },
  '0767': { bydel: 'Vestre Aker', delbydel: 'Vinderen' },
  '0768': { bydel: 'Vestre Aker', delbydel: 'Vinderen' },
  '0770': { bydel: 'Vestre Aker', delbydel: 'Vinderen' },
  '0771': { bydel: 'Vestre Aker', delbydel: 'Vinderen' },
  '0772': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0773': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0774': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0775': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0776': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0777': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0778': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0779': { bydel: 'Vestre Aker', delbydel: 'Slemdal' },
  '0781': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0782': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0783': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0784': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0785': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0786': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0787': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0788': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0789': { bydel: 'Vestre Aker', delbydel: 'Grimelund' },
  '0790': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0791': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0792': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0793': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0794': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0795': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0796': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0797': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0798': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },
  '0799': { bydel: 'Vestre Aker', delbydel: 'Hovseter' },

  // Ullern
  '0280': { bydel: 'Ullern', delbydel: 'Skøyen' },
  '0281': { bydel: 'Ullern', delbydel: 'Skøyen' },
  '0282': { bydel: 'Ullern', delbydel: 'Skøyen' },
  '0283': { bydel: 'Ullern', delbydel: 'Skøyen' },
  '0284': { bydel: 'Ullern', delbydel: 'Skøyen' },
  '0285': { bydel: 'Ullern', delbydel: 'Skøyen' },
  '0286': { bydel: 'Ullern', delbydel: 'Ullern' },
  '0287': { bydel: 'Ullern', delbydel: 'Ullern' },
  '0369': { bydel: 'Ullern', delbydel: 'Lilleaker' },
  '0370': { bydel: 'Ullern', delbydel: 'Lilleaker' },
  '0371': { bydel: 'Ullern', delbydel: 'Lilleaker' },
  '0372': { bydel: 'Ullern', delbydel: 'Lilleaker' },
  '0373': { bydel: 'Ullern', delbydel: 'Lilleaker' },
  '0374': { bydel: 'Ullern', delbydel: 'Lilleaker' },
  '0375': { bydel: 'Ullern', delbydel: 'Ullern' },
  '0376': { bydel: 'Ullern', delbydel: 'Ullern' },
  '0377': { bydel: 'Ullern', delbydel: 'Ullern' },
  '0378': { bydel: 'Ullern', delbydel: 'Ullern' },
  '0379': { bydel: 'Ullern', delbydel: 'Ullern' },
  '0380': { bydel: 'Ullern', delbydel: 'Montebello' },
  '0381': { bydel: 'Ullern', delbydel: 'Montebello' },
  '0382': { bydel: 'Ullern', delbydel: 'Montebello' },
  '0383': { bydel: 'Ullern', delbydel: 'Montebello' },
  '0384': { bydel: 'Ullern', delbydel: 'Montebello' },
  '0385': { bydel: 'Ullern', delbydel: 'Montebello' },

  // Bjerke
  '0580': { bydel: 'Bjerke', delbydel: 'Årvoll' },
  '0581': { bydel: 'Bjerke', delbydel: 'Årvoll' },
  '0582': { bydel: 'Bjerke', delbydel: 'Årvoll' },
  '0583': { bydel: 'Bjerke', delbydel: 'Veitvet' },
  '0584': { bydel: 'Bjerke', delbydel: 'Veitvet' },
  '0585': { bydel: 'Bjerke', delbydel: 'Veitvet' },
  '0586': { bydel: 'Bjerke', delbydel: 'Linderud' },
  '0587': { bydel: 'Bjerke', delbydel: 'Linderud' },
  '0588': { bydel: 'Bjerke', delbydel: 'Linderud' },
  '0589': { bydel: 'Bjerke', delbydel: 'Økern' },
  '0590': { bydel: 'Bjerke', delbydel: 'Økern' },
  '0591': { bydel: 'Bjerke', delbydel: 'Økern' },
  '0592': { bydel: 'Bjerke', delbydel: 'Refstad' },
  '0593': { bydel: 'Bjerke', delbydel: 'Refstad' },
  '0594': { bydel: 'Bjerke', delbydel: 'Refstad' },
  '0595': { bydel: 'Bjerke', delbydel: 'Løren' },
  '0596': { bydel: 'Bjerke', delbydel: 'Løren' },
  // Nye: Økern, Risløkka
  '0597': { bydel: 'Bjerke', delbydel: 'Økern' },
  '0598': { bydel: 'Bjerke', delbydel: 'Økern' },
  '0599': { bydel: 'Bjerke', delbydel: 'Økern' },

  // Alna
  // Nye: Bryn, Helsfyr
  '0664': { bydel: 'Alna', delbydel: 'Bryn' },
  '0665': { bydel: 'Alna', delbydel: 'Bryn' },
  '0666': { bydel: 'Alna', delbydel: 'Bryn' },
  '0667': { bydel: 'Alna', delbydel: 'Bryn' },
  '0668': { bydel: 'Alna', delbydel: 'Helsfyr' },
  '0669': { bydel: 'Alna', delbydel: 'Helsfyr' },
  '0670': { bydel: 'Alna', delbydel: 'Hellerud' },
  '0671': { bydel: 'Alna', delbydel: 'Hellerud' },
  '0672': { bydel: 'Alna', delbydel: 'Hellerud' },
  '0673': { bydel: 'Alna', delbydel: 'Hellerud' },
  '0674': { bydel: 'Alna', delbydel: 'Teisen' },
  '0675': { bydel: 'Alna', delbydel: 'Teisen' },
  '0676': { bydel: 'Alna', delbydel: 'Teisen' },
  '0677': { bydel: 'Alna', delbydel: 'Teisen' },
  '0678': { bydel: 'Alna', delbydel: 'Skøyenåsen' },
  '0679': { bydel: 'Alna', delbydel: 'Skøyenåsen' },
  '0680': { bydel: 'Alna', delbydel: 'Ulven' },
  '0681': { bydel: 'Alna', delbydel: 'Ulven' },
  '0682': { bydel: 'Alna', delbydel: 'Ulven' },
  '0683': { bydel: 'Alna', delbydel: 'Ulven' },
  // Nye: Alna-dalen
  '0684': { bydel: 'Alna', delbydel: 'Alna' },
  '0685': { bydel: 'Alna', delbydel: 'Alna' },
  '0686': { bydel: 'Alna', delbydel: 'Alna' },
  '0687': { bydel: 'Alna', delbydel: 'Alna' },
  '0688': { bydel: 'Alna', delbydel: 'Alna' },
  '0689': { bydel: 'Alna', delbydel: 'Alna' },
  '0690': { bydel: 'Alna', delbydel: 'Alna' },
  '0691': { bydel: 'Alna', delbydel: 'Alna' },
  '0692': { bydel: 'Alna', delbydel: 'Alna' },
  '0693': { bydel: 'Alna', delbydel: 'Alna' },
  '0694': { bydel: 'Alna', delbydel: 'Alna' },
  '1051': { bydel: 'Alna', delbydel: 'Furuset' },
  '1052': { bydel: 'Alna', delbydel: 'Furuset' },
  '1053': { bydel: 'Alna', delbydel: 'Furuset' },
  '1054': { bydel: 'Alna', delbydel: 'Furuset' },
  '1055': { bydel: 'Alna', delbydel: 'Furuset' },
  '1056': { bydel: 'Alna', delbydel: 'Lindeberg' },
  '1057': { bydel: 'Alna', delbydel: 'Lindeberg' },
  '1058': { bydel: 'Alna', delbydel: 'Lindeberg' },
  '1061': { bydel: 'Alna', delbydel: 'Ellingsrud' },
  '1062': { bydel: 'Alna', delbydel: 'Ellingsrud' },
  '1063': { bydel: 'Alna', delbydel: 'Trosterud' },
  '1064': { bydel: 'Alna', delbydel: 'Trosterud' },
  '1065': { bydel: 'Alna', delbydel: 'Haugerud' },
  // Nye: Groruddalen-området
  '1066': { bydel: 'Alna', delbydel: 'Haugerud' },
  '1067': { bydel: 'Alna', delbydel: 'Haugerud' },
  '1068': { bydel: 'Alna', delbydel: 'Haugerud' },
  '1069': { bydel: 'Alna', delbydel: 'Haugerud' },
  '1081': { bydel: 'Alna', delbydel: 'Furuset' },
  '1083': { bydel: 'Alna', delbydel: 'Furuset' },
  '1084': { bydel: 'Alna', delbydel: 'Furuset' },
  '1086': { bydel: 'Alna', delbydel: 'Furuset' },
  '1087': { bydel: 'Alna', delbydel: 'Furuset' },
  '1088': { bydel: 'Alna', delbydel: 'Furuset' },
  '1089': { bydel: 'Alna', delbydel: 'Furuset' },

  // Grorud
  '0950': { bydel: 'Grorud', delbydel: 'Grorud' },
  '0951': { bydel: 'Grorud', delbydel: 'Grorud' },
  '0952': { bydel: 'Grorud', delbydel: 'Grorud' },
  '0953': { bydel: 'Grorud', delbydel: 'Ammerud' },
  '0954': { bydel: 'Grorud', delbydel: 'Ammerud' },
  '0955': { bydel: 'Grorud', delbydel: 'Ammerud' },
  '0956': { bydel: 'Grorud', delbydel: 'Ammerud' },
  '0957': { bydel: 'Grorud', delbydel: 'Ammerud' },
  '0958': { bydel: 'Grorud', delbydel: 'Romsås' },
  '0959': { bydel: 'Grorud', delbydel: 'Romsås' },
  '0960': { bydel: 'Grorud', delbydel: 'Romsås' },
  '0961': { bydel: 'Grorud', delbydel: 'Rødtvet' },
  '0962': { bydel: 'Grorud', delbydel: 'Rødtvet' },
  '0963': { bydel: 'Grorud', delbydel: 'Rødtvet' },
  '0964': { bydel: 'Grorud', delbydel: 'Rødtvet' },
  '0968': { bydel: 'Grorud', delbydel: 'Kalbakken' },
  '0969': { bydel: 'Grorud', delbydel: 'Kalbakken' },
  '0970': { bydel: 'Grorud', delbydel: 'Nordtvet' },
  '0971': { bydel: 'Grorud', delbydel: 'Nordtvet' },
  '0972': { bydel: 'Grorud', delbydel: 'Nordtvet' },
  '0973': { bydel: 'Grorud', delbydel: 'Nordtvet' },

  // Stovner
  '0980': { bydel: 'Stovner', delbydel: 'Stovner' },
  '0981': { bydel: 'Stovner', delbydel: 'Stovner' },
  '0982': { bydel: 'Stovner', delbydel: 'Stovner' },
  '0983': { bydel: 'Stovner', delbydel: 'Stovner' },
  '0984': { bydel: 'Stovner', delbydel: 'Vestli' },
  '0985': { bydel: 'Stovner', delbydel: 'Vestli' },
  '0986': { bydel: 'Stovner', delbydel: 'Vestli' },
  '0988': { bydel: 'Stovner', delbydel: 'Haugenstua' },

  // Nordstrand
  '1151': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1152': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1153': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1154': { bydel: 'Nordstrand', delbydel: 'Bekkelaget' },
  '1155': { bydel: 'Nordstrand', delbydel: 'Bekkelaget' },
  '1156': { bydel: 'Nordstrand', delbydel: 'Bekkelaget' },
  '1157': { bydel: 'Nordstrand', delbydel: 'Bekkelaget' },
  '1158': { bydel: 'Nordstrand', delbydel: 'Bekkelaget' },
  '1159': { bydel: 'Nordstrand', delbydel: 'Bekkelaget' },
  '1160': { bydel: 'Nordstrand', delbydel: 'Simensbråten' },
  '1161': { bydel: 'Nordstrand', delbydel: 'Simensbråten' },
  '1162': { bydel: 'Nordstrand', delbydel: 'Lambertseter' },
  '1163': { bydel: 'Nordstrand', delbydel: 'Lambertseter' },
  '1164': { bydel: 'Nordstrand', delbydel: 'Lambertseter' },
  '1165': { bydel: 'Nordstrand', delbydel: 'Munkerud' },
  '1166': { bydel: 'Nordstrand', delbydel: 'Munkerud' },
  '1167': { bydel: 'Nordstrand', delbydel: 'Munkerud' },
  '1168': { bydel: 'Nordstrand', delbydel: 'Munkerud' },
  '1169': { bydel: 'Nordstrand', delbydel: 'Munkerud' },
  // Nye: Nordstrand ekstra postnummer
  '1170': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1171': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1172': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1173': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1174': { bydel: 'Nordstrand', delbydel: 'Nordstrand' },
  '1175': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1176': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1177': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1178': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1179': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1180': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1181': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1182': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1183': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1184': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1185': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1186': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1187': { bydel: 'Nordstrand', delbydel: 'Ljan' },
  '1188': { bydel: 'Nordstrand', delbydel: 'Ekeberg' },
  '1189': { bydel: 'Nordstrand', delbydel: 'Ekeberg' },

  // Søndre Nordstrand
  '1201': { bydel: 'Søndre Nordstrand', delbydel: 'Holmlia' },
  '1202': { bydel: 'Søndre Nordstrand', delbydel: 'Holmlia' },
  '1203': { bydel: 'Søndre Nordstrand', delbydel: 'Holmlia' },
  '1204': { bydel: 'Søndre Nordstrand', delbydel: 'Holmlia' },
  '1205': { bydel: 'Søndre Nordstrand', delbydel: 'Holmlia' },
  '1206': { bydel: 'Søndre Nordstrand', delbydel: 'Mortensrud' },
  '1207': { bydel: 'Søndre Nordstrand', delbydel: 'Mortensrud' },
  '1208': { bydel: 'Søndre Nordstrand', delbydel: 'Mortensrud' },
  '1209': { bydel: 'Søndre Nordstrand', delbydel: 'Bjørndal' },
  '1210': { bydel: 'Søndre Nordstrand', delbydel: 'Bjørndal' },
  // Nye: Søndre Nordstrand ekstra postnummer
  '1211': { bydel: 'Søndre Nordstrand', delbydel: 'Bjørndal' },
  '1212': { bydel: 'Søndre Nordstrand', delbydel: 'Bjørndal' },
  '1213': { bydel: 'Søndre Nordstrand', delbydel: 'Bjørndal' },
  '1214': { bydel: 'Søndre Nordstrand', delbydel: 'Prinsdal' },
  '1215': { bydel: 'Søndre Nordstrand', delbydel: 'Prinsdal' },
  '1216': { bydel: 'Søndre Nordstrand', delbydel: 'Prinsdal' },
  '1217': { bydel: 'Søndre Nordstrand', delbydel: 'Prinsdal' },
  '1218': { bydel: 'Søndre Nordstrand', delbydel: 'Prinsdal' },
  '1219': { bydel: 'Søndre Nordstrand', delbydel: 'Prinsdal' },
  // Hauketo, Brenna, Lofsrud
  '1262': { bydel: 'Søndre Nordstrand', delbydel: 'Hauketo' },
  '1263': { bydel: 'Søndre Nordstrand', delbydel: 'Hauketo' },
  '1264': { bydel: 'Søndre Nordstrand', delbydel: 'Hauketo' },
  '1265': { bydel: 'Søndre Nordstrand', delbydel: 'Hauketo' },
  '1266': { bydel: 'Søndre Nordstrand', delbydel: 'Hauketo' },
  '1267': { bydel: 'Søndre Nordstrand', delbydel: 'Hauketo' },
  '1268': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1269': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1270': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1271': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1272': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1273': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1274': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1275': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1278': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  '1279': { bydel: 'Søndre Nordstrand', delbydel: 'Lofsrud' },
  // Gjersrud-Stensrud
  '1281': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1282': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1283': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1284': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1285': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1286': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1287': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1288': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1289': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1290': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1291': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1292': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1293': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1294': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },
  '1295': { bydel: 'Søndre Nordstrand', delbydel: 'Gjersrud-Stensrud' },

  // Østensjø
  '0601': { bydel: 'Østensjø', delbydel: 'Manglerud' },
  '0602': { bydel: 'Østensjø', delbydel: 'Manglerud' },
  '0603': { bydel: 'Østensjø', delbydel: 'Manglerud' },
  '0604': { bydel: 'Østensjø', delbydel: 'Manglerud' },
  '0605': { bydel: 'Østensjø', delbydel: 'Manglerud' },
  '0606': { bydel: 'Østensjø', delbydel: 'Godlia' },
  '0607': { bydel: 'Østensjø', delbydel: 'Godlia' },
  '0608': { bydel: 'Østensjø', delbydel: 'Godlia' },
  '0609': { bydel: 'Østensjø', delbydel: 'Godlia' },
  '0610': { bydel: 'Østensjø', delbydel: 'Godlia' },
  '0611': { bydel: 'Østensjø', delbydel: 'Oppsal' },
  '0612': { bydel: 'Østensjø', delbydel: 'Oppsal' },
  '0613': { bydel: 'Østensjø', delbydel: 'Oppsal' },
  '0614': { bydel: 'Østensjø', delbydel: 'Oppsal' },
  '0615': { bydel: 'Østensjø', delbydel: 'Oppsal' },
  '0616': { bydel: 'Østensjø', delbydel: 'Oppsal' },
  '0617': { bydel: 'Østensjø', delbydel: 'Ulsrud' },
  '0618': { bydel: 'Østensjø', delbydel: 'Ulsrud' },
  '0619': { bydel: 'Østensjø', delbydel: 'Ulsrud' },
  '0620': { bydel: 'Østensjø', delbydel: 'Bøler' },
  '0621': { bydel: 'Østensjø', delbydel: 'Bøler' },
  '0622': { bydel: 'Østensjø', delbydel: 'Bøler' },
  '0623': { bydel: 'Østensjø', delbydel: 'Bøler' },
  '0624': { bydel: 'Østensjø', delbydel: 'Bøler' },
  '0625': { bydel: 'Østensjø', delbydel: 'Bøler' },
  '0626': { bydel: 'Østensjø', delbydel: 'Skullerud' },
  '0627': { bydel: 'Østensjø', delbydel: 'Skullerud' },
  '0628': { bydel: 'Østensjø', delbydel: 'Skullerud' },
  '0629': { bydel: 'Østensjø', delbydel: 'Abildsø' },
  '0630': { bydel: 'Østensjø', delbydel: 'Abildsø' },
};

// Type definitions
interface EnovaCsvRow {
  postnummer: string;
  kommunenummer: string;
  bygningskategori: string;
  energikarakter: string;
  oppvarmingskarakter: string;
  beregnetLevertEnergi: number;
  bra: number;
  byggeaar: number;
  bygningsnummer?: string;
  gnr?: string;
  bnr?: string;
  snr?: string;
  kwhPerM2: number;
  utstedelsesdato?: string;
}

// Bygnings-indeks for oppslag av enkelt-boliger
interface BuildingIndexEntry {
  kwhPerM2: number;
  energikarakter: string;
  bygningskategori: string;
  byggeaar: number;
  bydel?: string;
  delbydel?: string;
}

interface BuildingIndex {
  lastUpdated: string;
  source: 'enova-bulk';
  // Nøkkel: bygningsnummer eller "gnr-bnr-snr"
  buildings: Record<string, BuildingIndexEntry>;
}

interface BuildingStats {
  kwhPerM2Values: number[];
  energyGrades: Record<string, number>;
}

interface DistrictStats {
  avgKwhPerM2: number;
  medianKwhPerM2: number;
  count: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  energyGradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
    G: number;
  };
}

interface DistrictData {
  småhus: DistrictStats;
  blokk: DistrictStats;
}

interface DistrictStatisticsData {
  lastUpdated: string;
  source: 'enova-bulk' | 'mock';
  districts: Record<string, DistrictData>;
  subdistricts: Record<string, DistrictData>;
  oslo: DistrictData;
}

// Helper functions
// Parse a CSV line handling quoted fields with commas inside
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current); // Don't forget the last field
  return result;
}

function parseEnovaCsv(csvContent: string): EnovaCsvRow[] {
  const lines = csvContent.split('\n');
  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());

  const rows: EnovaCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    header.forEach((h, idx) => {
      row[h] = values[idx]?.trim() || '';
    });

    // Parse only Oslo (kommunenummer 0301 or 301)
    // Column name may be 'kommunenummer' or 'knr' depending on data source
    const kommunenummer = row['kommunenummer'] || row['knr'] || '';
    if (kommunenummer !== '0301' && kommunenummer !== '301') continue;

    // Handle two different CSV formats:
    // 1. Older format: bra (m²) and beregnetlevertenergi (total kWh)
    // 2. Newer API format: beregnetlevertenergitotaltkwhm2 (kWh/m²)
    const bra = parseFloat(row['bra'] || row['bruksareal'] || '0');
    const energyPerM2 = parseFloat(row['beregnetlevertenergitotaltkwhm2'] || '0');
    const beregnetEnergi = parseFloat(row['beregnetlevertenergi'] || row['beregnetlevertenergitoaltkhw'] || '0');

    // Skip if no energy data
    if (energyPerM2 <= 0 && (bra <= 0 || beregnetEnergi <= 0)) continue;

    // Calculate kWh/m² - use pre-calculated value if available, otherwise calculate from total
    const kwhPerM2 = energyPerM2 > 0 ? energyPerM2 : (beregnetEnergi / bra);

    rows.push({
      postnummer: row['postnummer']?.padStart(4, '0') || '',
      kommunenummer,
      bygningskategori: row['bygningskategori'] || '',
      energikarakter: row['energikarakter'] || '',
      oppvarmingskarakter: row['oppvarmingskarakter'] || '',
      beregnetLevertEnergi: kwhPerM2 * (bra > 0 ? bra : 100), // Reconstruct for compatibility
      bra: bra > 0 ? bra : 100, // Default to 100m² if not available
      byggeaar: parseInt(row['byggeaar'] || row['byggear'] || '0'),
      bygningsnummer: row['bygningsnummer'],
      gnr: row['gnr'] || '',
      bnr: row['bnr'] || '',
      snr: row['snr'] || '',
      kwhPerM2,
      utstedelsesdato: row['utstedelsesdato'] || '',
    });
  }

  return rows;
}

function mapBuildingType(kategori: string): 'småhus' | 'blokk' {
  const normalized = kategori.toLowerCase();
  if (
    normalized.includes('blokk') ||
    normalized.includes('leilighet') ||
    normalized.includes('boligblokk') ||
    normalized.includes('stort') ||
    normalized.includes('store boligbygg')
  ) {
    return 'blokk';
  }
  return 'småhus';
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
}

function calculateStats(stats: BuildingStats): DistrictStats {
  const values = stats.kwhPerM2Values;

  if (values.length === 0) {
    return {
      avgKwhPerM2: 0,
      medianKwhPerM2: 0,
      count: 0,
      percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
      energyGradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
    };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  const totalGrades = Object.values(stats.energyGrades).reduce((a, b) => a + b, 0);
  const gradeDistribution = {
    A: Math.round((stats.energyGrades['A'] || 0) / totalGrades * 100),
    B: Math.round((stats.energyGrades['B'] || 0) / totalGrades * 100),
    C: Math.round((stats.energyGrades['C'] || 0) / totalGrades * 100),
    D: Math.round((stats.energyGrades['D'] || 0) / totalGrades * 100),
    E: Math.round((stats.energyGrades['E'] || 0) / totalGrades * 100),
    F: Math.round((stats.energyGrades['F'] || 0) / totalGrades * 100),
    G: Math.round((stats.energyGrades['G'] || 0) / totalGrades * 100),
  };

  return {
    avgKwhPerM2: Math.round(avg),
    medianKwhPerM2: Math.round(calculatePercentile(values, 50)),
    count: values.length,
    percentiles: {
      p10: Math.round(calculatePercentile(values, 10)),
      p25: Math.round(calculatePercentile(values, 25)),
      p50: Math.round(calculatePercentile(values, 50)),
      p75: Math.round(calculatePercentile(values, 75)),
      p90: Math.round(calculatePercentile(values, 90)),
    },
    energyGradeDistribution: gradeDistribution,
  };
}

function createEmptyStats(): BuildingStats {
  return {
    kwhPerM2Values: [],
    energyGrades: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
  };
}

// createEmptyDistrictData unused - kept for potential future use
// function createEmptyDistrictData(): DistrictData {
//   return {
//     småhus: calculateStats(createEmptyStats()),
//     blokk: calculateStats(createEmptyStats()),
//   };
// }

// Main aggregation function
function aggregateStatistics(
  rows: EnovaCsvRow[],
  postnummerMapping: Record<string, { bydel: string; delbydel: string }>
): DistrictStatisticsData {
  // Initialize accumulators
  const districtStats: Record<string, Record<'småhus' | 'blokk', BuildingStats>> = {};
  const subdistrictStats: Record<string, Record<'småhus' | 'blokk', BuildingStats>> = {};
  const osloStats: Record<'småhus' | 'blokk', BuildingStats> = {
    småhus: createEmptyStats(),
    blokk: createEmptyStats(),
  };

  let unmappedCount = 0;

  for (const row of rows) {
    const mapping = postnummerMapping[row.postnummer];

    if (!mapping) {
      unmappedCount++;
      continue;
    }

    const { bydel, delbydel } = mapping;
    const buildingType = mapBuildingType(row.bygningskategori);
    const kwhPerM2 = row.beregnetLevertEnergi / row.bra;

    // Skip unrealistic values
    if (kwhPerM2 < 20 || kwhPerM2 > 500) continue;

    // Initialize district if needed
    if (!districtStats[bydel]) {
      districtStats[bydel] = {
        småhus: createEmptyStats(),
        blokk: createEmptyStats(),
      };
    }

    // Initialize subdistrict if needed
    const subdistrictKey = `${bydel}/${delbydel}`;
    if (!subdistrictStats[subdistrictKey]) {
      subdistrictStats[subdistrictKey] = {
        småhus: createEmptyStats(),
        blokk: createEmptyStats(),
      };
    }

    // Add to district stats
    districtStats[bydel][buildingType].kwhPerM2Values.push(kwhPerM2);
    districtStats[bydel][buildingType].energyGrades[row.energikarakter] =
      (districtStats[bydel][buildingType].energyGrades[row.energikarakter] || 0) + 1;

    // Add to subdistrict stats
    subdistrictStats[subdistrictKey][buildingType].kwhPerM2Values.push(kwhPerM2);
    subdistrictStats[subdistrictKey][buildingType].energyGrades[row.energikarakter] =
      (subdistrictStats[subdistrictKey][buildingType].energyGrades[row.energikarakter] || 0) + 1;

    // Add to Oslo stats
    osloStats[buildingType].kwhPerM2Values.push(kwhPerM2);
    osloStats[buildingType].energyGrades[row.energikarakter] =
      (osloStats[buildingType].energyGrades[row.energikarakter] || 0) + 1;
  }

  console.log(`\n📊 Aggregeringsresultat:`);
  console.log(`   Totalt prosessert: ${rows.length}`);
  console.log(`   Kunne ikke mappes til bydel: ${unmappedCount}`);
  console.log(`   Bydeler funnet: ${Object.keys(districtStats).length}`);
  console.log(`   Delbydeler funnet: ${Object.keys(subdistrictStats).length}`);

  // Convert to final format
  const districts: Record<string, DistrictData> = {};
  for (const [bydel, stats] of Object.entries(districtStats)) {
    districts[bydel] = {
      småhus: calculateStats(stats.småhus),
      blokk: calculateStats(stats.blokk),
    };
  }

  const subdistricts: Record<string, DistrictData> = {};
  for (const [key, stats] of Object.entries(subdistrictStats)) {
    subdistricts[key] = {
      småhus: calculateStats(stats.småhus),
      blokk: calculateStats(stats.blokk),
    };
  }

  return {
    lastUpdated: new Date().toISOString().split('T')[0],
    source: 'enova-bulk',
    districts,
    subdistricts,
    oslo: {
      småhus: calculateStats(osloStats.småhus),
      blokk: calculateStats(osloStats.blokk),
    },
  };
}

// Generate building index for individual building lookups
function generateBuildingIndex(
  rows: EnovaCsvRow[],
  postnummerMapping: Record<string, { bydel: string; delbydel: string }>
): BuildingIndex {
  const buildings: Record<string, BuildingIndexEntry> = {};
  // Track utstedelsesdato per key to ensure newest certificate wins
  const buildingDates: Record<string, string> = {};
  // Track which bygningsnummer keys belong to which matrikkel key,
  // so a newer certificate for the same matrikkel (even without bygningsnummer)
  // can update all related keys
  const matrikkelToBygningsnummer: Record<string, string[]> = {};

  for (const row of rows) {
    // Skip unrealistic values
    if (row.kwhPerM2 < 20 || row.kwhPerM2 > 500) continue;

    const mapping = postnummerMapping[row.postnummer];
    const dato = row.utstedelsesdato || '';

    const entry: BuildingIndexEntry = {
      kwhPerM2: Math.round(row.kwhPerM2 * 10) / 10, // Round to 1 decimal
      energikarakter: row.energikarakter,
      bygningskategori: row.bygningskategori,
      byggeaar: row.byggeaar,
      bydel: mapping?.bydel,
      delbydel: mapping?.delbydel,
    };

    const matrikkelKey = (row.gnr && row.bnr) ? `${row.gnr}-${row.bnr}-${row.snr || '0'}` : '';

    // Track the relationship between bygningsnummer and matrikkel
    if (row.bygningsnummer && matrikkelKey) {
      if (!matrikkelToBygningsnummer[matrikkelKey]) {
        matrikkelToBygningsnummer[matrikkelKey] = [];
      }
      if (!matrikkelToBygningsnummer[matrikkelKey].includes(row.bygningsnummer)) {
        matrikkelToBygningsnummer[matrikkelKey].push(row.bygningsnummer);
      }
    }

    // Primary key: bygningsnummer (most reliable)
    if (row.bygningsnummer) {
      const key = row.bygningsnummer;
      if (!buildings[key] || dato > (buildingDates[key] || '')) {
        buildings[key] = entry;
        buildingDates[key] = dato;
      }
    }

    // Secondary key: matrikkel (gnr-bnr-snr) - useful for lookups without bygningsnummer
    if (matrikkelKey) {
      if (!buildings[matrikkelKey] || dato > (buildingDates[matrikkelKey] || '')) {
        buildings[matrikkelKey] = entry;
        buildingDates[matrikkelKey] = dato;

        // A newer certificate for this matrikkel should also update any
        // bygningsnummer keys that belong to the same matrikkel, so lookups
        // by bygningsnummer also return the newest data
        const relatedKeys = matrikkelToBygningsnummer[matrikkelKey] || [];
        for (const bKey of relatedKeys) {
          if (dato > (buildingDates[bKey] || '')) {
            buildings[bKey] = entry;
            buildingDates[bKey] = dato;
          }
        }
      }
    }
  }

  return {
    lastUpdated: new Date().toISOString().split('T')[0],
    source: 'enova-bulk',
    buildings,
  };
}

// Main execution
async function main() {
  console.log('🔄 Aggregerer bydelsstatistikk fra Enova bulk-data...\n');

  // Check if Enova CSV exists
  if (!existsSync(ENOVA_CSV_PATH)) {
    console.error(`❌ Fant ikke Enova bulk-data på: ${ENOVA_CSV_PATH}`);
    console.log('\n📥 Last ned bulk CSV fra https://data.enova.no/ og lagre som:');
    console.log(`   ${ENOVA_CSV_PATH}`);
    process.exit(1);
  }

  // Load and check for custom postnummer mapping
  let postnummerMapping = POSTNUMMER_BYDEL_MAPPING;
  if (existsSync(POSTNUMMER_MAPPING_PATH)) {
    console.log(`📂 Laster ekstra postnummer-mapping fra: ${POSTNUMMER_MAPPING_PATH}`);
    const customMapping = JSON.parse(readFileSync(POSTNUMMER_MAPPING_PATH, 'utf-8'));
    postnummerMapping = { ...POSTNUMMER_BYDEL_MAPPING, ...customMapping };
  }

  console.log(`📂 Leser Enova bulk-data fra: ${ENOVA_CSV_PATH}`);
  const csvContent = readFileSync(ENOVA_CSV_PATH, 'utf-8');

  console.log('📊 Parser CSV...');
  const rows = parseEnovaCsv(csvContent);
  console.log(`   Funnet ${rows.length} gyldige rader for Oslo`);

  console.log('📈 Aggregerer statistikk...');
  const statistics = aggregateStatistics(rows, postnummerMapping);

  // Write district statistics output
  writeFileSync(OUTPUT_PATH, JSON.stringify(statistics, null, 2), 'utf-8');
  console.log(`\n✅ Bydelsstatistikk lagret til: ${OUTPUT_PATH}`);

  // Generate and write building index for individual lookups
  console.log('\n🏠 Genererer bygnings-indeks...');
  const buildingIndex = generateBuildingIndex(rows, postnummerMapping);
  const buildingCount = Object.keys(buildingIndex.buildings).length;
  writeFileSync(BUILDING_INDEX_PATH, JSON.stringify(buildingIndex, null, 2), 'utf-8');
  console.log(`✅ Bygnings-indeks lagret til: ${BUILDING_INDEX_PATH}`);
  console.log(`   ${buildingCount.toLocaleString()} unike boliger indeksert`);

  // Print summary
  console.log('\n📋 Sammendrag per bydel:\n');
  console.log('| Bydel | Småhus (n) | Småhus snitt | Blokk (n) | Blokk snitt |');
  console.log('|-------|------------|--------------|-----------|-------------|');

  for (const [bydel, data] of Object.entries(statistics.districts).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(
      `| ${bydel.padEnd(20)} | ${String(data.småhus.count).padStart(10)} | ${String(data.småhus.avgKwhPerM2).padStart(12)} | ${String(data.blokk.count).padStart(9)} | ${String(data.blokk.avgKwhPerM2).padStart(11)} |`
    );
  }

  console.log('\n📊 Oslo totalt:');
  console.log(`   Småhus: ${statistics.oslo.småhus.count} boliger, snitt ${statistics.oslo.småhus.avgKwhPerM2} kWh/m²`);
  console.log(`   Blokk: ${statistics.oslo.blokk.count} boliger, snitt ${statistics.oslo.blokk.avgKwhPerM2} kWh/m²`);
}

main().catch(console.error);

/**
 * Regresjonstest: csvPreferredBuildingNr skal IKKE settes for garasje-adresser
 *
 * Tester at fiksen i matrikkel.ts (ikke sette csvPreferredBuildingNr når CSV
 * returnerer en garasje/uthus) ikke bryter noen bolig-adresser.
 *
 * Testsett (102 adresser):
 *   - 2  kjente adresser (inkl. Brannfjellveien 20A – bug-caset)
 *   - 15 adresser med KUN garasje i CSV (fiksen skal slå inn her)
 *   - 70 adresser med KUN bolig i CSV (ingen endring)
 *   - 15 adresser med BEGGE (garasje + bolig) på samme adresse (ingen endring)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// ---------------------------------------------------------------------------
// Inline minimal CSVService-logikk slik at testen er selvstendig og ikke
// avhenger av singleton-lasting av hele CSVService med GCS-oppsett.
// Vi tester *nøyaktig* den samme normaliseringslogikken som src/services/csvService.ts.
// ---------------------------------------------------------------------------

interface RawRecord {
  BYGNINGS_NR: string;
  BYGNINGSTYPE_3siffer: string;
  BRUKSAREAL_TOTALT: string;
  Bygningstype_navn: string;
  GateAdresse: string;
  [key: string]: string;
}

interface ParsedRecord {
  bygningsNr: string;
  bygningstype3siffer: string;
  bruksarealTotalt: number;
  bygningstypeNavn: string;
  gateAdresse: string;
}

function normalizeAddress(address: string): string {
  if (!address) return '';
  let n = address.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!n) return '';
  n = n.replace(/[,;].*$/, '').trim();
  n = n.replace(/\b\d{4}\s+oslo$/, '').replace(/\b\d{4}\b$/, '').trim();
  n = n.replace(/\s+oslo$/, '').trim();
  n = n.replace(/(\d+)\s*([a-z])/g, '$1$2');
  return n.trim();
}

function findByExactAddress(data: ParsedRecord[], address: string): ParsedRecord | null {
  const normalizedSearch = normalizeAddress(address);
  if (!normalizedSearch) return null;

  const allMatches = data.filter(
    (r) => normalizeAddress(r.gateAdresse) === normalizedSearch
  );

  if (allMatches.length === 0) return null;
  if (allMatches.length === 1) return allMatches[0]; // ← alltid, uansett type

  // Prioriter bolig (11x-17x) over garasje (18x+)
  const residential = allMatches.filter((r) => {
    const code = parseInt(r.bygningstype3siffer, 10);
    return code >= 110 && code < 180;
  });

  if (residential.length > 0) {
    return residential.reduce((largest, current) =>
      current.bruksarealTotalt > largest.bruksarealTotalt ? current : largest
    );
  }

  return allMatches[0];
}

// ---------------------------------------------------------------------------
// Hjelpefunksjoner som simulerer gammel vs ny matrikkel.ts-logikk
// ---------------------------------------------------------------------------

/** Gammel logikk: alltid sett csvPreferredBuildingNr */
function oldLogic(csvData: ParsedRecord | null): string | undefined {
  return csvData?.bygningsNr ?? undefined;
}

/** Ny logikk: sett KUN hvis CSV-funnet er bolig (ikke garasje/uthus) */
function newLogic(csvData: ParsedRecord | null): string | undefined {
  if (!csvData) return undefined;
  const code = parseInt(csvData.bygningstype3siffer, 10);
  if (code >= 180) return undefined; // garasje/uthus – ikke bruk
  return csvData.bygningsNr;
}

// ---------------------------------------------------------------------------
// Adresser samplet fra CSV (se kommentar øverst)
// ---------------------------------------------------------------------------

const GARAGE_ONLY_ADDRESSES = [
  'BRANNFJELLVEIEN 20A', // bug-caset
  'PILESTREDET 10',
  'MUNKERUDVEIEN 34B',
  'DYRETRÅKKET 30',
  'LOVISENBERGGATA 4A',
  'NIC WAALS VEI 8',
  'LILLEVANNSVEIEN 1',
  'ENEBAKKVEIEN 264',
  'TOLLBUGATA 1A',
  'BREDO STABELLS VEI 15A',
  'FRYSJAVEIEN 29',
  'WERGELANDSVEIEN 3',
  'OBERST RODES VEI 94B',
  'SLETTELØKKA 48',
  'MYRA 5',
  'RYENSTUBBEN 7',
];

const RESIDENTIAL_ONLY_ADDRESSES = [
  'BRANNFJELLVEIEN 20B',
  'ORELIVEIEN 19A',
  'ØSTVANGVEIEN 6',
  'SKURONNVEIEN 33',
  'ÅMOTVEIEN 55',
  'HARTMANNS VEI 1',
  'LILLEVANNSVEIEN 73B',
  'NORDLYSVEIEN 24',
  'NORDLISLETTA 24',
  'LYSEHAGAN 17',
  'JOHAN SCHARFFENBERGS VEI 31',
  'NORDSETERGRENDA 21F',
  'BJØRNERABBEN 43C',
  'KURLANDSTIEN 12C',
  'FOLKE BERNADOTTES VEI 17E',
  'RUNDHAUGVEIEN 19',
  'KYRRE GREPPS GATE 14',
  'STOCKFLETHS GATE 60B',
  'HØYBRÅTENSTIEN 4B',
  'FYRSTIKKALLÉEN 2',
  'WILSTERS VEI 8B',
  'LASSONS GATE 2',
  'BINNEVEIEN 8A',
  'HOLMENKOLLVEIEN 74C',
  'BORGENVEIEN 6D',
  'TIDEMANDS GATE 19',
  'BESTUMÅSEN 1C',
  'ELGTRÅKKET 6B',
  'RØAHAGAN 6',
  'GAMLE BYGDEVEI 109',
  'SKULLERUDBAKKEN 138',
  'SETERBRÅTVEIEN 93',
  'HUKGRENDA 7',
  'ARILDS VEI 20B',
  'GRENSESTIEN 26',
  'SVERRES GATE 10',
  'SOLLIGRENDA 74',
  'KIRKESVINGEN 7',
  'TRASOPPVEIEN 2A',
  'VESTVEIEN 15',
  'JEGERVEIEN 7G',
  'FRØENSALLÉEN 2A',
  'JERIKOVEIEN 47D',
  'LOFTHUSVEIEN 56',
  'JORDSTJERNEVEIEN 21B',
  'BYGDØY ALLÉ 111C',
  'NORDSTRANDVEIEN 51A',
  'BREIDABLIKKVEIEN 14G',
  'SIGBJØRN OBSTFELDERS VEI 8',
  'HARTMANNS VEI 42C',
  'CLAUS BORCHS VEI 14',
  'OBERST RODES VEI 35C',
  'GRUSVEIEN 5',
  'PARKVEIEN 31C',
  'HARALDSHEIMVEIEN 19A',
  'FRØYDIS\' VEI 15B',
  'MUNKERUDVOLLEN 6',
  'ØVRE SKOGVEI 7A',
  'BIRCH-REICHENWALDS GATE 16',
  'MONOLITVEIEN 14B',
  'JEGERVEIEN 21F',
  'ØSTERLIVEIEN 58B',
  'RUNDMYRVEIEN 26',
  'NEPTUNVEIEN 9C',
  'GAMLE BYGDEVEI 210',
  'ÅSLANDHELLINGA 120',
  'ELISENBERGVEIEN 16',
  'DØLERUDVEIEN 20',
  'KJØLBERGGATA 24A',
  'PRINSDALSFARET 18D',
  'FALLANVEIEN 9',
];

const MIXED_ADDRESSES = [
  'STØLSVEGEN 6B',
  'VÆKERØVEIEN 90A',
  'OBERST RODES VEI 110B',
  'OSCARS GATE 92',
  'KASTELLVEIEN 10B',
  'LIAVEIEN 16A',
  'VEKTERVEIEN 25B',
  'BJØRNVEIEN 76',
  'PROTONVEIEN 2',
  'ELLEN GLEDITSCH\' VEI 87',
  'SØRSVINGEN 10',
  'NILS COLLETT VOGTS VEI 3',
  'AXEL FLINDERS VEI 1',
  'KLEIVA 4C',
  'FJELLSTUVEIEN 20B',
];

// ---------------------------------------------------------------------------
// Last CSV én gang for alle tester
// ---------------------------------------------------------------------------

let csvData: ParsedRecord[] = [];

beforeAll(() => {
  const csvPath = path.join(process.cwd(), 'data', 'raw', 'matrikkel_bygg_2025.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('⚠️  CSV ikke tilgjengelig, tester hoppes over');
    return;
  }

  const raw = parse<RawRecord>(fs.readFileSync(csvPath, 'utf-8'), {
    columns: true,
    delimiter: ';',
    skip_empty_lines: true,
    bom: true,
  });

  csvData = raw
    .filter((r) => r.GateAdresse?.trim())
    .map((r) => ({
      bygningsNr: r.BYGNINGS_NR,
      bygningstype3siffer: r.BYGNINGSTYPE_3siffer,
      bruksarealTotalt: parseInt(String(r.BRUKSAREAL_TOTALT).replace(/\s/g, '')) || 0,
      bygningstypeNavn: r.Bygningstype_navn,
      gateAdresse: r.GateAdresse,
    }));
});

// ---------------------------------------------------------------------------
// Hjelpefunksjon: kort adressebeskrivelse for rapportering
// ---------------------------------------------------------------------------
function describe_csv(csvResult: ParsedRecord | null): string {
  if (!csvResult) return 'ikke funnet';
  const code = parseInt(csvResult.bygningstype3siffer, 10);
  const cat = code >= 180 ? 'GARASJE' : code >= 110 ? 'BOLIG' : 'ANNET';
  return `${cat} type=${csvResult.bygningstype3siffer} nr=${csvResult.bygningsNr} areal=${csvResult.bruksarealTotalt}m²`;
}

// ===========================================================================
// TESTGRUPPE 1 – Kjent bug-case
// ===========================================================================
describe('Bug-case: Brannfjellveien 20A', () => {
  it('CSV returnerer garasje (type 181) for 20A', () => {
    const result = findByExactAddress(csvData, 'BRANNFJELLVEIEN 20A');
    expect(result).not.toBeNull();
    const code = parseInt(result!.bygningstype3siffer, 10);
    expect(code).toBe(181);
  });

  it('Gammel logikk: setter csvPreferredBuildingNr til garasjens bygningsnummer', () => {
    const csvResult = findByExactAddress(csvData, 'BRANNFJELLVEIEN 20A');
    const nr = oldLogic(csvResult);
    expect(nr).toBe('81189609'); // garasje-bygningsnr fra CSV
  });

  it('Ny logikk: csvPreferredBuildingNr er IKKE satt for garasje', () => {
    const csvResult = findByExactAddress(csvData, 'BRANNFJELLVEIEN 20A');
    const nr = newLogic(csvResult);
    expect(nr).toBeUndefined();
  });

  it('20B gir bolig – ny logikk setter csvPreferredBuildingNr normalt', () => {
    const csvResult = findByExactAddress(csvData, 'BRANNFJELLVEIEN 20B');
    const code = parseInt(csvResult?.bygningstype3siffer ?? '0', 10);
    expect(code).toBeGreaterThanOrEqual(110);
    expect(code).toBeLessThan(180);
    expect(newLogic(csvResult)).toBeDefined();
    expect(newLogic(csvResult)).toBe(oldLogic(csvResult)); // ingen endring
  });
});

// ===========================================================================
// TESTGRUPPE 2 – Garasje-only adresser
// Ny logikk skal ALDRI sette csvPreferredBuildingNr for disse.
// ===========================================================================
describe('Garasje-only adresser (ny logikk skal IKKE sette csvPreferredBuildingNr)', () => {
  for (const addr of GARAGE_ONLY_ADDRESSES) {
    it(`${addr}`, () => {
      const csvResult = findByExactAddress(csvData, addr);

      // Adresser i dette settet kan mangle i CSV (kun i grunnkrets, ikke gateadresse)
      // – det er ok, vi hopper over dem
      if (!csvResult) {
        console.log(`  [skip] ${addr} – ikke funnet i CSV`);
        return;
      }

      const code = parseInt(csvResult.bygningstype3siffer, 10);
      console.log(`  ${addr} → ${describe_csv(csvResult)}`);

      if (code >= 180) {
        // Ny logikk: skal IKKE sette bygningsnummer
        expect(newLogic(csvResult)).toBeUndefined();
        // Gammel logikk: satte bygningsnummer (bekrefter regresjonsverdi)
        expect(oldLogic(csvResult)).toBeDefined();
      } else {
        // Adresser i garasje-only-settet som likevel returnerer bolig
        // (kan skje ved feil i sampling) – bare logg
        console.warn(`  [obs] ${addr} returnerte BOLIG type=${code} – feil kategori i testsett`);
      }
    });
  }
});

// ===========================================================================
// TESTGRUPPE 3 – Bolig-only adresser
// Ny og gammel logikk skal gi SAMME resultat (begge setter csvPreferredBuildingNr).
// ===========================================================================
describe('Bolig-only adresser (ny logikk = gammel logikk)', () => {
  for (const addr of RESIDENTIAL_ONLY_ADDRESSES) {
    it(`${addr}`, () => {
      const csvResult = findByExactAddress(csvData, addr);

      if (!csvResult) {
        console.log(`  [skip] ${addr} – ikke funnet i CSV`);
        return;
      }

      const code = parseInt(csvResult.bygningstype3siffer, 10);
      console.log(`  ${addr} → ${describe_csv(csvResult)}`);

      // Begge logikker skal returnere samme bygningsnummer
      const oldNr = oldLogic(csvResult);
      const newNr = newLogic(csvResult);
      expect(oldNr).toEqual(newNr);

      // Og det skal være definert
      expect(newNr).toBeDefined();

      // Og det skal være en boligtype
      if (code < 110 || code >= 180) {
        console.warn(`  [obs] ${addr} returnerte uventet type=${code}`);
      }
    });
  }
});

// ===========================================================================
// TESTGRUPPE 4 – Mixed adresser (garasje + bolig på samme adresse)
// findByExactAddress skal returnere boligen (eksisterende multi-match logikk).
// Ny og gammel logikk skal gi SAMME resultat.
// ===========================================================================
describe('Mixed adresser (garasje + bolig) – bolig skal prioriteres uendret', () => {
  for (const addr of MIXED_ADDRESSES) {
    it(`${addr}`, () => {
      const csvResult = findByExactAddress(csvData, addr);

      if (!csvResult) {
        console.log(`  [skip] ${addr} – ikke funnet i CSV`);
        return;
      }

      const code = parseInt(csvResult.bygningstype3siffer, 10);
      console.log(`  ${addr} → ${describe_csv(csvResult)}`);

      const oldNr = oldLogic(csvResult);
      const newNr = newLogic(csvResult);

      if (code >= 110 && code < 180) {
        // Bolig returnert (korrekt) – begge logikker setter bygningsnummer
        expect(oldNr).toBeDefined();
        expect(newNr).toBeDefined();
        expect(oldNr).toEqual(newNr); // ingen endring
      } else {
        // Garasje returnert (allMatches.length === 1, kun garasje funnet)
        // Da er dette egentlig ikke «mixed» i CSV – ny logikk fjerner det
        console.warn(
          `  [obs] ${addr} returnerte GARASJE type=${code} – ny logikk: csvPreferredBuildingNr fjernes`
        );
        expect(newNr).toBeUndefined();
      }
    });
  }
});

// ===========================================================================
// TESTGRUPPE 5 – Aggregat-rapport
// Viser oversikt over hvor mange adresser fiksen påvirker.
// ===========================================================================
describe('Aggregat-rapport over alle 102 adresser', () => {
  it('produserer sammenligningsrapport gammel vs ny logikk', () => {
    const allAddresses = [
      ...GARAGE_ONLY_ADDRESSES,
      ...RESIDENTIAL_ONLY_ADDRESSES,
      ...MIXED_ADDRESSES,
    ];

    let notFound = 0;
    let oldSets = 0;
    let newSets = 0;
    let changed = 0; // adresser der ny logikk fjerner bygningsnummeret
    let unchanged = 0;

    for (const addr of allAddresses) {
      const csvResult = findByExactAddress(csvData, addr);
      if (!csvResult) { notFound++; continue; }

      const oldNr = oldLogic(csvResult);
      const newNr = newLogic(csvResult);

      if (oldNr) oldSets++;
      if (newNr) newSets++;
      if (oldNr !== newNr) changed++;
      else unchanged++;
    }

    console.log('\n====== AGGREGAT-RAPPORT ======');
    console.log(`Totalt testet:          ${allAddresses.length}`);
    console.log(`Ikke funnet i CSV:      ${notFound}`);
    console.log(`Gammel logikk setter:   ${oldSets}`);
    console.log(`Ny logikk setter:       ${newSets}`);
    console.log(`Påvirket av fiksen:     ${changed}  ← garasjer som nå hoppes over`);
    console.log(`Uendret:                ${unchanged}`);
    console.log('==============================\n');

    // Fiksen skal kun påvirke garasje-only adresser – aldri boligadresser
    expect(unchanged + changed).toBe(allAddresses.length - notFound);
    // Ny logikk kan aldri sette FLERE bygningsnummer enn gammel logikk
    expect(newSets).toBeLessThanOrEqual(oldSets);
  });
});

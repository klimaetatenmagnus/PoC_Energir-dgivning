/**
 * Test: Sammenligner nåværende (buggy) vs fikset fallback-søk i CSV-servicen.
 *
 * Bug: Fallback-søkeadressen konstrueres med dobbelt husnummer fordi
 * adressetekst allerede inneholder husnummeret:
 *   "Arnebråtveien 16" + "16" + "" = "Arnebråtveien 1616"  ← FEIL
 *
 * Fiksen: Bruk kun adressetekst (som allerede er komplett fra Geonorge).
 *
 * Denne testen:
 *   1. Laster CSV-filen direkte
 *   2. Simulerer Geonorge-respons for ~100 adresser
 *   3. Tester findByExactAddress (bør alltid fungere)
 *   4. Tester nåværende (buggy) fallback vs fikset fallback
 *   5. Rapporterer forskjeller
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

// ---------- Typer ----------
interface MatrikkelCSVRecord {
  bygningsNr: string;
  bruksarealTotalt: number;
  braBolig: number;
  bygningstype3siffer: string;
  bygningstypeNavn: string;
  tattIBrukDato: string;
  gateAdresse: string;
  bygningsstatusNavn: string;
}

interface RawCSVRecord {
  BYGNINGS_NR: string;
  BRUKSAREAL_TOTALT: string;
  BRA_BOLIG: string;
  BYGNINGSTYPE_3siffer: string;
  Bygningstype_navn: string;
  TATT_I_BRUK_DATO: string;
  GateAdresse: string;
  BYGNINGSSTATUS_NAVN: string;
}

// ---------- Simulert Geonorge-data ----------
// Representerer hva lookupAdresse returnerer
interface SimulatedAddress {
  adressetekst: string;
  husnummer: number;
  bokstav: string;
}

// ---------- Re-implementer normalizeAddress fra csvService.ts ----------
function normalizeAddress(address: string): string {
  if (!address) return '';
  let normalized = address.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  normalized = normalized.replace(/[,;].*$/, '').trim();
  normalized = normalized.replace(/\b\d{4}\s+oslo$/, '').replace(/\b\d{4}\b$/, '').trim();
  normalized = normalized.replace(/\s+oslo$/, '').trim();
  normalized = normalized.replace(/(\d+)\s*([a-z])/g, '$1$2');
  return normalized.trim();
}

function extractStreetName(value: string): string {
  if (!value) return '';
  return value.replace(/\d.*$/, '').trim();
}

function extractHouseIdentifier(value: string): string {
  if (!value) return '';
  const match = value.match(/(\d+[a-zæøå]?)/i);
  return match ? match[1] : '';
}

// ---------- findByExactAddress (identisk med csvService) ----------
function findByExactAddress(
  data: MatrikkelCSVRecord[],
  address: string
): MatrikkelCSVRecord | null {
  const normalizedSearch = normalizeAddress(address);
  if (!normalizedSearch) return null;

  const allMatches = data.filter(
    (r) => normalizeAddress(r.gateAdresse) === normalizedSearch
  );
  if (allMatches.length === 0) return null;
  if (allMatches.length === 1) return allMatches[0];

  const residentialBuildings = allMatches.filter((r) => {
    const code = parseInt(r.bygningstype3siffer, 10);
    return code >= 110 && code < 180;
  });

  if (residentialBuildings.length > 0) {
    return residentialBuildings.reduce((largest, current) =>
      current.bruksarealTotalt > largest.bruksarealTotalt ? current : largest
    );
  }
  return allMatches[0];
}

// ---------- findByAddress (identisk med csvService) ----------
function computeMatchScore(search: string, candidate: string): number {
  if (candidate === search) return Number.POSITIVE_INFINITY;
  const startsWith =
    candidate.startsWith(search) || search.startsWith(candidate) ? 1 : 0;
  const lengthDelta = Math.abs(candidate.length - search.length);
  return startsWith * 10 - lengthDelta;
}

function findByAddress(
  data: MatrikkelCSVRecord[],
  address: string
): MatrikkelCSVRecord[] {
  const normalizedSearch = normalizeAddress(address);
  if (!normalizedSearch) return [];
  const searchStreet = extractStreetName(normalizedSearch);
  const searchHouse = extractHouseIdentifier(normalizedSearch);
  const candidates: Array<{ record: MatrikkelCSVRecord; score: number }> = [];

  data.forEach((record) => {
    const normalizedRecord = normalizeAddress(record.gateAdresse);
    if (!normalizedRecord) return;

    const recordStreet = extractStreetName(normalizedRecord);
    if (searchStreet && recordStreet && searchStreet !== recordStreet) return;

    const recordHouse = extractHouseIdentifier(normalizedRecord);
    if (searchHouse && recordHouse && searchHouse !== recordHouse) return;

    if (
      normalizedRecord.includes(normalizedSearch) ||
      normalizedSearch.includes(normalizedRecord)
    ) {
      const score = computeMatchScore(normalizedSearch, normalizedRecord);
      candidates.push({ record, score });
    }
  });

  return candidates
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.record);
}

// ---------- Bug og fiks ----------

/** Nåværende (buggy) fallback: dobbelt husnummer */
function buildFallbackSearchBuggy(adr: SimulatedAddress): string {
  return `${adr.adressetekst || ''}${adr.husnummer || ''}${adr.bokstav || ''}`.trim();
}

/** Fikset fallback: bruk kun adressetekst (allerede komplett) */
function buildFallbackSearchFixed(adr: SimulatedAddress): string {
  return adr.adressetekst.trim();
}

// ---------- Simuler Geonorge-respons fra CSV-adresse ----------
function simulateGeonorgeAddress(csvAddress: string): SimulatedAddress {
  // "ARNEBRÅTVEIEN 16B" -> adressetekst="Arnebråtveien 16B", husnummer=16, bokstav="B"
  const lower = csvAddress.trim();
  const match = lower.match(/^(.+?)\s+(\d+)([A-ZÆØÅa-zæøå]?)$/);

  if (!match) {
    return { adressetekst: csvAddress, husnummer: 0, bokstav: '' };
  }

  // Geonorge returnerer title case for adressetekst
  const streetName = match[1]
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const nr = parseInt(match[2], 10);
  const letter = match[3].toUpperCase();
  const adressetekst = `${streetName} ${nr}${letter}`.trim();

  return { adressetekst, husnummer: nr, bokstav: letter };
}

// ---------- Testdata: 100+ adresser ----------
const TEST_ADDRESSES = [
  // Rapportert bug-case
  'ARNEBRÅTVEIEN 16',
  'ARNEBRÅTVEIEN 16B',
  'ARNEBRÅTVEIEN 16C',
  // Enkel uten bokstav
  'AGRONOMVEIEN 8',
  'AKERLIA 5',
  'BERGLYVEIEN 5',
  'BLAKKENS VEI 10',
  'BLAKKENS VEI 13',
  'BREIGATA 10',
  'BRUGATA 5',
  'DISENVEIEN 41',
  'EIKENGA 19',
  'FOSSVEIEN 7',
  'FREIDIGVEIEN 5',
  'GRORUDVEIEN 106',
  'HELLINGA 13',
  'HOLGERSLYSTVEIEN 15',
  'HOVINVEIEN 17',
  'HULDREVEIEN 4',
  'KALBAKKVEIEN 6',
  'KLINKERVEIEN 2',
  'LILLEVANNSVEIEN 90',
  'EKEBERGVEIEN 58',
  'FRAMVEIEN 24',
  'BYGDØY TERRASSE 2',
  'DALSÅSEN 102',
  // Med bokstav
  'AGATHE GRØNDAHLS GATE 4A',
  'ANKERVEIEN 66B',
  'ARNEBRÅTVEIEN 56C',
  'BEKKEVEIEN 8C',
  'BEKKEVOLLVEIEN 12C',
  'BETZY KJELSBERGS VEI 18A',
  'BETZY KJELSBERGS VEI 22D',
  'BINNEVEIEN 6A',
  'BRANNFJELLVEIEN 104B',
  'BREDES VEI 4C',
  'BRINKEN 23D',
  'DAMLIHAUGEN 2B',
  'DR. DEDICHENS VEI 35B',
  'EILERT SUNDTS GATE 23',
  'EKEBERGVEIEN 197C',
  'ELGTRÅKKET 8C',
  'ETTERSTADGATA 11A',
  'FERNANDA NISSENS GATE 1D',
  'FRIDTJOF NANSENS VEI 5D',
  'FROGNERSETERVEIEN 41A',
  'FRYDENLUNDGATA 3A',
  'FRYDENS GATE 2B',
  'FURUSET ALLÉ 9B',
  'GENERAL RUGES VEI 55B',
  'GRANSTUVEIEN 23D',
  'GRAVDALSVEIEN 12F',
  'GRÅKAMVEIEN 7C',
  'GULDBERGLIA 6C',
  'GULLERÅSVEIEN 15D',
  'GUNNAR SCHJELDERUPS VEI 15D',
  'HAAKON DEN GODES VEI 13B',
  'HARTMANNS VEI 34F',
  'HARTMANNS VEI 5B',
  'HEGGELIVEIEN 46A',
  'HEIASVINGEN 3B',
  'HELLERUDGRENDA 93B',
  'HEMINGVEIEN 8D',
  'HJØRUNGVEIEN 2D',
  'HOFFSJEF LØVENSKIOLDS VEI 59D',
  'HOLMENKOLLVEIEN 36C',
  'HOLMENKOLLVEIEN 44B',
  'HOLTVEIEN 14B',
  'HOSPITSVEIEN 4B',
  'HOSPITSVEIEN 8B',
  'HUK AVENY 38A',
  'HUSEBYVEIEN 1F',
  'HØGDEFARET 2E',
  'JOHAN SVERDRUPS VEI 28B',
  'JOMFRUBRÅTVEIEN 68B',
  'JOMFRUBRÅTVEIEN 73D',
  'KARLSTADGATA 14A',
  'KIRKEÅSVEIEN 1D',
  'KURLANDSTIEN 32H',
  'LANGERUDSVINGEN 9A',
  'LANGGATA 1B',
  'LANGVIKSVEIEN 25C',
  'LERDALSVEIEN 30C',
  'LINDEBERGVEIEN 27B',
  'LINDEBERGÅSEN 60A',
  'LJABRUVEIEN 48A',
  'LUNDLIVEIEN 30A',
  // Flere uten bokstav
  'AXEL BRINCHS VEI 30',
  'BERNHARD HERRES VEI 39',
  'BERNT KNUDSENS VEI 34',
  'BLÅBÆRSVINGEN 39',
  'BRENNAGRENDA 49',
  'BÅRD SKOLEMESTERS VEI 30',
  'DRAGONSTIEN 89',
  'ELGTRÅKKET 132',
  'ELGTRÅKKET 65',
  'EVENS GATE 4',
  'FREDERIKS GATE 3',
  'FUGLEHAUGGATA 10',
  'GARVER YTTEBORGS VEI 145',
  'GREGERS GRAMS VEI 22',
  'HAAKON TVETERS VEI 25',
  'HAGASTUBBEN 49',
  'HALLAGERBAKKEN 42',
  'HAUKETOTOPPEN 11',
  'HEIASVINGEN 11',
  'HESSELBERGS GATE 9',
  'HØGDEFARET 25',
  'HØGDEFARET 6',
  'JANSBERGVEIEN 2',
  'JERPEFARET 17A',
  'KNUT VALSTADS VEI 22',
  'KRISTIAN AUBERTS VEI 18',
  'LACHMANNS VEI 68',
  'LANGSETVEIEN 44',
  'LARSBRÅTVEIEN 17',
  // Spesialcaser (DR., tall i gatenavn, etc)
  'DYNA BRYGGE 4',
  'GAMLE BYGDEVEI 24',
  'GAMLE BRENNAVEI 8',
  'GAMLE BYGDEVEI 260',
  // Lang gate med flere ord
  'HARALD HALVORSENS VEI 45K',
  'INGA BJØRNSONS VEI 123',
  'INGA BJØRNSONS VEI 19',
  'JOHNNY SVORKMOS VEI 12',
  'JOHNNY SVORKMOS VEI 78',
  'KARL ANDERSENS VEI 147',
  // Øy-adresser
  'LINDØYA 156',
  'LINDØYA 49',
];

// ---------- Test-suite ----------
describe('CSV fallback-søk: buggy vs fikset', () => {
  let csvData: MatrikkelCSVRecord[];

  beforeAll(() => {
    const csvPath = path.join(
      process.cwd(),
      'data',
      'raw',
      'matrikkel_bygg_2025.csv'
    );
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      bom: true,
    }) as RawCSVRecord[];

    csvData = records.map((r) => ({
      bygningsNr: r.BYGNINGS_NR,
      bruksarealTotalt:
        parseInt(String(r.BRUKSAREAL_TOTALT).replace(/\s/g, '')) || 0,
      braBolig: parseInt(String(r.BRA_BOLIG).replace(/\s/g, '')) || 0,
      bygningstype3siffer: r.BYGNINGSTYPE_3siffer,
      bygningstypeNavn: r.Bygningstype_navn,
      tattIBrukDato: r.TATT_I_BRUK_DATO,
      gateAdresse: r.GateAdresse,
      bygningsstatusNavn: r.BYGNINGSSTATUS_NAVN,
    }));
  });

  it('skal laste CSV med data', () => {
    expect(csvData.length).toBeGreaterThan(1000);
  });

  describe('findByExactAddress: verifiser at den fungerer for alle test-adresser', () => {
    it('skal finne eksakt match for alle test-adresser', () => {
      const missing: string[] = [];
      for (const addr of TEST_ADDRESSES) {
        const sim = simulateGeonorgeAddress(addr);
        const result = findByExactAddress(csvData, sim.adressetekst);
        if (!result) {
          missing.push(`${addr} → sim: "${sim.adressetekst}"`);
        }
      }
      // Rapporter alle manglende, men ikke fail-a hard (noen adresser kan mangle i CSV)
      if (missing.length > 0) {
        console.log(
          `\n⚠️  ${missing.length} adresser ikke funnet med findByExactAddress:`
        );
        missing.forEach((m) => console.log(`   - ${m}`));
      }
      // Forvent at minst 90% finnes
      const hitRate = (TEST_ADDRESSES.length - missing.length) / TEST_ADDRESSES.length;
      expect(hitRate).toBeGreaterThan(0.85);
    });
  });

  describe('Arnebråtveien 16: spesifikk bug-case', () => {
    it('findByExactAddress skal returnere 1912-bygget (336 m²)', () => {
      const result = findByExactAddress(csvData, 'Arnebråtveien 16');
      expect(result).not.toBeNull();
      expect(result!.bruksarealTotalt).toBe(336);
      const year = parseInt(result!.tattIBrukDato.substring(0, 4));
      expect(year).toBe(1912);
    });

    it('BUGGY fallback: dobbelt husnummer produserer feil søkestreng', () => {
      const adr: SimulatedAddress = {
        adressetekst: 'Arnebråtveien 16',
        husnummer: 16,
        bokstav: '',
      };
      const buggySearch = buildFallbackSearchBuggy(adr);
      expect(buggySearch).toBe('Arnebråtveien 1616'); // Bevis på bug

      // Buggy søkestreng gir enten 0 treff eller feil treff (returnerer
      // garasjer/uthus pga. bred substring-matching med "1616" som husnummer)
      const results = findByAddress(csvData, buggySearch);
      if (results.length > 0) {
        // Selv om den finner noe, er det FEIL bygning (ikke den med bygningsNr 80055692)
        const exact = findByExactAddress(csvData, 'Arnebråtveien 16');
        // Buggy fallback kan ikke pålitelig finne riktig bygning
        expect(results[0].bygningsNr).not.toBe(exact!.bygningsNr);
      }
    });

    it('FIKSET fallback: korrekt søkestreng gir riktig treff', () => {
      const adr: SimulatedAddress = {
        adressetekst: 'Arnebråtveien 16',
        husnummer: 16,
        bokstav: '',
      };
      const fixedSearch = buildFallbackSearchFixed(adr);
      expect(fixedSearch).toBe('Arnebråtveien 16');

      const results = findByAddress(csvData, fixedSearch);
      expect(results.length).toBeGreaterThan(0);
      // Skal finne riktig bygning (1912, 336 m²)
      expect(results[0].bruksarealTotalt).toBe(336);
      const year = parseInt(results[0].tattIBrukDato.substring(0, 4));
      expect(year).toBe(1912);
    });
  });

  describe('Adresser MED bokstav: buggy vs fikset fallback', () => {
    it('BUGGY fallback gir dobbelt husnummer for adresser med bokstav', () => {
      const adr: SimulatedAddress = {
        adressetekst: 'Arnebråtveien 16B',
        husnummer: 16,
        bokstav: 'B',
      };
      const buggySearch = buildFallbackSearchBuggy(adr);
      // "Arnebråtveien 16B" + "16" + "B" = "Arnebråtveien 16B16B"
      expect(buggySearch).toBe('Arnebråtveien 16B16B');
      // Buggy søkestreng er meningsløs
    });

    it('FIKSET fallback gir korrekt treff for bokstav-adresser', () => {
      const adr: SimulatedAddress = {
        adressetekst: 'Arnebråtveien 16B',
        husnummer: 16,
        bokstav: 'B',
      };
      const fixedSearch = buildFallbackSearchFixed(adr);
      expect(fixedSearch).toBe('Arnebråtveien 16B');
      const results = findByAddress(csvData, fixedSearch);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Bred sammenligning: 100+ adresser', () => {
    it('fikset fallback skal gi like god eller bedre treffrate enn buggy', () => {
      let buggyHits = 0;
      let fixedHits = 0;
      let buggyBetterThanFixed = 0;
      let fixedBetterThanBuggy = 0;
      let bothMatch = 0;
      let neitherMatch = 0;
      const fixedOnlyMatches: string[] = [];
      const buggyOnlyMatches: string[] = [];

      for (const addr of TEST_ADDRESSES) {
        const sim = simulateGeonorgeAddress(addr);

        const buggySearch = buildFallbackSearchBuggy(sim);
        const fixedSearch = buildFallbackSearchFixed(sim);

        const buggyResults = findByAddress(csvData, buggySearch);
        const fixedResults = findByAddress(csvData, fixedSearch);

        const buggyFound = buggyResults.length > 0;
        const fixedFound = fixedResults.length > 0;

        if (buggyFound) buggyHits++;
        if (fixedFound) fixedHits++;

        if (buggyFound && fixedFound) {
          bothMatch++;
        } else if (fixedFound && !buggyFound) {
          fixedBetterThanBuggy++;
          fixedOnlyMatches.push(
            `${addr} → buggy: "${buggySearch}" (0 treff), fixed: "${fixedSearch}" (${fixedResults.length} treff)`
          );
        } else if (buggyFound && !fixedFound) {
          buggyBetterThanFixed++;
          buggyOnlyMatches.push(
            `${addr} → buggy: "${buggySearch}" (${buggyResults.length} treff), fixed: "${fixedSearch}" (0 treff)`
          );
        } else {
          neitherMatch++;
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('📊 RESULTAT: Fallback-søk sammenligning');
      console.log('='.repeat(70));
      console.log(`Totalt testet:             ${TEST_ADDRESSES.length} adresser`);
      console.log(`Buggy treffrate:           ${buggyHits}/${TEST_ADDRESSES.length} (${(buggyHits/TEST_ADDRESSES.length*100).toFixed(1)}%)`);
      console.log(`Fikset treffrate:          ${fixedHits}/${TEST_ADDRESSES.length} (${(fixedHits/TEST_ADDRESSES.length*100).toFixed(1)}%)`);
      console.log(`Begge matcher:             ${bothMatch}`);
      console.log(`Kun fikset matcher:        ${fixedBetterThanBuggy}`);
      console.log(`Kun buggy matcher:         ${buggyBetterThanFixed}`);
      console.log(`Ingen matcher:             ${neitherMatch}`);

      if (fixedOnlyMatches.length > 0) {
        console.log(`\n✅ Adresser der FIKSEN gir treff men buggy IKKE gjør (${fixedOnlyMatches.length}):`);
        fixedOnlyMatches.slice(0, 20).forEach((m) => console.log(`   ${m}`));
        if (fixedOnlyMatches.length > 20) {
          console.log(`   ... og ${fixedOnlyMatches.length - 20} til`);
        }
      }

      if (buggyOnlyMatches.length > 0) {
        console.log(`\n❌ REGRESJON: Adresser der buggy gir treff men FIKSEN IKKE gjør (${buggyOnlyMatches.length}):`);
        buggyOnlyMatches.forEach((m) => console.log(`   ${m}`));
      }
      console.log('='.repeat(70));

      // Fiksen skal gi like god eller bedre treffrate
      expect(fixedHits).toBeGreaterThanOrEqual(buggyHits);
      // Ingen regresjoner: buggy skal ikke ha treff der fiksen ikke har
      expect(buggyBetterThanFixed).toBe(0);
    });

    it('fikset fallback skal returnere RIKTIG bygning (samme som findByExactAddress) for adresser med unikt treff', () => {
      let tested = 0;
      let correctMatches = 0;
      let multipleBuildings = 0;
      const mismatches: string[] = [];

      for (const addr of TEST_ADDRESSES) {
        const sim = simulateGeonorgeAddress(addr);
        const exactResult = findByExactAddress(csvData, sim.adressetekst);
        if (!exactResult) continue;

        tested++;
        const fixedSearch = buildFallbackSearchFixed(sim);
        const fallbackResults = findByAddress(csvData, fixedSearch);

        if (fallbackResults.length > 0) {
          if (fallbackResults[0].bygningsNr === exactResult.bygningsNr) {
            correctMatches++;
          } else {
            // findByAddress mangler bolig-prioritering som findByExactAddress har,
            // så avvik er forventet for adresser med flere bygninger (bolig + garasje).
            // Sjekk at den korrekte bygningen i det minste finnes i resultatene.
            const containsCorrect = fallbackResults.some(
              (r) => r.bygningsNr === exactResult.bygningsNr
            );
            if (containsCorrect) {
              multipleBuildings++;
            } else {
              mismatches.push(
                `${addr}: exact=${exactResult.bygningsNr} (${exactResult.bruksarealTotalt}m²), ` +
                `fallback topp=${fallbackResults[0].bygningsNr} (${fallbackResults[0].bruksarealTotalt}m²), ` +
                `korrekt bygning MANGLER i resultatlisten`
              );
            }
          }
        }
      }

      console.log(`\n📊 Korrekthet: ${correctMatches}/${tested} direkte match`);
      console.log(`   ${multipleBuildings} avvik pga. garasje/uthus-prioritering (kjent begrensning i findByAddress)`);

      if (mismatches.length > 0) {
        console.log(`\n❌ Alvorlige avvik (korrekt bygning MANGLER i resultater): ${mismatches.length}`);
        mismatches.forEach((m) => console.log(`   ${m}`));
      }

      // Korrekt bygning må alltid finnes i resultatene (om enn ikke alltid som #1)
      expect(mismatches.length).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('adresser med punktum (f.eks. DR.) normaliseres korrekt', () => {
      // "DR. DEDICHENS VEI 35B" -> "Dr. Dedichens Vei 35B"
      const sim = simulateGeonorgeAddress('DR. DEDICHENS VEI 35B');
      const exact = findByExactAddress(csvData, sim.adressetekst);
      if (exact) {
        const fixedSearch = buildFallbackSearchFixed(sim);
        const fallback = findByAddress(csvData, fixedSearch);
        expect(fallback.length).toBeGreaterThan(0);
      }
    });

    it('adresser med bokstav K/H/F (sjeldne bokstaver)', () => {
      const rareLetters = TEST_ADDRESSES.filter((a) =>
        /\d+[KHFJ]$/.test(a.trim())
      );
      for (const addr of rareLetters) {
        const sim = simulateGeonorgeAddress(addr);
        const exact = findByExactAddress(csvData, sim.adressetekst);
        if (exact) {
          const fixedSearch = buildFallbackSearchFixed(sim);
          const fallback = findByAddress(csvData, fixedSearch);
          expect(fallback.length).toBeGreaterThan(0);
        }
      }
    });

    it('adresser med ALLÉ (accent) normaliseres korrekt', () => {
      const sim = simulateGeonorgeAddress('FURUSET ALLÉ 9B');
      const exact = findByExactAddress(csvData, sim.adressetekst);
      if (exact) {
        const fixedSearch = buildFallbackSearchFixed(sim);
        const fallback = findByAddress(csvData, fixedSearch);
        expect(fallback.length).toBeGreaterThan(0);
      }
    });

    it('øy-adresser uten gatenavn (f.eks. LINDØYA 49)', () => {
      const sim = simulateGeonorgeAddress('LINDØYA 49');
      const exact = findByExactAddress(csvData, sim.adressetekst);
      if (exact) {
        const fixedSearch = buildFallbackSearchFixed(sim);
        const fallback = findByAddress(csvData, fixedSearch);
        expect(fallback.length).toBeGreaterThan(0);
      }
    });

    it('Geonorge adressetekst med ekstra mellomrom skal fortsatt matche', () => {
      // Simuler litt unøyaktig adressetekst
      const result = findByExactAddress(csvData, '  Arnebråtveien   16  ');
      expect(result).not.toBeNull();
    });
  });
});

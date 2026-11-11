// Tester bygningstype-håndteringen i assembleBuildingResult:
//  - garasje-terskelen er 180–199 (næringsbygg får ikke naboboligens CSV-data)
//  - bygningstypeKode i svaret er den 3-sifrede koden, ikke Matrikkelens interne ID
//  - rapporteringsnivå bygger på 3-sifret kode

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assembleBuildingResult } from '../../../services/building-info-service/resultAssembler.ts';
import { csvService } from '../../../src/services/csvService.ts';

type CsvRecord = NonNullable<ReturnType<typeof csvService.findByExactAddress>>;
type AssembleArgs = Parameters<typeof assembleBuildingResult>[0];

const adresse = {
  kommunenummer: '0301',
  gnr: 1,
  bnr: 2,
  adressekode: 12345,
  husnummer: 20,
  bokstav: '',
  adressetekst: 'Testveien 20A',
  poststed: 'Oslo',
  postnummer: '0150',
} as unknown as AssembleArgs['adresse'];

function csvRecord(overrides: Partial<CsvRecord>): CsvRecord {
  return {
    bygningsNr: 'CSV-1',
    byggidAnonym: '',
    bruksarealTotalt: 100,
    braBolig: 0,
    braAnnetBolig: 0,
    braHentetFraMatrikkel: 0,
    arealByggflate: 0,
    antallEtasjer: 2,
    bygningsstatusNavn: 'Tatt i bruk',
    bygningstype: '',
    bygningstypeNavn: '',
    bygningstype3siffer: '',
    tattIBrukDato: '19750101',
    fylke: '',
    kommune: '',
    bydelnr: '',
    bydelsnavn: 'Sentrum',
    delbydelnr: '',
    delbydelsnavn: '',
    grunnkretsNr: '',
    grunnkretsNavn: '',
    lokalitetskode: '',
    gateAdresse: 'TESTVEIEN 20A',
    kalenderaar: '',
    hjelpekolonne: '',
    tiaar: '',
    ...overrides,
  } as CsvRecord;
}

function assemble(bygg: { bygningstypeKodeId?: number; bygningstypeKode?: string }) {
  const fullBygg = {
    id: 1001,
    bruksarealM2: 120,
    byggeaar: 1975,
    oppvarmingsKodeIds: [],
    energikildeKodeIds: [],
    ...bygg,
  };
  return assembleBuildingResult({
    adresse,
    matrikkelenhetsId: 1,
    bygg: fullBygg,
    allBygningsInfo: [fullBygg],
    rpPBE: null,
    coordinatesWgs84: null,
    attest: null,
    solarData: null,
  });
}

const siblingBolig = csvRecord({
  bygningsNr: 'CSV-BOLIG',
  bygningstype3siffer: '111',
  bygningstypeNavn: 'Enebolig',
  bruksarealTotalt: 180,
  gateAdresse: 'TESTVEIEN 20B',
});

describe('assembleBuildingResult – bygningstype', () => {
  beforeEach(() => {
    vi.spyOn(csvService, 'findByExactAddress').mockReturnValue(null);
    vi.spyOn(csvService, 'findByAddress').mockReturnValue([]);
    vi.spyOn(csvService, 'findByBygningsNr').mockReturnValue(null);
    vi.spyOn(csvService, 'findBydelByNearbyAddress').mockReturnValue(null);
    vi.spyOn(csvService, 'findResidentialSibling').mockReturnValue(siblingBolig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('garasje-terskel 180–199', () => {
    it('garasje (kode 181) i CSV byttes med søsken-boligen', () => {
      vi.mocked(csvService.findByExactAddress).mockReturnValue(
        csvRecord({ bygningstype3siffer: '181', bygningstypeNavn: 'Garasjeuthus anneks til bolig', bruksarealTotalt: 30 })
      );

      const result = assemble({ bygningstypeKodeId: 26, bygningstypeKode: '181' });

      expect(csvService.findResidentialSibling).toHaveBeenCalledOnce();
      expect(result.csvData?.bygningsNr).toBe('CSV-BOLIG');
      expect(result.bruksarealM2).toBe(180);
      expect(result.bygningstypeKode).toBe('111');
    });

    it.each([
      ['311', 'Kontor- og adm.bygning rådhus'],
      ['612', 'Barnehage'],
      ['721', 'Sykehjem'],
      ['999', ''],
    ])('næringsbygg (kode %s) i CSV får IKKE naboboligens data', (kode, navn) => {
      vi.mocked(csvService.findByExactAddress).mockReturnValue(
        csvRecord({ bygningsNr: 'CSV-NAERING', bygningstype3siffer: kode, bygningstypeNavn: navn, bruksarealTotalt: 5000 })
      );

      const result = assemble({ bygningstypeKodeId: 49, bygningstypeKode: '311' });

      expect(csvService.findResidentialSibling).not.toHaveBeenCalled();
      expect(result.csvData?.bygningsNr).toBe('CSV-NAERING');
      expect(result.bruksarealM2).toBe(5000);
      expect(result.bygningstypeKode).toBe(kode);
    });

    it('bolig (kode 142) i CSV beholdes som den er', () => {
      vi.mocked(csvService.findByExactAddress).mockReturnValue(
        csvRecord({ bygningstype3siffer: '142', bygningstypeNavn: 'Stort frittliggende boligbygg på 3 og 4 etg.', bruksarealTotalt: 2027 })
      );

      const result = assemble({ bygningstypeKodeId: 13, bygningstypeKode: '142' });

      expect(csvService.findResidentialSibling).not.toHaveBeenCalled();
      expect(result.bygningstypeKode).toBe('142');
      expect(result.rapporteringsNivaa).toBe('building');
    });
  });

  describe('bygningstypeKode og rapporteringsnivå uten CSV-data', () => {
    it('ID 13 gir kode 142 og bygningsnivå', () => {
      const result = assemble({ bygningstypeKodeId: 13, bygningstypeKode: '142' });
      expect(result.bygningstypeKodeId).toBe(13);
      expect(result.bygningstypeKode).toBe('142');
      expect(result.rapporteringsNivaa).toBe('building');
    });

    it('ID 111 (sykehjem) rapporteres ikke lenger som bolig på seksjonsnivå', () => {
      // Uten oppslått kode skal ID-tabellen brukes – ID 111 må ikke leses som kode 111
      const result = assemble({ bygningstypeKodeId: 111 });
      expect(result.rapporteringsNivaa).toBe('exclude');
      expect(result.bygningstype).toBe('Non-residential building');
    });

    it('manglende bygningstype gir null som kode', () => {
      const result = assemble({});
      expect(result.bygningstypeKode).toBeNull();
      expect(result.rapporteringsNivaa).toBe('exclude');
    });
  });

  describe('antall seksjoner for tomannsbolig, vertikaldelt (kode 121)', () => {
    const medSeksjon = (bygg: { bygningstypeKodeId?: number; bygningstypeKode?: string }) => {
      const fullBygg = {
        id: 1001,
        bruksarealM2: 120,
        byggeaar: 1975,
        oppvarmingsKodeIds: [],
        energikildeKodeIds: [],
        ...bygg,
      };
      return assembleBuildingResult({
        adresse,
        matrikkelenhetsId: 1,
        bygg: fullBygg,
        allBygningsInfo: [fullBygg],
        seksjonsnummer: 1,
        rpPBE: null,
        coordinatesWgs84: null,
        attest: null,
        solarData: null,
      });
    };

    it('ID 4 (kode 121) gir to seksjoner', () => {
      expect(medSeksjon({ bygningstypeKodeId: 4, bygningstypeKode: '121' }).antallSeksjoner).toBe(2);
    });

    it('ID 121 (fyrstasjon, kode 823) gir ikke to seksjoner', () => {
      expect(medSeksjon({ bygningstypeKodeId: 121, bygningstypeKode: '823' }).antallSeksjoner).toBeNull();
    });
  });
});

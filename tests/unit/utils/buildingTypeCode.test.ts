// Tester for felles oppslag av 3-sifret bygningstypekode og klassifiseringen
// som bygger på den. Bakgrunn: Matrikkelens bygningstypeKodeId er en intern
// ID, ikke den 3-sifrede koden (ID 13 = kode 142, ID 111 = kode 721).

import { describe, it, expect } from 'vitest';
import {
  BLOCK_CODE_GROUPS,
  BUILDING_TYPE_ID_TO_CODE,
  SMALL_HOUSE_CODE_GROUPS,
  buildingTypeCodeFromId,
  isGarageOrOutbuildingCode,
  isKnownNonResidential,
  isResidentialCode,
  parseBuildingTypeCode,
  resolveBuildingTypeCode,
  resolveBuildingTypeCodeString,
} from '../../../src/utils/buildingTypeCode.ts';
import {
  determineBuildingTypeStrategy,
  getBuildingKind,
  getUnsupportedBuildingMessage,
  shouldProcessBuildingType,
  shouldReportBuildingLevel,
  shouldReportSectionLevel,
} from '../../../src/utils/buildingTypeUtils.ts';
import { determineBuildingType } from '../../../src/utils/tekEnergyCalculations.ts';

describe('BUILDING_TYPE_ID_TO_CODE (verifisert mot Matrikkelen 2026-11-10)', () => {
  it('dekker ID 1–127 uten hull', () => {
    const ids = Object.keys(BUILDING_TYPE_ID_TO_CODE).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 127 }, (_, i) => i + 1));
  });

  it('har unike, stigende 3-sifrede koder', () => {
    const codes = Array.from({ length: 127 }, (_, i) => BUILDING_TYPE_ID_TO_CODE[i + 1]);
    expect(new Set(codes).size).toBe(127);
    for (let i = 1; i < codes.length; i++) {
      expect(codes[i]).toBeGreaterThan(codes[i - 1]);
    }
    expect(codes.every((c) => c >= 111 && c <= 999)).toBe(true);
  });

  it.each([
    [1, 111], // enebolig
    [4, 121], // tomannsbolig, vertikaldelt
    [5, 122], // tomannsbolig, horisontaldelt
    [8, 131], // rekkehus
    [13, 142], // stor boligblokk
    [17, 146], // store sammenbygde boligbygg, 5 etg. eller mer
    [26, 181], // garasje/uthus
    [49, 311], // kontor
    [81, 612], // barnehage
    [110, 719], // sykehus
    [111, 721], // sykehjem
    [120, 822], // brannstasjon
    [127, 999], // ukjent
  ])('ID %i → kode %i', (id, code) => {
    expect(buildingTypeCodeFromId(id)).toBe(code);
  });

  it('gir undefined for ID 0, ukjente ID-er og manglende verdi', () => {
    expect(buildingTypeCodeFromId(0)).toBeUndefined();
    expect(buildingTypeCodeFromId(128)).toBeUndefined();
    // En 3-sifret kode er IKKE en gyldig ID og skal ikke slippe gjennom
    expect(buildingTypeCodeFromId(142)).toBeUndefined();
    expect(buildingTypeCodeFromId(null)).toBeUndefined();
    expect(buildingTypeCodeFromId(undefined)).toBeUndefined();
  });
});

describe('parseBuildingTypeCode', () => {
  it('godtar 3-sifrede koder som streng og tall', () => {
    expect(parseBuildingTypeCode('142')).toBe(142);
    expect(parseBuildingTypeCode(' 311 ')).toBe(311);
    expect(parseBuildingTypeCode(721)).toBe(721);
  });

  it('avviser tomme verdier, interne ID-er og annet som ikke er 3 siffer', () => {
    expect(parseBuildingTypeCode('')).toBeUndefined();
    expect(parseBuildingTypeCode(' ')).toBeUndefined();
    expect(parseBuildingTypeCode(null)).toBeUndefined();
    expect(parseBuildingTypeCode(undefined)).toBeUndefined();
    expect(parseBuildingTypeCode('13')).toBeUndefined();
    expect(parseBuildingTypeCode(13)).toBeUndefined();
    expect(parseBuildingTypeCode('14x')).toBeUndefined();
    expect(parseBuildingTypeCode('1420')).toBeUndefined();
    expect(parseBuildingTypeCode('099')).toBeUndefined();
  });
});

describe('resolveBuildingTypeCode', () => {
  it('bruker oppslått bygningstypeKode først', () => {
    expect(
      resolveBuildingTypeCode({
        bygningstypeKode: '142',
        csvData: { bygningstype3siffer: '111' },
        bygningstypeKodeId: 49,
      })
    ).toBe(142);
  });

  it('faller tilbake til csvData.bygningstype3siffer når koden mangler', () => {
    expect(
      resolveBuildingTypeCode({
        bygningstypeKode: null,
        csvData: { bygningstype3siffer: '142' },
        bygningstypeKodeId: 49,
      })
    ).toBe(142);
  });

  it('faller til slutt tilbake til den verifiserte ID-tabellen', () => {
    expect(resolveBuildingTypeCode({ bygningstypeKode: null, bygningstypeKodeId: 13 })).toBe(142);
    expect(
      resolveBuildingTypeCode({ csvData: { bygningstype3siffer: '' }, bygningstypeKodeId: 111 })
    ).toBe(721);
  });

  it('gir undefined når ingen kilde har gyldig kode', () => {
    expect(resolveBuildingTypeCode(undefined)).toBeUndefined();
    expect(resolveBuildingTypeCode(null)).toBeUndefined();
    expect(resolveBuildingTypeCode({})).toBeUndefined();
    expect(resolveBuildingTypeCode({ bygningstypeKodeId: 500 })).toBeUndefined();
  });

  it('resolveBuildingTypeCodeString gir koden som streng', () => {
    expect(resolveBuildingTypeCodeString({ bygningstypeKodeId: 13 })).toBe('142');
    expect(resolveBuildingTypeCodeString({})).toBeUndefined();
  });
});

describe('kodeområder', () => {
  it('bolig er 110–179', () => {
    expect(isResidentialCode(109)).toBe(false);
    expect(isResidentialCode(110)).toBe(true);
    expect(isResidentialCode(142)).toBe(true);
    expect(isResidentialCode(179)).toBe(true);
    expect(isResidentialCode(180)).toBe(false);
    expect(isResidentialCode(721)).toBe(false);
    expect(isResidentialCode(undefined)).toBe(false);
  });

  it('garasje/uthus er 180–199 – næringsbygg (200+) er ikke garasje', () => {
    expect(isGarageOrOutbuildingCode(179)).toBe(false);
    expect(isGarageOrOutbuildingCode(180)).toBe(true);
    expect(isGarageOrOutbuildingCode(181)).toBe(true);
    expect(isGarageOrOutbuildingCode(199)).toBe(true);
    expect(isGarageOrOutbuildingCode(200)).toBe(false);
    expect(isGarageOrOutbuildingCode(311)).toBe(false);
    expect(isGarageOrOutbuildingCode(721)).toBe(false);
    expect(isGarageOrOutbuildingCode(999)).toBe(false);
    expect(isGarageOrOutbuildingCode(undefined)).toBe(false);
  });

  it('isKnownNonResidential er bare sann når koden er kjent og utenfor 110–179', () => {
    expect(isKnownNonResidential({ bygningstypeKodeId: 49 })).toBe(true); // kontor
    expect(isKnownNonResidential({ bygningstypeKodeId: 111 })).toBe(true); // sykehjem
    expect(isKnownNonResidential({ bygningstypeKodeId: 127 })).toBe(true); // 999
    expect(isKnownNonResidential({ bygningstypeKode: '181' })).toBe(true); // garasje
    expect(isKnownNonResidential({ bygningstypeKodeId: 13 })).toBe(false);
    expect(isKnownNonResidential({ bygningstypeKode: '111' })).toBe(false);
    expect(isKnownNonResidential({})).toBe(false);
    expect(isKnownNonResidential(null)).toBe(false);
  });
});

describe('determineBuildingTypeStrategy med interne ID-er', () => {
  it('ID 13 (kode 142, stor boligblokk) rapporteres på bygningsnivå', () => {
    const strategy = determineBuildingTypeStrategy({ bygningstypeKodeId: 13 });
    expect(strategy).toEqual({
      isResidential: true,
      reportingLevel: 'building',
      description: 'Store boligbygg',
    });
  });

  it('ID 49 (kode 311, kontor) er ikke bolig', () => {
    const strategy = determineBuildingTypeStrategy({ bygningstypeKodeId: 49 });
    expect(strategy.isResidential).toBe(false);
    expect(strategy.reportingLevel).toBe('exclude');
  });

  it.each([
    [110, 'sykehus (kode 719)'],
    [111, 'sykehjem (kode 721)'],
    [120, 'brannstasjon (kode 822)'],
  ])('ID %i – %s – behandles ikke som bolig (tidligere lest som kode 11x/12x)', (id) => {
    const source = { bygningstypeKodeId: id };
    const strategy = determineBuildingTypeStrategy(source);
    expect(strategy.isResidential).toBe(false);
    expect(strategy.reportingLevel).toBe('exclude');
    expect(shouldProcessBuildingType(source)).toBe(false);
    expect(shouldReportSectionLevel(source)).toBe(false);
  });

  it('ID 127 (kode 999, ukjent) blir ikke «tomannsbolig»', () => {
    const strategy = determineBuildingTypeStrategy({ bygningstypeKodeId: 127 });
    expect(strategy.isResidential).toBe(false);
    expect(strategy.reportingLevel).toBe('exclude');
    expect(strategy.description).not.toBe('Tomannsbolig');
  });

  it.each([
    [1, 'section'], // 111 enebolig
    [2, 'section'], // 112 enebolig m/hybel
    [4, 'section'], // 121 tomannsbolig
    [5, 'section'], // 122 tomannsbolig
    [8, 'building'], // 131 rekkehus
    [9, 'building'], // 133 kjede-/atriumhus
    [10, 'building'], // 135 terrassehus (tidligere feilmappet til 141)
    [11, 'building'], // 136 andre småhus (tidligere feilmappet til 142)
    [12, 'building'], // 141
    [14, 'building'], // 143
    [17, 'building'], // 146 (manglet i den gamle tabellen → ble ekskludert)
  ] as const)('bolig-ID %i gir rapporteringsnivå %s', (id, level) => {
    const source = { bygningstypeKodeId: id };
    expect(determineBuildingTypeStrategy(source).reportingLevel).toBe(level);
    expect(shouldProcessBuildingType(source)).toBe(true);
  });

  it('garasje (ID 26, kode 181) er boligbygning, men ekskluderes', () => {
    const strategy = determineBuildingTypeStrategy({ bygningstypeKodeId: 26 });
    expect(strategy.isResidential).toBe(true);
    expect(strategy.reportingLevel).toBe('exclude');
    expect(shouldProcessBuildingType({ bygningstypeKodeId: 26 })).toBe(false);
  });

  it('manglende bygningstype gir «Unknown building type»', () => {
    expect(determineBuildingTypeStrategy(undefined).description).toBe('Unknown building type');
    expect(determineBuildingTypeStrategy({}).reportingLevel).toBe('exclude');
  });
});

describe('determineBuildingTypeStrategy med 3-sifrede koder', () => {
  it.each([
    ['111', true, 'section'],
    ['121', true, 'section'],
    ['131', true, 'building'],
    ['142', true, 'building'],
    ['152', true, 'exclude'],
    ['161', true, 'section'],
    ['181', true, 'exclude'],
    ['311', false, 'exclude'],
    ['612', false, 'exclude'],
    ['719', false, 'exclude'],
    ['721', false, 'exclude'],
    ['999', false, 'exclude'],
  ] as const)('kode %s → isResidential=%s, nivå=%s', (kode, isResidential, level) => {
    const strategy = determineBuildingTypeStrategy({ bygningstypeKode: kode });
    expect(strategy.isResidential).toBe(isResidential);
    expect(strategy.reportingLevel).toBe(level);
  });

  it('kode fra CSV brukes når oppslått kode mangler', () => {
    const source = { csvData: { bygningstype3siffer: '142' } };
    expect(shouldReportBuildingLevel(source)).toBe(true);
  });
});

describe('determineBuildingType (småhus/blokk) via felles kodeoppslag', () => {
  it('ID 13 gir blokk når koden slås opp – ikke småhus som da ID-en ble lest som «13»', () => {
    expect(determineBuildingType(resolveBuildingTypeCodeString({ bygningstypeKodeId: 13 }))).toBe('blokk');
    // Dokumenterer den gamle feilen: ID-en som streng tolkes som kode 13x
    expect(determineBuildingType(String(13))).toBe('småhus');
  });

  it.each([
    ['111', 'småhus'],
    ['122', 'småhus'],
    ['131', 'småhus'],
    ['136', 'småhus'],
    ['141', 'blokk'],
    ['142', 'blokk'],
    ['146', 'blokk'],
    ['151', 'blokk'], // bo- og servicesenter
    ['152', 'blokk'], // studentboliger
    ['159', 'blokk'],
  ] as const)('kode %s → %s', (kode, forventet) => {
    expect(determineBuildingType(kode)).toBe(forventet);
  });

  it.each(['161', '162', '163', '171', '172'])(
    'fritidsbolig og koie/seterhus (kode %s) regnes som småhus, ikke blokk',
    (kode) => {
      expect(determineBuildingType(kode)).toBe('småhus');
    }
  );

  it('fritidsbygg via intern ID 21 (kode 161) er småhus', () => {
    expect(determineBuildingType(resolveBuildingTypeCodeString({ bygningstypeKodeId: 21 }))).toBe('småhus');
  });

  it('hver boligkode (110–179) i tabellen hører til nøyaktig én gruppe', () => {
    const boligkoder = Object.values(BUILDING_TYPE_ID_TO_CODE).filter(isResidentialCode);
    expect(boligkoder.length).toBe(25); // ID 1–25
    for (const kode of boligkoder) {
      const gruppe = String(kode).substring(0, 2);
      const treff = [SMALL_HOUSE_CODE_GROUPS, BLOCK_CODE_GROUPS].filter((g) => g.includes(gruppe));
      expect(treff, `kode ${kode}`).toHaveLength(1);
    }
  });
});

describe('getBuildingKind', () => {
  it('bruker ID-tabellen når navn og kode mangler', () => {
    expect(getBuildingKind({ bygningstypeKodeId: 1 })).toBe('enebolig');
    expect(getBuildingKind({ bygningstypeKodeId: 9 })).toBe('enebolig'); // 133 kjede-/atriumhus
    expect(getBuildingKind({ bygningstypeKodeId: 10 })).toBe('enebolig'); // 135 terrassehus
    expect(getBuildingKind({ bygningstypeKodeId: 13 })).toBe('blokk'); // 142
    expect(getBuildingKind({ bygningstypeKodeId: 17 })).toBe('blokk'); // 146
    expect(getBuildingKind({ bygningstypeKodeId: 19 })).toBe('blokk'); // 152 studentboliger
  });

  it('fritidsbolig og koie/seterhus (16x–17x) vises som enebolig', () => {
    expect(getBuildingKind({ bygningstypeKodeId: 21 })).toBe('enebolig'); // 161
    expect(getBuildingKind({ bygningstypeKode: '172' })).toBe('enebolig');
    // CSV-navnet gir ikke treff – koden avgjør
    expect(
      getBuildingKind({
        csvData: { bygningstypeNavn: 'Fritidsbygg(hyttersommerh. ol', bygningstype3siffer: '161' },
        bygningstypeKode: '161',
      })
    ).toBe('enebolig');
  });

  it('typenavn uten treff faller tilbake til koden (terrassehus, kjede-/atriumhus)', () => {
    // Desktop-visningen og landingsovergangen må være enige om disse,
    // ellers blir overgangsanimasjonen hengende.
    expect(
      getBuildingKind({ csvData: { bygningstypeNavn: 'Terrassehus' }, bygningstypeKode: '135' })
    ).toBe('enebolig');
    expect(
      getBuildingKind({ csvData: { bygningstypeNavn: 'Kjede/atriumhus' }, bygningstypeKode: '133' })
    ).toBe('enebolig');
  });

  it('garasje og ukjent type gir blokk som standard', () => {
    expect(getBuildingKind({ bygningstypeKode: '181' })).toBe('blokk');
    expect(getBuildingKind({})).toBe('blokk');
  });

  it('CSV-navn har fortsatt forrang', () => {
    expect(
      getBuildingKind({ csvData: { bygningstypeNavn: 'Rekkehus' }, bygningstypeKode: '142' })
    ).toBe('enebolig');
  });
});

describe('getUnsupportedBuildingMessage', () => {
  it('gir melding for næringsbygg (Rådhusplassen 1: kode 311)', () => {
    const message = getUnsupportedBuildingMessage({
      bygningstypeKode: '311',
      bygningstype: 'Kontor- og adm.bygning rådhus',
    });
    expect(message).toBe(
      'Energinøkkelen støtter foreløpig bare boliger. Denne adressen er registrert som «Kontor- og adm.bygning rådhus».'
    );
  });

  it('gir melding for sykehjem via intern ID 111', () => {
    const message = getUnsupportedBuildingMessage({ bygningstypeKodeId: 111, bygningstype: 'Sykehjem' });
    expect(message).toContain('støtter foreløpig bare boliger');
    expect(message).toContain('«Sykehjem»');
  });

  it('gir generell melding når typenavn mangler (kode 999)', () => {
    expect(getUnsupportedBuildingMessage({ bygningstypeKodeId: 127, bygningstype: '' })).toBe(
      'Energinøkkelen støtter foreløpig bare boliger. Denne adressen er ikke registrert som bolig.'
    );
  });

  it('gir ingen melding for boliger', () => {
    expect(getUnsupportedBuildingMessage({ bygningstypeKodeId: 13 })).toBeNull();
    expect(getUnsupportedBuildingMessage({ bygningstypeKode: '111', bygningstype: 'Enebolig' })).toBeNull();
    expect(getUnsupportedBuildingMessage({ csvData: { bygningstype3siffer: '161' } })).toBeNull();
  });

  it('gir ingen melding når bygningstypen er ukjent – oppslaget behandles som før', () => {
    expect(getUnsupportedBuildingMessage({})).toBeNull();
    expect(getUnsupportedBuildingMessage(null)).toBeNull();
    expect(getUnsupportedBuildingMessage({ bygningstype: 'Unknown building type' })).toBeNull();
  });

  it('bruker CSV-koden i svaret: garasje i Matrikkel + søsken-bolig i CSV vises som bolig', () => {
    // API-svaret setter bygningstypeKode fra CSV-posten når den finnes
    expect(
      getUnsupportedBuildingMessage({
        bygningstypeKode: '111',
        bygningstypeKodeId: 26,
        csvData: { bygningstype3siffer: '111' },
        bygningstype: 'Enebolig',
      })
    ).toBeNull();
  });
});

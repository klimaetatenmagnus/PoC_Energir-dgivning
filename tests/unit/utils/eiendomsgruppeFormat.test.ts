import { describe, it, expect } from 'vitest';
import {
  gruppenavn,
  byggeaarRangeTekst,
  trekkUtGatenavn,
} from '../../../src/utils/eiendomsgruppeFormat.ts';

describe('gruppenavn', () => {
  it('borettslag med registrert navn — strip+re-append "borettslag"', () => {
    expect(gruppenavn('borettslag', 'Oppsal Borettslag', 'Haakon Tveters vei 44'))
      .toBe('Oppsal borettslag');
  });

  it('borettslag uten navn → generisk fallback', () => {
    expect(gruppenavn('borettslag', undefined, 'X')).toBe('borettslaget');
  });

  it('sameie uten navn → "Sameiet i [gatenavn]"', () => {
    expect(gruppenavn('sameie', undefined, 'Hesteskoen 4A, 0487 Oslo'))
      .toBe('Sameiet i Hesteskoen');
  });

  it('sameie uten navn og adresse → generisk', () => {
    expect(gruppenavn('sameie', undefined, undefined)).toBe('sameiet');
  });

  it('sameie med registrert navn bruker det direkte', () => {
    expect(gruppenavn('sameie', 'Grønland Sameie', undefined)).toBe('Grønland Sameie');
  });
});

describe('byggeaarRangeTekst', () => {
  it('returnerer enkeltår når alle er like', () => {
    expect(byggeaarRangeTekst([1965, 1965, 1965])).toBe('1965');
  });

  it('returnerer range når ulike', () => {
    expect(byggeaarRangeTekst([1953, 1965, 1972, 2011])).toBe('1953 til 2011');
  });

  it('ignorerer ukjente år og bruker nyeste kjente som øvre grense', () => {
    expect(byggeaarRangeTekst([1953, null, 1965])).toBe('1953 til 1965');
  });

  it('returnerer null når alle er ukjent', () => {
    expect(byggeaarRangeTekst([null, null, null])).toBe(null);
  });

  it('håndterer enkeltbygg', () => {
    expect(byggeaarRangeTekst([1980])).toBe('1980');
  });

  it('ignorerer 0 og NaN som ukjent', () => {
    expect(byggeaarRangeTekst([0, 1960, NaN, 1970])).toBe('1960 til 1970');
  });
});

describe('trekkUtGatenavn', () => {
  it('trekker ut gatenavn fra adresse med husnummer', () => {
    expect(trekkUtGatenavn('Hesteskoen 4A, 0487 Oslo')).toBe('Hesteskoen');
  });

  it('trekker ut gatenavn fra adresse med flere ord', () => {
    expect(trekkUtGatenavn('Haakon Tveters vei 44')).toBe('Haakon Tveters vei');
  });

  it('returnerer null for tom/null', () => {
    expect(trekkUtGatenavn(null)).toBe(null);
    expect(trekkUtGatenavn(undefined)).toBe(null);
    expect(trekkUtGatenavn('')).toBe(null);
  });
});

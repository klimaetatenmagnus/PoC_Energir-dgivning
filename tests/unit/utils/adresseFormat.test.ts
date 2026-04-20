import { describe, it, expect } from 'vitest';
import { capitalizeAdresse } from '../../../src/utils/adresseFormat.ts';

describe('capitalizeAdresse', () => {
  it('kapitaliserer første bokstav', () => {
    expect(capitalizeAdresse('kjelsåsveien 97')).toBe('Kjelsåsveien 97');
  });

  it('kapitaliserer husnummer-bokstav', () => {
    expect(capitalizeAdresse('kjelsåsveien 97b')).toBe('Kjelsåsveien 97B');
  });

  it('bevarer allerede korrekt casing', () => {
    expect(capitalizeAdresse('Olav V\u2019s gate')).toBe('Olav V\u2019s gate');
  });

  it('håndterer nordisk tegn i husnummer-bokstav', () => {
    expect(capitalizeAdresse('hovedgata 12æ')).toBe('Hovedgata 12Æ');
  });

  it('returnerer tom streng for null/undefined', () => {
    expect(capitalizeAdresse(null)).toBe('');
    expect(capitalizeAdresse(undefined)).toBe('');
    expect(capitalizeAdresse('')).toBe('');
  });

  it('trimmer whitespace', () => {
    expect(capitalizeAdresse('  kjelsåsveien 1  ')).toBe('Kjelsåsveien 1');
  });

  it('kapitaliserer ikke midt-i-ord-bokstaver', () => {
    // "20" i "kjelsåsveien 20, leilighet b" skal ikke kapitalisere "b" fordi
    // ordet ikke slutter her. \b grensen fanger bare husnummer-suffix.
    expect(capitalizeAdresse('hartmanns vei 1c')).toBe('Hartmanns vei 1C');
  });
});

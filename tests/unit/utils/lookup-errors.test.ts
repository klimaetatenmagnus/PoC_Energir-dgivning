/**
 * Test: «ikke funnet» i adresseoppslaget skal gi 404 med tydelig melding,
 * ikke 500 «midlertidig utilgjengelig».
 *
 * Bug: Når verken oppslaget eller CSV-reserven fant adressen, svarte
 * /api/address-lookup alltid med HTTP 500 og teksten «Adressen ble ikke
 * funnet. Tjenesten for adresseoppslag er midlertidig utilgjengelig.» I
 * prod-loggene (28.10–11.11.2026) gjaldt 81 av 95 slike svar adresser som
 * bare finnes utenfor Oslo. Brukeren fikk altså beskjed om en driftsfeil og
 * prøvde igjen, i stedet for å få vite at tjenesten bare dekker Oslo.
 */
import { describe, it, expect } from 'vitest';
import {
  ADDRESS_NOT_FOUND_MESSAGE,
  BUILDING_NOT_FOUND_MESSAGE,
  LOOKUP_UNAVAILABLE_MESSAGE,
  LookupNotFoundError,
  describeLookupFailure,
  isLookupNotFoundError,
} from '../../../services/building-info-service/lookupErrors.ts';

describe('LookupNotFoundError', () => {
  it('er en Error med navn, årsak og melding', () => {
    const error = new LookupNotFoundError('address', 'Ingen adresse funnet');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LookupNotFoundError');
    expect(error.reason).toBe('address');
    expect(error.message).toBe('Ingen adresse funnet');
  });
});

describe('isLookupNotFoundError', () => {
  it('gjenkjenner begge årsaker', () => {
    expect(isLookupNotFoundError(new LookupNotFoundError('address', 'x'))).toBe(true);
    expect(isLookupNotFoundError(new LookupNotFoundError('building', 'x'))).toBe(true);
  });

  it('gjenkjenner feilen selv om klassen kommer fra en annen modulinstans', () => {
    // Samme form, men ikke instanceof LookupNotFoundError
    const foreign = Object.assign(new Error('Ingen adresse funnet'), {
      name: 'LookupNotFoundError',
      reason: 'address',
    });

    expect(foreign).not.toBeInstanceOf(LookupNotFoundError);
    expect(isLookupNotFoundError(foreign)).toBe(true);
  });

  it('avviser vanlige feil, også når meldingen ligner', () => {
    expect(isLookupNotFoundError(new Error('Ingen adresse funnet'))).toBe(false);
    expect(isLookupNotFoundError(new Error('Adressen ikke funnet'))).toBe(false);
    expect(isLookupNotFoundError(new TypeError('fetch failed'))).toBe(false);
  });

  it('avviser ukjent årsak og verdier som ikke er Error', () => {
    const unknownReason = Object.assign(new Error('x'), {
      name: 'LookupNotFoundError',
      reason: 'noe annet',
    });

    expect(isLookupNotFoundError(unknownReason)).toBe(false);
    expect(isLookupNotFoundError({ name: 'LookupNotFoundError', reason: 'address' })).toBe(false);
    expect(isLookupNotFoundError('Ingen adresse funnet')).toBe(false);
    expect(isLookupNotFoundError(null)).toBe(false);
    expect(isLookupNotFoundError(undefined)).toBe(false);
  });
});

describe('describeLookupFailure', () => {
  it('gir 404 og Oslo-forklaring når adressen ikke finnes i Oslo', () => {
    const failure = describeLookupFailure(
      new LookupNotFoundError(
        'address',
        'Ingen adresse funnet i Geonorge etter å ha prøvd alle varianter'
      )
    );

    expect(failure).toEqual({
      status: 404,
      code: 'ADDRESS_NOT_FOUND',
      message: ADDRESS_NOT_FOUND_MESSAGE,
    });
    expect(failure.message).toContain('Oslo kommune');
    expect(failure.message).not.toMatch(/utilgjengelig/i);
  });

  it('gir 404 når adressen finnes, men ikke har noen egnet bygning', () => {
    const failure = describeLookupFailure(
      new LookupNotFoundError('building', 'Ingen bygninger funnet på denne adressen')
    );

    expect(failure).toEqual({
      status: 404,
      code: 'BUILDING_NOT_FOUND',
      message: BUILDING_NOT_FOUND_MESSAGE,
    });
    expect(failure.message).not.toMatch(/utilgjengelig/i);
  });

  it('gir 500 «midlertidig utilgjengelig» for driftsfeil', () => {
    const driftsfeil: unknown[] = [
      new Error('Geonorge adressesøk feilet for 3 søkevariant(er) – kan ikke avgjøre om adressen finnes'),
      new Error('timeout of 30000ms exceeded'),
      new Error('Enova 500'),
      new TypeError("Cannot read properties of undefined (reading 'id')"),
      'ukjent',
      undefined,
    ];

    for (const error of driftsfeil) {
      expect(describeLookupFailure(error)).toEqual({
        status: 500,
        code: 'LOOKUP_UNAVAILABLE',
        message: LOOKUP_UNAVAILABLE_MESSAGE,
      });
    }
  });

  it('påstår ikke at adressen mangler når vi ikke vet det', () => {
    // Den gamle 500-teksten begynte med «Adressen ble ikke funnet.»
    expect(LOOKUP_UNAVAILABLE_MESSAGE).not.toMatch(/ikke funnet/i);
    expect(LOOKUP_UNAVAILABLE_MESSAGE).toMatch(/midlertidig utilgjengelig/i);
  });

  it('klassifiserer ikke en vanlig Error som «ikke funnet» ut fra meldingsteksten', () => {
    // Før ble metrikken satt med regex på meldingen; statuskoden skal ikke
    // avhenge av ordlyden.
    expect(describeLookupFailure(new Error('Ingen adresse funnet')).status).toBe(500);
  });
});

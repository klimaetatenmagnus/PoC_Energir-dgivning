/**
 * Feiltyper og HTTP-svar for adresseoppslaget.
 *
 * Skiller «vi fikk svar, men det finnes ingen adresse/bygning her» fra reelle
 * driftsfeil (Geonorge eller Matrikkelen nede, tidsavbrudd). Før fikk begge
 * HTTP 500 med teksten «… midlertidig utilgjengelig». I prod-loggene gjaldt
 * 81 av 95 slike svar (28.10–11.11.2026) adresser som bare finnes utenfor
 * Oslo – brukeren ble altså bedt om å prøve igjen senere for et søk som aldri
 * kan gi treff.
 */

export type LookupNotFoundReason = 'address' | 'building';

/**
 * Oppslaget ga et entydig negativt svar: adressen finnes ikke i Oslo, eller
 * adressen finnes, men Matrikkelen har ingen egnet bygning der.
 */
export class LookupNotFoundError extends Error {
  readonly reason: LookupNotFoundReason;

  constructor(reason: LookupNotFoundReason, message: string) {
    super(message);
    this.name = 'LookupNotFoundError';
    this.reason = reason;
  }
}

/**
 * Sjekker på navn og felt i stedet for `instanceof`, slik at det også virker
 * hvis modulen skulle bli lastet to ganger (.ts- og .js-spesifikator).
 */
export function isLookupNotFoundError(
  error: unknown
): error is LookupNotFoundError {
  if (!(error instanceof Error) || error.name !== 'LookupNotFoundError') {
    return false;
  }
  const reason = (error as { reason?: unknown }).reason;
  return reason === 'address' || reason === 'building';
}

export type LookupFailureCode =
  | 'ADDRESS_NOT_FOUND'
  | 'BUILDING_NOT_FOUND'
  | 'LOOKUP_UNAVAILABLE';

export interface LookupFailure {
  status: 404 | 500;
  code: LookupFailureCode;
  /** Tekst som vises direkte til brukeren i søkefeltets feilmelding. */
  message: string;
}

export const ADDRESS_NOT_FOUND_MESSAGE =
  'Vi fant ikke adressen i Oslo. Energinøkkelen dekker foreløpig bare adresser i Oslo kommune. ' +
  'Sjekk skrivemåten, eller velg en adresse fra forslagslisten.';

export const BUILDING_NOT_FOUND_MESSAGE =
  'Vi fant ingen bygning på denne adressen. ' +
  'Sjekk husnummer og bokstav, eller velg en adresse fra forslagslisten.';

export const LOOKUP_UNAVAILABLE_MESSAGE =
  'Adresseoppslaget er midlertidig utilgjengelig. Prøv igjen om litt.';

/**
 * Oversetter feilen fra oppslaget til statuskode og brukertekst. Brukes når
 * heller ikke CSV-reserven har adressen.
 *
 * - Ikke funnet → 404 (klientens søk, ikke en driftsfeil)
 * - Alt annet → 500 (vi vet ikke om adressen finnes)
 */
export function describeLookupFailure(error: unknown): LookupFailure {
  if (isLookupNotFoundError(error)) {
    return error.reason === 'address'
      ? {
          status: 404,
          code: 'ADDRESS_NOT_FOUND',
          message: ADDRESS_NOT_FOUND_MESSAGE,
        }
      : {
          status: 404,
          code: 'BUILDING_NOT_FOUND',
          message: BUILDING_NOT_FOUND_MESSAGE,
        };
  }

  return {
    status: 500,
    code: 'LOOKUP_UNAVAILABLE',
    message: LOOKUP_UNAVAILABLE_MESSAGE,
  };
}

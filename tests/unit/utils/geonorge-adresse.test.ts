/**
 * Test: Geonorge-søket i adresseoppslaget skal være avgrenset til Oslo.
 *
 * Bug: Søket manglet kommunefilter og brukte første treff ukritisk. For
 * adresser sendt uten postnummer/poststed («Ivar Aasens vei 23A») ble første
 * treff ofte samme gateadresse i en annen kommune (Lørenskog 107/2852 i stedet
 * for Oslo 39/56). Matrikkelen ga areal 0 for byggene der, oppslaget kastet
 * «Ingen bygninger funnet på denne adressen» og svaret falt tilbake til CSV.
 */
import { describe, it, expect } from 'vitest';
import {
  OSLO_KOMMUNENUMMER,
  buildAddressSearchVariants,
  buildGeonorgeSearchUrl,
  findOsloAdresse,
  selectOsloAdresse,
  type GeoAdresseEntry,
  type GeonorgeSearchResponse,
} from '../../../services/building-info-service/geonorgeAdresse.ts';
import { isLookupNotFoundError } from '../../../services/building-info-service/lookupErrors.ts';

const entry = (
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number
): GeoAdresseEntry => ({
  kommunenummer,
  gardsnummer,
  bruksnummer,
  adressekode: 14200,
  nummer: '23',
  bokstav: 'A',
  adressetekst: 'Ivar Aasens vei 23A',
});

describe('buildGeonorgeSearchUrl', () => {
  it('avgrenser søket til Oslo kommune', () => {
    const url = new URL(buildGeonorgeSearchUrl('Ivar Aasens vei 23A'));

    expect(url.origin + url.pathname).toBe(
      'https://ws.geonorge.no/adresser/v1/sok'
    );
    expect(url.searchParams.get('kommunenummer')).toBe(OSLO_KOMMUNENUMMER);
    expect(url.searchParams.get('kommunenummer')).toBe('0301');
    expect(url.searchParams.get('sok')).toBe('Ivar Aasens vei 23A');
    expect(url.searchParams.get('fuzzy')).toBe('true');
  });

  it('koder mellomrom som %20 og beholder norske tegn i søketeksten', () => {
    const url = buildGeonorgeSearchUrl('Bjørndalsjordet 48, 1270 OSLO');

    expect(url).not.toContain('+');
    expect(url).toContain('sok=Bj%C3%B8rndalsjordet%2048%2C%201270%20OSLO');
    expect(new URL(url).searchParams.get('sok')).toBe(
      'Bjørndalsjordet 48, 1270 OSLO'
    );
  });
});

describe('selectOsloAdresse', () => {
  it('velger Oslo-treffet selv om en annen kommune står først', () => {
    // Faktisk rekkefølge fra Geonorge for «Ivar Aasens vei 23A» uten filter
    const adresser = [entry('3222', 107, 2852), entry('0301', 39, 56)];

    const valgt = selectOsloAdresse(adresser);

    expect(valgt?.kommunenummer).toBe('0301');
    expect(valgt?.gardsnummer).toBe(39);
    expect(valgt?.bruksnummer).toBe(56);
  });

  it('velger første treff når alle er i Oslo', () => {
    const adresser = [entry('0301', 39, 56), entry('0301', 39, 57)];

    expect(selectOsloAdresse(adresser)?.bruksnummer).toBe(56);
  });

  it('gir undefined når ingen treff er i Oslo', () => {
    expect(
      selectOsloAdresse([entry('3222', 107, 2852), entry('1103', 28, 647)])
    ).toBeUndefined();
  });

  it('gir undefined for tom eller manglende treffliste', () => {
    expect(selectOsloAdresse([])).toBeUndefined();
    expect(selectOsloAdresse(undefined)).toBeUndefined();
  });
});

describe('buildAddressSearchVariants', () => {
  it('starter med adressen slik den ble skrevet', () => {
    expect(buildAddressSearchVariants('Ivar Aasens vei 23A')[0]).toBe(
      'Ivar Aasens vei 23A'
    );
  });

  it('prøver med og uten mellomrom mellom husnummer og bokstav', () => {
    const variants = buildAddressSearchVariants('Ivar Aasens vei 23A');

    expect(variants).toContain('Ivar Aasens vei 23A');
    expect(variants).toContain('Ivar Aasens vei 23 A');
  });

  it('fjerner komma og punktum i egne varianter', () => {
    const variants = buildAddressSearchVariants('Chr. Michelsens gate 4, 0568 OSLO');

    expect(variants).toContain('Chr. Michelsens gate 4 0568 OSLO');
    expect(variants).toContain('Chr Michelsens gate 4 0568 OSLO');
  });

  it('gir ingen duplikater', () => {
    const variants = buildAddressSearchVariants('Eksempelveien 12');

    expect(variants).toEqual(['Eksempelveien 12']);
  });
});

describe('findOsloAdresse', () => {
  const jsonResponse = (adresser: GeoAdresseEntry[]): GeonorgeSearchResponse => ({
    ok: true,
    status: 200,
    json: async () => ({ adresser }),
  });

  const statusResponse = (status: number): GeonorgeSearchResponse => ({
    ok: false,
    status,
    json: async () => ({}),
  });

  const sokFra = (url: string) => new URL(url).searchParams.get('sok');

  it('returnerer Oslo-treffet fra første variant', async () => {
    const urls: string[] = [];

    const treff = await findOsloAdresse('Ivar Aasens vei 23A', async (url) => {
      urls.push(url);
      return jsonResponse([entry('0301', 39, 56)]);
    });

    expect(treff.gardsnummer).toBe(39);
    expect(treff.bruksnummer).toBe(56);
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0]).searchParams.get('kommunenummer')).toBe('0301');
  });

  it('går videre til neste variant når den første ikke gir treff', async () => {
    const sok: Array<string | null> = [];

    const treff = await findOsloAdresse('Ivar Aasens vei 23A', async (url) => {
      sok.push(sokFra(url));
      return sokFra(url) === 'Ivar Aasens vei 23 A'
        ? jsonResponse([entry('0301', 39, 56)])
        : jsonResponse([]);
    });

    expect(treff.bruksnummer).toBe(56);
    expect(sok).toEqual(['Ivar Aasens vei 23A', 'Ivar Aasens vei 23 A']);
  });

  it('kaster LookupNotFoundError når Geonorge svarer uten treff på alle varianter', async () => {
    let antallSok = 0;

    const error = await findOsloAdresse('Eksempelveien 12, 5003 BERGEN', async () => {
      antallSok += 1;
      return jsonResponse([]);
    }).catch((e: unknown) => e);

    expect(isLookupNotFoundError(error)).toBe(true);
    expect(isLookupNotFoundError(error) && error.reason).toBe('address');
    expect((error as Error).message).toMatch(/Ingen adresse funnet/i);
    expect(antallSok).toBe(
      buildAddressSearchVariants('Eksempelveien 12, 5003 BERGEN').length
    );
    expect(antallSok).toBeGreaterThan(1);
  });

  it('regner treff bare utenfor Oslo som «ikke funnet»', async () => {
    const error = await findOsloAdresse('Eksempelveien 12', async () =>
      jsonResponse([entry('4601', 165, 12), entry('1103', 28, 647)])
    ).catch((e: unknown) => e);

    expect(isLookupNotFoundError(error)).toBe(true);
  });

  // 400: Geonorge avviser søketeksten. 413/414/431: teksten er så lang at
  // mellomtjeneren avviser forespørselen. Ingen av dem er driftsfeil.
  it.each([400, 413, 414, 431])(
    'regner %i (søketeksten ble avvist) som «ingen treff», ikke som driftsfeil',
    async (status) => {
      const error = await findOsloAdresse('Eksempelveien 12', async () =>
        statusResponse(status)
      ).catch((e: unknown) => e);

      expect(isLookupNotFoundError(error)).toBe(true);
      expect(isLookupNotFoundError(error) && error.reason).toBe('address');
    }
  );

  it('kaster vanlig Error når Geonorge ikke svarer (tidsavbrudd)', async () => {
    const error = await findOsloAdresse('Ivar Aasens vei 23A', async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      });
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(isLookupNotFoundError(error)).toBe(false);
    expect((error as Error).message).toMatch(/Geonorge adressesøk feilet/);
    // Meldingen skal ikke kunne forveksles med «ikke funnet»
    expect((error as Error).message).not.toMatch(/ikke funnet|ingen adresse/i);
  });

  // Bare 400 betyr at Geonorge har behandlet søket. 401/403 (sperret),
  // 404/410 (endepunktet flyttet) og 408 sier like lite om adressen som 5xx.
  it.each([401, 403, 404, 408, 410, 429, 500, 503])(
    'kaster vanlig Error når Geonorge svarer %i',
    async (status) => {
      const error = await findOsloAdresse('Ivar Aasens vei 23A', async () =>
        statusResponse(status)
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(isLookupNotFoundError(error)).toBe(false);
      expect((error as Error).message).toMatch(/Geonorge adressesøk feilet/);
    }
  );

  it.each([
    ['et tomt objekt', {}],
    ['adresser: null', { adresser: null }],
    ['en liste i stedet for et objekt', []],
    ['null', null],
    ['en tekststreng', 'Service Unavailable'],
  ])(
    'kaster vanlig Error når 200-svaret er %s i stedet for en treffliste',
    async (_beskrivelse, payload) => {
      // Uten `adresser`-liste har vi ikke fått svar på søket, og kan ikke
      // si at adressen ikke finnes i Oslo.
      const error = await findOsloAdresse('Ivar Aasens vei 23A', async () => ({
        ok: true,
        status: 200,
        json: async () => payload,
      })).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(isLookupNotFoundError(error)).toBe(false);
      expect((error as Error).message).toMatch(/Geonorge adressesøk feilet/);
    }
  );

  it('kaster vanlig Error når svaret ikke er lesbar JSON', async () => {
    const error = await findOsloAdresse('Ivar Aasens vei 23A', async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    })).catch((e: unknown) => e);

    expect(isLookupNotFoundError(error)).toBe(false);
  });

  it('melder driftsfeil når ett søk feilet og resten var uten treff', async () => {
    // Vi vet ikke hva det feilede søket ville gitt – da kan vi ikke si
    // «finnes ikke i Oslo».
    let antallSok = 0;

    const error = await findOsloAdresse('Ivar Aasens vei 23A', async () => {
      antallSok += 1;
      return antallSok === 1 ? statusResponse(503) : jsonResponse([]);
    }).catch((e: unknown) => e);

    expect(antallSok).toBeGreaterThan(1);
    expect(isLookupNotFoundError(error)).toBe(false);
    expect((error as Error).message).toMatch(/1 søkevariant/);
  });

  it('returnerer treff fra senere variant selv om et tidligere søk feilet', async () => {
    let antallSok = 0;

    const treff = await findOsloAdresse('Ivar Aasens vei 23A', async () => {
      antallSok += 1;
      if (antallSok === 1) {
        throw new Error('ECONNRESET');
      }
      return jsonResponse([entry('0301', 39, 56)]);
    });

    expect(treff.bruksnummer).toBe(56);
  });
});

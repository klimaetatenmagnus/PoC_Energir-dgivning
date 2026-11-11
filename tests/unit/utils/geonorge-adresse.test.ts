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
  buildGeonorgeSearchUrl,
  selectOsloAdresse,
  type GeoAdresseEntry,
} from '../../../services/building-info-service/geonorgeAdresse.ts';

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

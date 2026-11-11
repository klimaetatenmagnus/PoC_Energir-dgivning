/**
 * Geonorge-adressesøk for adresseoppslaget.
 *
 * Tjenesten dekker bare Oslo kommune (CSV-data, solkart og forslagssøket er
 * Oslo-avgrenset). Uten kommunefilter rangerer Geonorge ofte samme gateadresse
 * i en annen kommune først – «Neptunveien 9A» gir Stavanger, «Ivar Aasens vei 23A»
 * gir Lørenskog. Oppslaget gikk da videre mot feil eiendom, der Matrikkelen
 * returnerer areal 0, og endte i CSV-fallback uten gnr/bnr.
 */
import { LookupNotFoundError } from './lookupErrors.ts';

export const OSLO_KOMMUNENUMMER = '0301';

const GEONORGE_SOK_URL = 'https://ws.geonorge.no/adresser/v1/sok';

export interface GeoAdresseEntry {
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  adressekode: number;
  nummer?: string;
  husnummer?: string;
  bokstav?: string;
  adressetekst?: string;
  poststed?: string;
  postnummer?: string;
}

/** Bygger søke-URL mot Geonorge, avgrenset til Oslo kommune. */
export function buildGeonorgeSearchUrl(query: string): string {
  return (
    `${GEONORGE_SOK_URL}?` +
    new URLSearchParams({
      sok: query,
      fuzzy: 'true',
      kommunenummer: OSLO_KOMMUNENUMMER,
    })
      .toString()
      .replace(/\+/g, '%20')
  );
}

/**
 * Velger første treff i Oslo. Kommunefilteret i URL-en skal allerede sørge for
 * at alle treff er i Oslo; dette er en ekstra sikring slik at oppslaget aldri
 * fortsetter med en eiendom i en annen kommune.
 */
export function selectOsloAdresse(
  adresser: GeoAdresseEntry[] | undefined
): GeoAdresseEntry | undefined {
  return adresser?.find((entry) => entry.kommunenummer === OSLO_KOMMUNENUMMER);
}

/**
 * Normaliserer adressetekst for sammenligning: små bokstaver, komma og punktum
 * som mellomrom, og «12 b» som «12b».
 */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/(\d+)\s+([a-zæøå])(?=\s|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sant når søketeksten er nøyaktig denne adressen, eventuelt fulgt av
 * postnummer og poststed («Kvernkallveien 10, 0382 OSLO» stemmer med
 * Kvernkallveien 10, men ikke med Kvernkallveien 10B eller 100).
 */
export function matchesSearchText(entry: GeoAdresseEntry, query: string): boolean {
  const adresse = normalizeForMatch(entry.adressetekst ?? '');
  if (!adresse) {
    return false;
  }
  const sok = normalizeForMatch(query);
  return sok === adresse || sok.startsWith(`${adresse} `);
}

/** Det findOsloAdresse trenger av et HTTP-svar (node-fetch Response passer). */
export interface GeonorgeSearchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type GeonorgeSearchFetch = (url: string) => Promise<GeonorgeSearchResponse>;

/**
 * Skrivemåter som prøves etter tur: med/uten komma og punktum, og med/uten
 * mellomrom mellom husnummer og bokstav. Varianter som gir samme URL fjernes,
 * og det samme gjør varianter uten bokstav eller siffer: for tom tekst eller
 * bare tegnsetting svarer Geonorge med vilkårlige Oslo-adresser.
 */
export function buildAddressSearchVariants(adresse: string): string[] {
  const variants = [
    adresse,
    adresse.replace(/,/g, ' ').trim().replace(/\s+/g, ' '),
    adresse
      .replace(/,/g, ' ')
      .replace(/(\d+)([A-Za-z])/, '$1 $2')
      .trim()
      .replace(/\s+/g, ' '),
    adresse
      .replace(/,/g, ' ')
      .replace(/(\d+)\s+([A-Za-z])/, '$1$2')
      .trim()
      .replace(/\s+/g, ' '),
    adresse.replace(/(\d+)\s+([A-Za-z])/, '$1$2'),
    adresse.replace(/\./g, '').trim().replace(/\s+/g, ' '),
    adresse.replace(/[.,]/g, ' ').trim().replace(/\s+/g, ' '),
  ];

  const seen = new Set<string>();
  const uniqueVariants: string[] = [];
  for (const variant of variants) {
    if (!/[\p{L}\p{N}]/u.test(variant)) {
      continue;
    }
    const url = buildGeonorgeSearchUrl(variant);
    if (!seen.has(url)) {
      seen.add(url);
      uniqueVariants.push(variant);
    }
  }
  return uniqueVariants;
}

/**
 * Feilstatuser som betyr at selve søketeksten ble avvist. Da finnes det ingen
 * treff på den varianten:
 * - 400: Geonorge avviser teksten (for eksempel jokertegn sammen med fuzzy,
 *   eller mer enn 500 tegn).
 * - 413/414/431: teksten er så lang at mellomtjeneren foran Geonorge avviser
 *   forespørselen (målt: 431 ved ca. 16 000 tegn i URL-en, 414 ved ca. 20 000).
 *
 * Alle andre feilstatuser betyr at søket ikke ble utført: 401/403 (sperret),
 * 404/410 (endepunktet er flyttet), 408, 429 og 5xx. De sier ingenting om
 * adressen finnes, og skal gi driftsfeil – ikke «ikke funnet».
 */
function isSearchRejectedStatus(status: number): boolean {
  return status === 400 || status === 413 || status === 414 || status === 431;
}

/**
 * Leser trefflisten fra et 200-svar. Gir null når svaret ikke har formen
 * `{ adresser: [...] }`. Da har vi ikke fått svar på søket (for eksempel en
 * feilside fra en mellomtjener), og kan ikke slutte at adressen mangler.
 */
function readAdresser(payload: unknown): GeoAdresseEntry[] | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const adresser = (payload as { adresser?: unknown }).adresser;
  return Array.isArray(adresser) ? (adresser as GeoAdresseEntry[]) : null;
}

/**
 * Finner adressen i Oslo ved å prøve søkevariantene etter tur.
 *
 * Returnerer det første Oslo-treffet som stemmer nøyaktig med søketeksten
 * (se matchesSearchText). Gir ingen variant et slikt treff, returneres første
 * Oslo-treff fra den første varianten som ga noen.
 *
 * Kaster LookupNotFoundError bare når Geonorge faktisk har svart på alle
 * variantene uten Oslo-treff (tom treffliste, eller en status som betyr at
 * søketeksten ble avvist). Hvis minst ett søk feilet (tidsavbrudd,
 * nettverksfeil, annen feilstatus, eller et svar uten treffliste) vet vi ikke
 * om adressen finnes, og da kastes en vanlig Error slik at kalleren kan melde
 * driftsfeil.
 */
export async function findOsloAdresse(
  adresse: string,
  fetchSearch: GeonorgeSearchFetch
): Promise<GeoAdresseEntry> {
  let upstreamFailures = 0;
  let forsteOsloTreff: GeoAdresseEntry | undefined;

  for (const variant of buildAddressSearchVariants(adresse)) {
    let adresser: GeoAdresseEntry[] | null;
    try {
      const response = await fetchSearch(buildGeonorgeSearchUrl(variant));
      if (!response.ok) {
        if (!isSearchRejectedStatus(response.status)) {
          upstreamFailures += 1;
        }
        continue;
      }
      adresser = readAdresser(await response.json());
    } catch {
      upstreamFailures += 1;
      continue;
    }

    if (!adresser) {
      upstreamFailures += 1;
      continue;
    }

    // Fuzzy-søket rangerer ofte naboadresser foran den som ble søkt på
    // («Kvernkallveien 10, 0382 OSLO» gir 10B først, «Sognsveien 7, …» gir 6A).
    // Velg derfor treffet som stemmer med søketeksten. Finnes det ikke i denne
    // varianten, prøv neste skrivemåte før vi nøyer oss med et tilnærmet treff.
    const osloTreff = adresser.filter(
      (entry) => entry.kommunenummer === OSLO_KOMMUNENUMMER
    );
    const eksakt = osloTreff.find((entry) => matchesSearchText(entry, adresse));
    if (eksakt) {
      return eksakt;
    }
    forsteOsloTreff ??= osloTreff[0];
  }

  // Ingen variant ga eksakt treff (skrivefeil, manglende bokstav o.l.): bruk
  // første Oslo-treff, slik oppslaget alltid har gjort.
  if (forsteOsloTreff) {
    return forsteOsloTreff;
  }

  if (upstreamFailures > 0) {
    throw new Error(
      `Geonorge adressesøk feilet for ${upstreamFailures} søkevariant(er) – kan ikke avgjøre om adressen finnes`
    );
  }

  throw new LookupNotFoundError(
    'address',
    'Ingen adresse funnet i Geonorge etter å ha prøvd alle varianter'
  );
}

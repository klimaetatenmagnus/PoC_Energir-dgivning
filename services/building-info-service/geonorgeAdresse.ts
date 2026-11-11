/**
 * Geonorge-adressesøk for adresseoppslaget.
 *
 * Tjenesten dekker bare Oslo kommune (CSV-data, solkart og forslagssøket er
 * Oslo-avgrenset). Uten kommunefilter rangerer Geonorge ofte samme gateadresse
 * i en annen kommune først – «Neptunveien 9A» gir Stavanger, «Ivar Aasens vei 23A»
 * gir Lørenskog. Oppslaget gikk da videre mot feil eiendom, der Matrikkelen
 * returnerer areal 0, og endte i CSV-fallback uten gnr/bnr.
 */
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

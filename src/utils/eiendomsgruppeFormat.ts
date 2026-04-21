/**
 * Hjelpere for visning av borettslag/sameie-informasjon i UI.
 */

/** Trekker ut gatenavnet (uten husnummer) fra en fullstendig adresse. */
export function trekkUtGatenavn(adresse: string | undefined | null): string | null {
  if (!adresse) return null;
  const match = adresse.match(/^([^\d,]+?)(?:\s*\d|,|$)/);
  return match?.[1]?.trim() ?? null;
}

/**
 * Returnerer visningsnavn for gruppen — f.eks. "Oppsal borettslag" eller
 * "Sameiet i Hesteskoen". Fjerner trailing " borettslag" fra registrert navn
 * så vi kan sette det på igjen konsistent.
 */
export function gruppenavn(
  type: 'borettslag' | 'sameie',
  navn: string | undefined,
  searchedAdresse: string | undefined,
): string {
  if (type === 'borettslag') {
    if (navn) {
      // Grunnbok-navn kan ha "borettslag(et)" både foran og bak
      // (f.eks. "BORETTSLAGET VØYENVOLLEN" eller "Oppsal borettslag").
      // Strip begge varianter før vi konsekvent setter " borettslag" på igjen.
      const stripped = navn
        .replace(/^\s*borettslag(?:et)?\s+/i, '')
        .replace(/\s+borettslag(?:et)?$/i, '')
        .trim();
      return `${stripped} borettslag`;
    }
    return 'borettslaget';
  }
  if (navn) return navn;
  const gatenavn = trekkUtGatenavn(searchedAdresse);
  return gatenavn ? `Sameiet i ${gatenavn}` : 'sameiet';
}

/**
 * Beregner byggeår-tekst for en gruppe bygg. Bygg med ukjent byggeår
 * ignoreres — vi viser kun range basert på kjente år.
 *  - Alle kjente like: "1965"
 *  - Kjente ulike: "1953 til 2011"
 *  - Alle ukjent: null (caller kan droppe chippen)
 */
export function byggeaarRangeTekst(byggeaar: ReadonlyArray<number | null>): string | null {
  const kjente = byggeaar
    .filter((y): y is number => typeof y === 'number' && Number.isFinite(y) && y > 0)
    .sort((a, b) => a - b);
  if (kjente.length === 0) return null;
  const oldest = kjente[0];
  const newest = kjente[kjente.length - 1];
  if (oldest === newest) return String(oldest);
  return `${oldest} til ${newest}`;
}

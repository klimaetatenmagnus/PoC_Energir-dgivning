// Temavarianter for annonse-landingssider (/solceller, /vinduer, /varmepumpe).
// Denne modulen er felles kilde for både React-appen og de prerendrede
// HTML-filene (via vite.config.ts), slik at statisk og hydrert innhold er identisk.

export type TemaId = 'solceller' | 'vinduer' | 'varmepumpe';

export interface TemaSection {
  heading: string;
  text: string;
}

export interface TemaConfig {
  id: TemaId;
  /** URL-sti for varianten (uten trailing slash) */
  path: string;
  /** Unik <title> for varianten */
  title: string;
  /** Unik meta description for varianten */
  metaDescription: string;
  /** Undertittel på landingssiden — rendres som H1 på variantsidene */
  subtitle: string;
  /** Tiltak-IDer (fra content/tiltak) som forhåndsavhukes på tiltakssiden */
  preselectTiltak: string[];
  /** Tematisk innhold som vises under adressesøket */
  sections: TemaSection[];
}

export const TEMA_CONFIGS: Record<TemaId, TemaConfig> = {
  solceller: {
    id: 'solceller',
    path: '/solceller',
    title: 'Solceller i Oslo – sjekk solpotensialet til boligen din | Energinøkkelen',
    metaDescription:
      'Søk opp adressen din og se hvor mye energi boligen kan produsere med solceller, basert på Oslo kommunes solkart. Gratis verktøy fra Klimaetaten.',
    subtitle: 'Søk opp adressen din, og se hvor mye du kan spare på solceller',
    preselectTiltak: ['solenergi'],
    sections: [
      {
        heading: 'Hvor godt egner taket ditt seg for solceller?',
        text: 'Energinøkkelen henter solinnstrålingsdata for takflatene på adressen din fra Oslo kommunes solkart. Du får et estimat på hvor mye strøm et solcelleanlegg på taket kan produsere i året, og hvor mye det kan bety i reduserte strømutgifter.',
      },
      {
        heading: 'Hva viser verktøyet?',
        text: 'Verktøyet viser estimert årlig produksjon i kilowattimer og hva det tilsvarer i kroner med dagens strømpriser. Estimatet tar hensyn til takets helning og retning. Det er et anslag på besparelse og effekt – ikke et pristilbud på anlegg eller installasjon.',
      },
      {
        heading: 'Passer solceller for alle boliger?',
        text: 'Takflater med mye sol og lite skygge egner seg best. Energinøkkelen viser bare solenergi som tiltak når solkartet tilsier at taket har et reelt potensial. For borettslag og sameier vises potensialet for hele bygget.',
      },
      {
        heading: 'Hva gjør jeg videre?',
        text: 'Har taket godt potensial, kan du ta estimatet med til en installatør for et konkret tilbud. Sjekk også Oslo kommunes tilskuddsordninger og Enova-støtte – verktøyet peker deg videre til relevante ordninger.',
      },
    ],
  },
  vinduer: {
    id: 'vinduer',
    path: '/vinduer',
    title: 'Nye vinduer og etterisolering – se hva du kan spare | Energinøkkelen',
    metaDescription:
      'Søk opp adressen din og se hvor mye energi boligen kan spare med nye vinduer og etterisolering. Gratis verktøy fra Klimaetaten i Oslo kommune.',
    subtitle: 'Søk opp adressen din, og se hvor mye du kan spare på nye vinduer og etterisolering',
    preselectTiltak: ['vinduer', 'etterisolering-yttervegg', 'etterisolering-kjeller-loft'],
    sections: [
      {
        heading: 'Hvor mye varme forsvinner ut i dag?',
        text: 'Eldre vinduer og dårlig isolerte vegger, kjellere og loft er blant de vanligste årsakene til høyt energiforbruk i norske boliger. Energinøkkelen bruker byggeåret og bygningstypen til boligen din til å estimere hvor mye du kan spare på å oppgradere.',
      },
      {
        heading: 'To-lags eller tre-lags glass?',
        text: 'Verktøyet lar deg sammenligne effekten av å bytte til to-lags eller tre-lags vinduer, målt i kilowattimer og kroner per år. For vernede bygg på Byantikvarens gule liste vises alternativene som er aktuelle der.',
      },
      {
        heading: 'Etterisolering av vegg, kjeller og loft',
        text: 'Du kan også huke av for etterisolering av yttervegg og av kjeller og loft, og se hvordan tiltakene sammen påvirker estimert energiforbruk og energimerke. Estimatet gjelder besparelse i energi – hva selve arbeidet koster, må du avklare med håndverker.',
      },
    ],
  },
  varmepumpe: {
    id: 'varmepumpe',
    path: '/varmepumpe',
    title: 'Varmepumpe – se hva boligen din kan spare | Energinøkkelen',
    metaDescription:
      'Søk opp adressen din og se hvor mye energi boligen kan spare med varmepumpe – luft-luft, luft-vann eller væske-vann. Gratis verktøy fra Klimaetaten.',
    subtitle: 'Søk opp adressen din, og se hvor mye du kan spare på varmepumpe',
    preselectTiltak: ['varmepumpe'],
    sections: [
      {
        heading: 'Hvor mye kan en varmepumpe spare?',
        text: 'En varmepumpe flytter varme i stedet for å produsere den, og bruker derfor langt mindre strøm enn panelovner til samme oppvarming. Energinøkkelen estimerer besparelsen for akkurat din bolig, basert på byggeår, bygningstype og areal.',
      },
      {
        heading: 'Luft-luft, luft-vann eller væske-vann?',
        text: 'Verktøyet lar deg sammenligne de tre vanligste typene: luft-luft er rimeligst og enklest å installere, luft-vann varmer også tappevann, og væske-vann (bergvarme) gir høyest besparelse. Du ser effekten i kilowattimer og kroner per år for hver av dem.',
      },
      {
        heading: 'Hva viser estimatet – og hva viser det ikke?',
        text: 'Estimatet gjelder redusert energiforbruk og hva det betyr for strømregningen og boligens energimerke. Det er ikke et pristilbud – kostnad for pumpe og montering varierer og må innhentes fra forhandler eller installatør.',
      },
    ],
  },
};

/** Generisk undertittel på forsiden (uendret fra i dag) */
export const GENERIC_SUBTITLE_DESKTOP =
  'Søk opp adressen din, og se hvor mye du kan spare på energioppgraderinger';
export const GENERIC_SUBTITLE_MOBILE =
  'Søk på en adresse og se hvor mye du kan spare på energioppgraderinger';

const TEMA_IDS = Object.keys(TEMA_CONFIGS) as TemaId[];

function parseTema(value: string | null | undefined): TemaId | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return TEMA_IDS.includes(normalized as TemaId) ? (normalized as TemaId) : null;
}

/**
 * Finn aktivt tema fra URL: sti (/solceller) har prioritet, deretter ?tema=solceller.
 * Begge former er deep-linkbare fra annonser og sitelinks.
 */
export function getActiveTema(
  pathname: string = window.location.pathname,
  search: string = window.location.search
): TemaConfig | null {
  const pathSegment = pathname.replace(/\/+$/, '').split('/').pop();
  const fromPath = parseTema(pathSegment);
  if (fromPath) return TEMA_CONFIGS[fromPath];

  const fromQuery = parseTema(new URLSearchParams(search).get('tema'));
  return fromQuery ? TEMA_CONFIGS[fromQuery] : null;
}

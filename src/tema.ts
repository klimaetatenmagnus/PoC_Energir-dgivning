// Temavarianter for annonse-landingssider (/solceller, /vinduer, /varmepumpe).
// Denne modulen er felles kilde for både React-appen og de prerendrede
// HTML-filene (via vite.config.ts), slik at statisk og hydrert innhold er identisk.
//
// Tekstene er skrevet med tanke på landingssideopplevelse i Google Ads: de
// speiler søkeordene folk faktisk bruker, forklarer ærlig hva verktøyet viser og
// ikke viser, og peker videre til tilskuddsordninger. Verktøyet oppgir aldri
// priser – kostnad omtales kun generelt (hva den avhenger av, at tilskudd trekker
// den ned). Tilskuddssatser holdes utenfor tekstene så de ikke går ut på dato.

export type TemaId = 'solceller' | 'vinduer' | 'varmepumpe';

export interface TemaLink {
  label: string;
  href: string;
}

export interface TemaSection {
  heading: string;
  /** Ett eller flere avsnitt */
  paragraphs: string[];
  /** Valgfrie lenker som listes etter avsnittene (tilskudd, Enova m.m.) */
  links?: TemaLink[];
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

const KLIMATILSKUDD = 'https://www.klimaoslo.no/klimatilskudd/';

const SLIK_BRUKER_DU = (tiltak: string, andre: string): string =>
  'Skriv inn adressen din øverst på siden. Verktøyet finner boligen i offentlige registre og viser ' +
  tiltak +
  ', sammen med andre tiltak som ' +
  andre +
  '. Tjenesten er gratis, krever ingen innlogging, og ingen selger tar kontakt i etterkant.';

export const TEMA_CONFIGS: Record<TemaId, TemaConfig> = {
  solceller: {
    id: 'solceller',
    path: '/solceller',
    title: 'Solceller i Oslo – sjekk om solcellepanel lønner seg på taket ditt | Energinøkkelen',
    metaDescription:
      'Søk opp adressen din og se hvor mye strøm solcellepanel på taket kan produsere, basert på Oslo kommunes solkart. Gratis og nøytralt verktøy fra Oslo kommune.',
    subtitle: 'Søk opp adressen din, og se hvor mye du kan spare på solceller',
    preselectTiltak: ['solenergi'],
    sections: [
      {
        heading: 'Hvor godt egner taket ditt seg for solceller?',
        paragraphs: [
          'Energinøkkelen henter solinnstrålingsdata for takflatene på adressen din fra Oslo kommunes solkart. Du får et estimat på hvor mye strøm et solcelleanlegg på taket kan produsere i året, og hvor mye det kan bety i reduserte strømutgifter – beregnet for akkurat din bolig, ikke et gjennomsnitt.',
          'Estimatet tar hensyn til takets helning og himmelretning. Takflater mot sør, sørvest og sørøst med lite skygge fra trær og nabobygg gir mest, men også øst- og vestvendte tak kan gi god produksjon over året. Solcellepanel er ikke aktuelt på alle tak: Energinøkkelen viser bare solenergi som tiltak når solkartet tilsier at taket har et reelt potensial.',
        ],
      },
      {
        heading: 'Lønner solceller seg i Oslo?',
        paragraphs: [
          'Det avhenger av tre ting: hvor mye anlegget produserer, hvor stor del av strømmen du bruker selv, og hva strømmen koster. Solcellepanel produserer mest om sommeren og midt på dagen, så gevinsten er størst for husholdninger som bruker strøm på dagtid – eller som kan flytte forbruk som varmtvann, lading av elbil og vask til timene med sol.',
          'Verktøyet viser estimert årlig produksjon i kilowattimer og hva det tilsvarer i kroner med dagens strømpriser. Produserer du mer enn du bruker, kan overskuddet selges tilbake til nettet som plusskunde, men prisen du får for solgt strøm er lavere enn prisen du betaler for kjøpt strøm. Den reelle besparelsen er derfor høyest når mest mulig brukes i egen bolig.',
        ],
      },
      {
        heading: 'Solcellekalkulator for boliger i Oslo',
        paragraphs: [
          'Energinøkkelen fungerer som en enkel solcellekalkulator: i stedet for å be deg anslå takareal og vinkel selv, henter verktøyet takflatene fra solkartet og regner ut potensialet automatisk. Du trenger bare adressen. Resultatet er et anslag på produksjon, besparelse og effekt på boligens energimerke – ikke et pristilbud på anlegg eller installasjon.',
        ],
      },
      {
        heading: 'Hva koster et solcelleanlegg?',
        paragraphs: [
          'Energinøkkelen oppgir ikke priser, fordi kostnaden varierer mye med anleggets størrelse, takets utforming, valg av paneler og hvor krevende monteringen er. Prisen på solcellepaneler har falt kraftig de siste ti årene, og et anlegg har normalt en levetid på 25–30 år, så regnestykket ser annerledes ut i dag enn for få år siden.',
          'Bruk estimatet fra Energinøkkelen som utgangspunkt, og hent inn tilbud fra flere installatører før du bestemmer deg. Tilskudd fra Enova og Oslo kommune trekker kostnaden ned – se lenger ned på siden.',
        ],
      },
      {
        heading: 'Solcellepanel på taket, solcelletakstein eller solfangere?',
        paragraphs: [
          'Standard solcellepanel montert utenpå eksisterende tak er det vanligste og som regel det rimeligste alternativet. Solcelletakstein og integrerte løsninger kan være aktuelt hvis taket uansett skal legges om, eller hvis bygget er verneverdig og synlige paneler ikke er ønsket. Solfangere produserer varme til tappevann i stedet for strøm, og er en annen type anlegg.',
          'Estimatet i Energinøkkelen gjelder strømproduksjon fra solceller på tak. Uansett løsning bør du sjekke om taket tåler vekten, og om tiltaket krever byggesøknad – solceller som følger takflaten er som regel ikke søknadspliktig, men vernede bygg og bygg på Byantikvarens gule liste har egne regler.',
        ],
      },
      {
        heading: 'Solceller i borettslag og sameier',
        paragraphs: [
          'For borettslag og sameier viser Energinøkkelen solpotensialet for hele bygget, ikke bare én leilighet. Et felles solcelleanlegg kan forsyne fellesstrøm som lys, heis og varmtvann, og med deling av overskudd kan produksjonen også fordeles på beboerne. Tiltaket må vedtas av styret eller generalforsamlingen.',
          'Oslo kommune gir solenergitilskudd til borettslag, sameier og boligstiftelser gjennom Klima- og energifondet, og dekker en andel av de dokumenterte investeringskostnadene.',
        ],
        links: [
          {
            label: 'Solenergitilskudd for borettslag og sameier (klimaoslo.no)',
            href: 'https://www.klimaoslo.no/tilskudd/solenergitilskudd/',
          },
        ],
      },
      {
        heading: 'Støtte og tilskudd til solceller',
        paragraphs: [
          'Eier du enebolig, tomannsbolig eller rekkehus, kan du søke Enova om støtte til solcelleanlegg etter at anlegget er satt i drift. Borettslag og sameier i Oslo kan søke kommunens solenergitilskudd. Etter adresseoppslaget viser Energinøkkelen hvilke ordninger som er aktuelle for din boligtype.',
        ],
        links: [
          { label: 'Enova: støtte til solcelleanlegg', href: 'https://enova.no/nb/privat/bolig/stotte/solcelleanlegg' },
          { label: 'Alle tilskuddsordninger fra Oslo kommune', href: KLIMATILSKUDD },
        ],
      },
      {
        heading: 'Slik bruker du Energinøkkelen',
        paragraphs: [
          SLIK_BRUKER_DU(
            'solpotensialet for taket ditt. Solenergi er forhåndsvalgt på denne siden, så du ser effekten med én gang',
            'varmepumpe, nye vinduer og etterisolering'
          ),
        ],
      },
    ],
  },
  vinduer: {
    id: 'vinduer',
    path: '/vinduer',
    title: 'Bytte vinduer og etterisolere – se hva boligen din kan spare | Energinøkkelen',
    metaDescription:
      'Søk opp adressen din og se hvor mye energi boligen kan spare på å bytte vinduer og etterisolere vegg, loft og kjeller. Gratis og nøytralt verktøy fra Oslo kommune.',
    subtitle: 'Søk opp adressen din, og se hvor mye du kan spare på nye vinduer og etterisolering',
    preselectTiltak: ['vinduer', 'etterisolering-yttervegg', 'etterisolering-kjeller-loft'],
    sections: [
      {
        heading: 'Hvor mye varme forsvinner ut i dag?',
        paragraphs: [
          'Eldre vinduer og dårlig isolerte vegger, loft og kjellere er blant de vanligste årsakene til høyt energiforbruk i norske boliger. I en bolig fra før 1980 kan en stor del av varmen forsvinne rett gjennom klimaskallet. Energinøkkelen bruker byggeåret og bygningstypen til boligen din til å estimere dagens varmetap og hvor mye du kan spare på å oppgradere.',
          'Estimatet vises i kilowattimer og kroner per år, og du ser også hvordan tiltakene påvirker boligens energimerke.',
        ],
      },
      {
        heading: 'Bytte vinduer: to-lags eller tre-lags glass?',
        paragraphs: [
          'Vinduer måles i U-verdi – jo lavere tall, desto mindre varme slipper ut. Eldre to-lags vinduer har gjerne U-verdi rundt 2,5, mens moderne energivinduer med tre-lags glass ligger på rundt 0,8 eller lavere. Å bytte vinduer er derfor et av tiltakene som merkes best både på strømregningen og på komforten: mindre kaldras, mindre trekk og bedre lyddemping.',
          'Energinøkkelen lar deg sammenligne effekten av å bytte til nye to-lags eller tre-lags vinduer for akkurat din bolig.',
        ],
      },
      {
        heading: 'Etterisolering av yttervegg',
        paragraphs: [
          'Yttervegger kan etterisoleres utvendig, ofte samtidig med at kledningen byttes, eller innvendig når fasaden skal beholdes som den er. Utvendig etterisolering gir best effekt og fjerner kuldebroer, men endrer fasadens uttrykk og kan være søknadspliktig. Innvendig etterisolering tar noe gulvareal og krever at fukt håndteres riktig.',
          'I Energinøkkelen kan du huke av for etterisolering av yttervegg og se hvor mye det utgjør alene og sammen med nye vinduer.',
        ],
      },
      {
        heading: 'Etterisolering av loft og kjeller',
        paragraphs: [
          'Varm luft stiger, så et dårlig isolert loft er ofte stedet du taper mest varme i forhold til hva tiltaket krever. Å legge mer isolasjon på loftsgulvet eller i skråtaket er som regel enkelt og gir rask effekt. Det samme gjelder isolering mot kald kjeller eller kryperom. Energinøkkelen har etterisolering av kjeller og loft som eget tiltak, slik at du kan se effekten separat.',
        ],
      },
      {
        heading: 'Hva koster det å bytte vinduer eller etterisolere?',
        paragraphs: [
          'Energinøkkelen oppgir ikke priser. Kostnaden for nye vinduer avhenger av antall, størrelse, glasstype, materiale og hvor krevende monteringen er. For etterisolering avhenger den av hvor mange kvadratmeter som skal isoleres, og om kledningen byttes samtidig. Estimatet vårt gjelder besparelsen i energi og kroner – hva selve arbeidet koster, må du avklare med håndverker.',
          'Et godt utgangspunkt er å hente inn tilbud fra flere leverandører og be om at U-verdi før og etter dokumenteres. Det trenger du også hvis du skal søke tilskudd.',
        ],
      },
      {
        heading: 'Tilskudd til vinduer og etterisolering',
        paragraphs: [
          'Oslo kommune gir tilskudd til bytte av vinduer og ytterdører gjennom Klima- og energifondet, med egne satser for bygg på Byantikvarens gule liste. Enova gir støtte til energieffektive vinduer og ytterdører og til etterisolering av vegg, tak og loft. Etter adresseoppslaget viser Energinøkkelen hvilke ordninger som er aktuelle for din bolig.',
        ],
        links: [
          {
            label: 'Oslo kommune: tilskudd til bytte av vinduer og ytterdører',
            href: 'https://www.klimaoslo.no/tilskudd/tilskudd-til-bytte-av-vinduer-og-dorer/',
          },
          {
            label: 'Enova: energieffektive vinduer og ytterdører',
            href: 'https://enova.no/nb/privat/bolig/stotte/energieffektive-vinduer-og-ytterdorer',
          },
          { label: 'Enova: etterisolering av vegg', href: 'https://enova.no/nb/privat/bolig/stotte/etterisolering-vegg' },
          {
            label: 'Enova: etterisolering av tak og loft',
            href: 'https://enova.no/nb/privat/bolig/stotte/etterisolering-tak-og-loft',
          },
          { label: 'Alle tilskuddsordninger fra Oslo kommune', href: KLIMATILSKUDD },
        ],
      },
      {
        heading: 'Vernede bygg og gul liste',
        paragraphs: [
          'Står boligen på Byantikvarens gule liste, eller ligger den i et område med bevaringsverdig bebyggelse, må vinduer og fasade behandles med omhu. Ofte er varevinduer eller nye vinduer med samme utseende som de opprinnelige den riktige løsningen. Energinøkkelen sjekker automatisk om adressen står på gul liste, og viser da alternativene som er aktuelle der.',
        ],
      },
      {
        heading: 'Slik bruker du Energinøkkelen',
        paragraphs: [
          SLIK_BRUKER_DU(
            'hvor mye du kan spare på nye vinduer og etterisolering. Vinduer og etterisolering er forhåndsvalgt på denne siden',
            'varmepumpe og solceller'
          ),
        ],
      },
    ],
  },
  varmepumpe: {
    id: 'varmepumpe',
    path: '/varmepumpe',
    title: 'Varmepumpe eller bergvarme – se hva boligen din kan spare | Energinøkkelen',
    metaDescription:
      'Søk opp adressen din og se hvor mye energi boligen kan spare med varmepumpe – luft-luft, luft-til-vann eller bergvarme. Gratis og nøytralt verktøy fra Oslo kommune.',
    subtitle: 'Søk opp adressen din, og se hvor mye du kan spare på varmepumpe',
    preselectTiltak: ['varmepumpe'],
    sections: [
      {
        heading: 'Hvor mye kan en varmepumpe spare?',
        paragraphs: [
          'En varmepumpe flytter varme i stedet for å produsere den, og leverer typisk to til fire ganger så mye varme som strømmen den bruker. Sammenlignet med panelovner og elektrisk gulvvarme kan strømforbruket til oppvarming reduseres kraftig – og i en bolig i Oslo går gjerne over halvparten av energibruken nettopp til oppvarming.',
          'Energinøkkelen estimerer besparelsen for akkurat din bolig, basert på byggeår, bygningstype og areal, og viser hva den betyr i kilowattimer og kroner per år.',
        ],
      },
      {
        heading: 'Luft-til-luft varmepumpe',
        paragraphs: [
          'Luft-til-luft er den enkleste og rimeligste typen: en utedel og en innedel som varmer luften i rommet. Den passer godt i boliger med åpen planløsning og elektrisk oppvarming, og kan også kjøle om sommeren. I rom langt fra innedelen trenger du fortsatt annen oppvarming.',
        ],
      },
      {
        heading: 'Luft-til-vann varmepumpe',
        paragraphs: [
          'Luft-til-vann varmepumpe henter varme fra uteluften og avgir den til et vannbårent system – radiatorer eller gulvvarme – og varmer også tappevann. Den passer boliger som allerede har vannbåren varme, eller som skal rehabiliteres. Effekten synker noe på de kaldeste dagene, så anlegget trenger en spisslast som elkolbe.',
        ],
      },
      {
        heading: 'Bergvarme og andre væske-til-vann varmepumper',
        paragraphs: [
          'Bergvarme – også kalt bergvarmepumpe eller væske-til-vann varmepumpe – henter varme fra en energibrønn boret ned i fjellet. Temperaturen i grunnen er stabil hele året, så pumpen gir høy og jevn effekt også i kuldeperioder. Jordvarme og sjøvarme fungerer på samme måte, med slanger i bakken eller i vann. Dette er løsningen som gir høyest besparelse, men som også krever mest installasjon.',
          'Bergvarme er særlig aktuelt for boliger med høyt varmebehov, og for borettslag og sameier som kan dele en felles brønnpark.',
        ],
      },
      {
        heading: 'Hva koster en varmepumpe?',
        paragraphs: [
          'Energinøkkelen oppgir ikke priser. Luft-til-luft er rimeligst å installere, luft-til-vann koster mer fordi den kobles til et vannbårent anlegg, og bergvarme er dyrest fordi det må bores energibrønn. Til gjengjeld gir de dyrere løsningene høyest besparelse og lang levetid. Kostnaden avhenger av boligens størrelse, eksisterende oppvarming og hvor krevende monteringen er.',
          'Bruk besparelsen fra Energinøkkelen som utgangspunkt, og hent inn tilbud fra flere installatører. Tilskudd fra Enova og Oslo kommune reduserer kostnaden for de mest omfattende løsningene.',
        ],
      },
      {
        heading: 'Tilskudd til varmepumpe',
        paragraphs: [
          'Enova gir støtte til luft-til-vann og væske-til-vann varmepumpe i privatboliger. Oslo kommune gir tilskudd til væske-til-vann varmepumpe (bergvarme) i borettslag og sameier gjennom Klima- og energifondet, og til varmepumpebereder for tappevann i mindre boliger. Luft-til-luft varmepumpe støttes normalt ikke. Etter adresseoppslaget viser Energinøkkelen hvilke ordninger som er aktuelle for din boligtype.',
        ],
        links: [
          {
            label: 'Enova: luft-til-vann varmepumpe',
            href: 'https://enova.no/nb/privat/bolig/stotte/luft-til-vann-varmepumpe',
          },
          {
            label: 'Enova: væske-til-vann varmepumpe',
            href: 'https://enova.no/nb/privat/bolig/stotte/vaeske-til-vann-varmepumpe',
          },
          {
            label: 'Oslo kommune: tilskudd til væske-til-vann varmepumpe',
            href: 'https://www.klimaoslo.no/tilskudd/vaeske-til-vann-varmepumpe/',
          },
          {
            label: 'Oslo kommune: tilskudd til varmepumpebereder',
            href: 'https://www.klimaoslo.no/tilskudd/varmepumpebereder/',
          },
          { label: 'Alle tilskuddsordninger fra Oslo kommune', href: KLIMATILSKUDD },
        ],
      },
      {
        heading: 'Varmepumpe i borettslag og sameier',
        paragraphs: [
          'For borettslag og sameier er en felles varmepumpeløsning – ofte bergvarme koblet til en felles varmesentral – som regel mer lønnsomt enn at hver beboer installerer sin egen. Energinøkkelen viser potensialet for hele bygget, og Oslo kommune dekker deler av kostnaden til prosjektering, boring og installasjon når tiltaket er vedtatt av styret eller generalforsamlingen.',
        ],
        links: [
          {
            label: 'Oslo kommune: støtte til energitiltak i borettslag og sameier',
            href: 'https://www.klimaoslo.no/tilskudd/stotte-til-energitiltak-i-borettslag-og-sameier/',
          },
        ],
      },
      {
        heading: 'Slik bruker du Energinøkkelen',
        paragraphs: [
          SLIK_BRUKER_DU(
            'hva du kan spare på varmepumpe – luft-luft, luft-vann eller bergvarme. Varmepumpe er forhåndsvalgt på denne siden',
            'nye vinduer, etterisolering og solceller'
          ),
        ],
      },
    ],
  },
};

/** Lenker mellom temasidene og forsiden – vises nederst på alle landingssider */
export const TEMA_NAV: { heading: string; links: TemaLink[] } = {
  heading: 'Utforsk energitiltak',
  links: [
    { label: 'Solceller', href: '/solceller' },
    { label: 'Nye vinduer og etterisolering', href: '/vinduer' },
    { label: 'Varmepumpe og bergvarme', href: '/varmepumpe' },
    { label: 'Alle tiltak – Energinøkkelen', href: '/' },
  ],
};

/** Hvem som står bak, hva verktøyet bygger på og hva det ikke gjør – vises på alle landingssider */
export const OM_ENERGINOKKELEN: TemaSection = {
  heading: 'Om Energinøkkelen',
  paragraphs: [
    'Energinøkkelen er et gratis og nøytralt verktøy fra Oslo kommune, utviklet av Klimaetaten. Verktøyet henter opplysninger om boligen fra offentlige kilder – blant annet matrikkelen, energimerkeregisteret og Oslo kommunes solkart – og estimerer hvor mye energi og penger ulike tiltak kan spare. Estimatene er veiledende og erstatter ikke en befaring fra fagfolk.',
    'Energinøkkelen selger ingenting, gir ingen pristilbud og formidler ikke kontakt til leverandører. Målet er å gjøre det enklere for boligeiere, borettslag og sameier i Oslo å velge tiltakene som lønner seg mest.',
  ],
  links: [
    { label: 'Klimaetaten i Oslo kommune', href: 'https://www.oslo.kommune.no/etater-foretak-og-ombud/klimaetaten/' },
    { label: 'Alle tilskuddsordninger fra Oslo kommune', href: KLIMATILSKUDD },
    {
      label: 'Personvern og informasjonskapsler',
      href: 'https://www.oslo.kommune.no/personvern-og-informasjonskapsler/',
    },
  ],
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

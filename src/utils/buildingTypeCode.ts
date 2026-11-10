// src/utils/buildingTypeCode.ts
// -----------------------------------------------------------------------------
// Felles oppslag av 3-sifret bygningstypekode (SSB-standard for bygningstype).
//
// Matrikkelens `bygningstypeKodeId` er en INTERN ID (løpenummer i kodelisten),
// ikke den 3-sifrede koden: ID 13 = kode 142 (boligblokk), ID 111 = kode 721
// (sykehjem). Feltet må derfor aldri tolkes som kode direkte – bruk
// funksjonene i denne filen.
//
// Filen er ren (ingen Node-/nettverksavhengigheter) og brukes av både
// frontend og backend.
// -----------------------------------------------------------------------------

/**
 * Matrikkelens interne bygningstype-ID → 3-sifret bygningstypekode.
 *
 * Verifisert 2026-11-10 mot innsyn.matrikkel.no:
 * `BygningService.findAlleBygningstypeKoder` gir 128 ID-er (0–127), og
 * `StoreService.getObjects` med `BygningstypeKodeId` gir kodeverdien for hver.
 * ID 0 har tom kodeverdi og er utelatt. Kan verifiseres på nytt med
 * `scripts/verify-bygningstype-kodeliste.ts`.
 */
export const BUILDING_TYPE_ID_TO_CODE: Readonly<Record<number, number>> = {
  // 11x–13x: småhus
  1: 111, // Enebolig
  2: 112, // Enebolig m/hybel/sokkelleilighet
  3: 113, // Våningshus
  4: 121, // Tomannsbolig, vertikaldelt
  5: 122, // Tomannsbolig, horisontaldelt
  6: 123, // Våningshus, tomannsbolig/vertikaldelt
  7: 124, // Våningshus, tomannsbolig/horisontaldelt
  8: 131, // Rekkehus
  9: 133, // Kjede-/atriumhus
  10: 135, // Terrassehus
  11: 136, // Andre småhus m/3 boliger eller flere
  // 14x: store boligbygg
  12: 141, // Stort frittliggende boligbygg på 2 etg.
  13: 142, // Stort frittliggende boligbygg på 3 og 4 etg.
  14: 143, // Stort frittliggende boligbygg på 5 etg. eller mer
  15: 144, // Store sammenbygde boligbygg på 2 etg.
  16: 145, // Store sammenbygde boligbygg på 3 og 4 etg.
  17: 146, // Store sammenbygde boligbygg på 5 etg. eller mer
  // 15x: bofellesskap
  18: 151, // Bo- og servicesenter
  19: 152, // Studenthjem/studentboliger
  20: 159, // Annen bygning for bofellesskap
  // 16x–17x: fritidsbolig, koie/seterhus
  21: 161, // Fritidsbygg (hytter, sommerhus o.l.)
  22: 162, // Helårsbolig benyttet som fritidsbolig
  23: 163, // Våningshus benyttet som fritidsbolig
  24: 171, // Seterhus, sel, rorbu o.l.
  25: 172, // Skogs- og utmarkskoie, gamme
  // 18x–19x: garasje/uthus og annen boligbygning
  26: 181, // Garasje, uthus, anneks til bolig
  27: 182, // Garasje, uthus, anneks til fritidsbolig
  28: 183, // Naust, båthus, sjøbu
  29: 193, // Boligbrakker
  30: 199, // Annen boligbygning
  // 2xx: industri, lager, landbruk
  31: 211, // Fabrikkbygning
  32: 212, // Verkstedbygning
  33: 214, // Bygning for renseanlegg
  34: 216, // Bygning for vannforsyning
  35: 219, // Annen industribygning
  36: 221, // Kraftstasjon
  37: 223, // Transformatorstasjon
  38: 229, // Annen energiforsyningsbygning
  39: 231, // Lagerhall
  40: 232, // Kjøle- og fryselager
  41: 233, // Silobygning
  42: 239, // Annen lagerbygning
  43: 241, // Hus for dyr, landbrukslager, silo
  44: 243, // Veksthus
  45: 244, // Driftsbygning for fiske/fangst/oppdrett
  46: 245, // Naust/redskapshus for fiske
  47: 248, // Annen fiskeri- og fangstbygning
  48: 249, // Annen landbruksbygning
  // 3xx: kontor og forretning
  49: 311, // Kontor- og administrasjonsbygning, rådhus
  50: 312, // Bankbygning, posthus
  51: 313, // Mediabygning
  52: 319, // Annen kontorbygning
  53: 321, // Kjøpesenter, varehus
  54: 322, // Butikk/forretningsbygning
  55: 323, // Bensinstasjon
  56: 329, // Annen forretningsbygning
  57: 330, // Messe- og kongressbygning
  // 4xx: samferdsel og kommunikasjon
  58: 411, // Ekspedisjonsbygning, flyterminal, kontrolltårn
  59: 412, // Jernbane- og T-banestasjon
  60: 415, // Godsterminal
  61: 416, // Postterminal
  62: 419, // Annen ekspedisjons- og terminalbygning
  63: 429, // Telekommunikasjonsbygning
  64: 431, // Parkeringshus
  65: 439, // Annen garasje-/hangarbygning
  66: 441, // Trafikktilsynsbygning
  67: 449, // Annen veg- og trafikktilsynsbygning
  // 5xx: hotell og restaurant
  68: 511, // Hotellbygning
  69: 512, // Motellbygning
  70: 519, // Annen hotellbygning
  71: 521, // Hospits, pensjonat
  72: 522, // Vandre-/feriehjem
  73: 523, // Appartement
  74: 524, // Camping-/utleiehytte
  75: 529, // Annen bygning for overnatting
  76: 531, // Restaurantbygning, kafébygning
  77: 532, // Sentralkjøkken, kantinebygning
  78: 533, // Gatekjøkken, kioskbygning
  79: 539, // Annen restaurantbygning
  // 6xx: kultur og undervisning
  80: 611, // Lekepark
  81: 612, // Barnehage
  82: 613, // Barneskole
  83: 614, // Ungdomsskole
  84: 615, // Kombinert barne- og ungdomsskole
  85: 616, // Videregående skole
  86: 619, // Annen skolebygning
  87: 621, // Universitet/høgskole med auditorium, lesesal
  88: 623, // Laboratoriebygning
  89: 629, // Annen universitets-/høgskolebygning
  90: 641, // Museum, kunstgalleri
  91: 642, // Bibliotek, mediatek
  92: 643, // Zoologisk/botanisk hage (bygning)
  93: 649, // Annen museums-/bibliotekbygning
  94: 651, // Idrettshall
  95: 652, // Ishall
  96: 653, // Svømmehall
  97: 654, // Tribune og idrettsgarderobe
  98: 655, // Helsestudio
  99: 659, // Annen idrettsbygning
  100: 661, // Kino, teater, opera, konsertbygning
  101: 662, // Samfunnshus, grendehus
  102: 663, // Diskotek, ungdomsklubb
  103: 669, // Annet kulturhus
  104: 671, // Kirke, kapell
  105: 672, // Bedehus, menighetshus
  106: 673, // Krematorium, gravkapell, bårehus
  107: 674, // Synagoge, moské
  108: 675, // Kloster
  109: 679, // Annen bygning for religiøse aktiviteter
  // 7xx: helse
  110: 719, // Sykehus
  111: 721, // Sykehjem
  112: 722, // Bo- og behandlingssenter
  113: 723, // Rehabiliteringsinstitusjon, kurbad
  114: 729, // Annet sykehjem
  115: 731, // Klinikk, legekontor/-senter/-vakt, dyresykehus
  116: 732, // Helse-/sosialsenter, helsestasjon
  117: 739, // Annen primærhelsebygning
  // 8xx: fengsel og beredskap
  118: 819, // Fengselsbygning
  119: 821, // Politistasjon
  120: 822, // Brannstasjon, ambulansestasjon
  121: 823, // Fyrstasjon, losstasjon
  122: 824, // Stasjon for radarovervåking av fly-/skipstrafikk
  123: 825, // Tilfluktsrom/bunker
  124: 829, // Annen beredskapsbygning
  125: 830, // Monument
  126: 840, // Offentlig toalett
  // 999: ukjent
  127: 999,
};

/**
 * Kildene en 3-sifret bygningstypekode kan utledes fra. Dekker både
 * Matrikkel-bygg (`ByggInfo`), API-svaret fra adresseoppslaget og bygg i
 * borettslag-/sameie-aggregatet.
 */
export interface BuildingTypeSource {
  /** Oppslått 3-sifret kode, f.eks. "142". */
  bygningstypeKode?: string | number | null;
  /** Matrikkelens interne ID, f.eks. 13 – IKKE en 3-sifret kode. */
  bygningstypeKodeId?: number | null;
  /** CSV-data fra Oslo kommunes matrikkeluttrekk. */
  csvData?: { bygningstype3siffer?: string | null } | null;
}

/**
 * Tolker en verdi som 3-sifret bygningstypekode. Returnerer `undefined` for
 * alt som ikke er et heltall i området 100–999 (tom streng, null, intern ID).
 */
export function parseBuildingTypeCode(
  value: string | number | null | undefined
): number | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (!/^\d{3}$/.test(text)) return undefined;
  const code = Number(text);
  return code >= 100 ? code : undefined;
}

/** Slår opp 3-sifret kode for Matrikkelens interne bygningstype-ID. */
export function buildingTypeCodeFromId(
  bygningstypeKodeId: number | null | undefined
): number | undefined {
  if (bygningstypeKodeId === null || bygningstypeKodeId === undefined) {
    return undefined;
  }
  return BUILDING_TYPE_ID_TO_CODE[bygningstypeKodeId];
}

/**
 * Gir 3-sifret bygningstypekode for et bygg. Rekkefølge:
 * 1. oppslått `bygningstypeKode`
 * 2. `csvData.bygningstype3siffer`
 * 3. verifisert ID-tabell (`bygningstypeKodeId`)
 *
 * Returnerer `undefined` når ingen av kildene gir en gyldig kode.
 */
export function resolveBuildingTypeCode(
  source: BuildingTypeSource | null | undefined
): number | undefined {
  if (!source) return undefined;
  return (
    parseBuildingTypeCode(source.bygningstypeKode) ??
    parseBuildingTypeCode(source.csvData?.bygningstype3siffer) ??
    buildingTypeCodeFromId(source.bygningstypeKodeId)
  );
}

/** Som {@link resolveBuildingTypeCode}, men som streng (f.eks. "142"). */
export function resolveBuildingTypeCodeString(
  source: BuildingTypeSource | null | undefined
): string | undefined {
  const code = resolveBuildingTypeCode(source);
  return code === undefined ? undefined : String(code);
}

/** Bolig i tjenestens forstand: kode 110–179 (enebolig … koie/seterhus). */
export function isResidentialCode(code: number | undefined): boolean {
  return code !== undefined && code >= 110 && code <= 179;
}

/**
 * Garasje, uthus, anneks og annen boligbygning (kode 180–199). Disse hører
 * til en bolig, i motsetning til næringsbygg (kode 200 og oppover).
 */
export function isGarageOrOutbuildingCode(code: number | undefined): boolean {
  return code !== undefined && code >= 180 && code <= 199;
}

/**
 * Sant når vi VET at bygget ikke er en bolig (kode finnes og ligger utenfor
 * 110–179). Ukjent kode gir `false`, slik at oppslag uten typeinformasjon
 * behandles som før.
 */
export function isKnownNonResidential(
  source: BuildingTypeSource | null | undefined
): boolean {
  const code = resolveBuildingTypeCode(source);
  return code !== undefined && !isResidentialCode(code);
}

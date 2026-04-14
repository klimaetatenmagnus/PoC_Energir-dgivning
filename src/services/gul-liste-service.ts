/**
 * Gul Liste Service
 * 
 * Sjekker om en eiendom er på Oslo kommunes Gul liste (bevaringsverdige bygninger)
 * ved å:
 * 1. Ta imot en adresse
 * 2. Hente GNR/BNR fra eksisterende matrikkel-tjenester
 * 3. Finne teigid via Oslo kommunes WFS_SOK API
 * 4. Sjekke om teigid er på Gul liste
 */

import axios from 'axios';
import proj4 from 'proj4';
import { getAppConfig } from '../runtimeConfig.ts';
import { createLogger } from '../utils/logger';

// EPSG:32632 (UTM zone 32N) brukes av PBE sine WFS-polygoner.
// EPSG:4258 (ETRS89 lat/lon) er det Geonorge returnerer som representasjonspunkt.
proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:4258', '+proj=longlat +ellps=GRS80 +no_defs');
proj4.defs('EPSG:25833', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs');

const logger = createLogger({ prefix: 'gul-liste-service' });

const runtimeEnv = typeof process !== 'undefined' && process.env ? process.env : {};

const PBE_WFS_URL =
  runtimeEnv.GUL_LISTE_WFS_URL ?? 'https://od2.pbe.oslo.kommune.no/cgi-bin/wms';
const PBE_WFS_SEARCH_MAP = runtimeEnv.GUL_LISTE_WFS_SEARCH_MAP ?? 'WFS_SOK';
const PBE_WFS_TABLE_MAP = runtimeEnv.GUL_LISTE_TABLE_MAP ?? 'EIENDOM_TABELL';
const PBE_GUL_LISTE_TABLE = runtimeEnv.GUL_LISTE_TABLE ?? 'kart.gulliste_spatial';

const defaultGeonorgeBase = (runtimeEnv.GEONORGE_API_BASE ?? 'https://ws.geonorge.no/adresser/v1').replace(/\/$/, '');
const GEONORGE_USER_AGENT = runtimeEnv.GEONORGE_API_USER_AGENT ?? 'Energitiltak/1.0';
const GEONORGE_DEFAULT_MUNICIPALITY = runtimeEnv.GEONORGE_DEFAULT_MUNICIPALITY ?? '0301';

interface GulListeResult {
  erPaaGulListe: boolean;
  teigid?: string;
  gnr?: number;
  bnr?: number;
  navn?: string;
  kategori?: string;
  vernestatus?: string;
  adresse?: string;
  error?: string;
}

interface MatrikkelData {
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  adressekode?: number;
  husnummer?: number;
  bokstav?: string;
  representasjonspunkt?: GulListePoint;
}

/**
 * Henter teigid fra GNR/BNR via Oslo kommunes WFS_SOK API
 */
async function finnTeigidFraGnrBnr(gnr: number, bnr: number): Promise<string | null> {
  try {
    const url = PBE_WFS_URL;
    const params = {
      map: PBE_WFS_SEARCH_MAP,
      VERSION: '1.1.0',
      SERVICE: 'WFS',
      REQUEST: 'GetFeature',
      TYPENAME: 'EIENDOM_WFS',
      Filter: `<Filter><And>` +
        `<PropertyIsEqualTo><PropertyName>GARDSNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>` +
        `<PropertyIsEqualTo><PropertyName>BRUKSNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>` +
        `</And></Filter>`
    };

    const response = await axios.get(url, { params });
    const xml = response.data;

    // Parse teigid fra XML-responsen
    const teigidMatch = xml.match(/<ms:ID>(\d+)<\/ms:ID>/i);
    if (teigidMatch) {
      return teigidMatch[1];
    }

    // Sjekk om det er flere treff
    const multipleMatches: RegExpMatchArray[] = Array.from(
      xml.matchAll(/<ms:ID>(\d+)<\/ms:ID>/gi)
    );
    const ids = multipleMatches
      .map((match) => match[1])
      .filter((id): id is string => Boolean(id));
    if (ids.length > 1) {
      logger.warn(`Flere teigid funnet for GNR ${gnr}, BNR ${bnr}:`, ids);
      return ids[0]; // Returner første match
    }

    return null;
  } catch (error) {
    logger.error('Feil ved henting av teigid:', error);
    return null;
  }
}

/**
 * MAPPING-verdier fra PBE som indikerer at bygningen faktisk er på gul liste
 * (dvs. listeført eller regulert til bevaring). Arkeologiske funn og andre
 * kulturminneregistreringer som tilfeldigvis overlapper eiendommen filtreres bort.
 */
const GUL_LISTE_MAPPING_VERDIER = [
  'Listeført kulturminne',
  'Regulert til bevaring',
];

/**
 * KATEGORI-verdier som ekskluderes fra gul liste-sjekken fordi de gjelder
 * utomhuselementer (gjerder, hager, murer o.l.) og ikke selve bygningen.
 * Eksempel: Furulundsveien 2 har et vernet utomhuselement på eiendommen,
 * men selve bygningen er ikke på gul liste.
 */
const EKSKLUDERTE_KATEGORIER = [
  'Enkeltminne utomhus',
];

interface FeatureMemberData {
  navn?: string;
  kategori?: string;
  vern?: string;
  type?: string;
  mapping?: string;
  /** Polygon-ringer i EPSG:32632 ([x, y]-par). Første ring er ytre, øvrige er hull. */
  polygonRings?: Array<Array<[number, number]>>;
}

/**
 * Parser en posList (romadskilte koordinater) til et [x, y]-array.
 */
function parsePosList(posList: string): Array<[number, number]> {
  const nums = posList.trim().split(/\s+/).map(Number);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (Number.isFinite(nums[i]) && Number.isFinite(nums[i + 1])) {
      pairs.push([nums[i], nums[i + 1]]);
    }
  }
  return pairs;
}

/**
 * Parser alle posList-elementer i et XML-block til polygon-ringer.
 * Støtter både enkle polygoner og MultiPolygon. Første ring er ytre-grense.
 */
function parsePolygonRings(memberXml: string): Array<Array<[number, number]>> {
  const rings: Array<Array<[number, number]>> = [];
  const posListRegex = /<gml:posList[^>]*>([^<]+)<\/gml:posList>/g;
  let match: RegExpExecArray | null;
  while ((match = posListRegex.exec(memberXml)) !== null) {
    const ring = parsePosList(match[1]);
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/**
 * Parser alle featureMembers fra WFS XML-respons
 */
function parseFeatureMembers(xml: string): FeatureMemberData[] {
  const members: FeatureMemberData[] = [];
  const memberBlocks = xml.split('<gml:featureMember>').slice(1);

  for (const block of memberBlocks) {
    const endIdx = block.indexOf('</gml:featureMember>');
    const memberXml = endIdx >= 0 ? block.substring(0, endIdx) : block;

    members.push({
      navn: memberXml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/)?.[1],
      kategori: memberXml.match(/<ms:KATEGORI>(.*?)<\/ms:KATEGORI>/)?.[1],
      vern: memberXml.match(/<ms:VERN>(.*?)<\/ms:VERN>/)?.[1],
      type: memberXml.match(/<ms:TYPE>(.*?)<\/ms:TYPE>/)?.[1],
      mapping: memberXml.match(/<ms:MAPPING>(.*?)<\/ms:MAPPING>/)?.[1],
      polygonRings: parsePolygonRings(memberXml),
    });
  }

  return members;
}

/**
 * Ray-casting point-in-polygon. Ringen er [x, y]-par i samme CRS som punktet.
 * Fungerer for konvekse og konkave polygoner.
 */
function pointInRing(px: number, py: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Sjekker om punktet ligger innenfor minst én av polygonets ringer.
 * (Vi tolker hver ring som et gyldig ytre-grense-polygon; dette stemmer for
 * enkelt-ring-polygoner som PBE returnerer.)
 */
function pointInPolygonRings(
  point: [number, number],
  rings: Array<Array<[number, number]>>
): boolean {
  return rings.some((ring) => pointInRing(point[0], point[1], ring));
}

export interface GulListePoint {
  /** Punkt i EPSG:32632 (UTM zone 32N) — eller oppgi epsg for auto-konvertering. */
  x: number;
  y: number;
  epsg?: string;
}

/**
 * Konverterer et koordinat til EPSG:32632 hvis det ikke allerede er der.
 */
function toUtm32(point: GulListePoint): [number, number] | null {
  const sourceEpsg = point.epsg ?? 'EPSG:32632';
  if (sourceEpsg === 'EPSG:32632') {
    return [point.x, point.y];
  }
  try {
    const [x, y] = proj4(sourceEpsg, 'EPSG:32632', [point.x, point.y]);
    return [x, y];
  } catch (err) {
    logger.warn(`Kunne ikke konvertere koordinat fra ${sourceEpsg} til EPSG:32632:`, err);
    return null;
  }
}

/**
 * Sjekker om et teigid er på Gul liste.
 *
 * Hvis `point` oppgis (bygningens representasjonspunkt), gjør vi i tillegg
 * point-in-polygon mot de gul-liste-relevante polygonene. Dette skiller
 * mellom ulike bygg på samme eiendom: én eiendom kan inneholde både vernede
 * bygg (f.eks. hovedbygning) og ikke-vernede bygg (f.eks. tilbygg/naboer
 * med samme gnr/bnr). Uten punkt-sjekken får vi falske positiver der hele
 * eiendommen markeres gul liste selv om bare ett bygg er vernet.
 */
async function sjekkGulListeForTeigid(
  teigid: string,
  point?: GulListePoint
): Promise<GulListeResult> {
  try {
    const url = PBE_WFS_URL;
    const params = {
      map: PBE_WFS_TABLE_MAP,
      tabell: PBE_GUL_LISTE_TABLE,
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      typeName: 'eiendom_polygon,eiendom_linje',
      teigid: teigid
    };

    const response = await axios.get(url, { params });
    const xml = response.data as string;

    // Parser alle featureMembers og filtrerer til kun gul liste-relevante oppføringer.
    // PBE sin tabell kart.gulliste_spatial returnerer ALLE kulturminneregistreringer
    // som overlapper eiendommen, inkl. arkeologiske funn og utomhuselementer.
    // Vi bruker MAPPING-feltet for å beholde kun gul liste-oppføringer, og
    // KATEGORI-feltet for å ekskludere utomhuselementer (gjerder, hager etc.)
    // som ikke gjelder selve bygningen.
    const allMembers = parseFeatureMembers(xml);
    let gulListeMembers = allMembers.filter(
      (m) =>
        m.mapping &&
        GUL_LISTE_MAPPING_VERDIER.includes(m.mapping) &&
        !(m.kategori && EKSKLUDERTE_KATEGORIER.includes(m.kategori))
    );

    // Point-in-polygon: filtrer til kun oppføringer som faktisk dekker bygningens
    // representasjonspunkt. Forhindrer falske positiver på eiendommer med flere
    // bygg der bare noen er vernet (f.eks. Malerhaugveien 2A/2J vernet, 2V ikke).
    if (point && gulListeMembers.length > 0) {
      const utm = toUtm32(point);
      if (utm) {
        const containingMembers = gulListeMembers.filter(
          (m) => m.polygonRings && m.polygonRings.length > 0 && pointInPolygonRings(utm, m.polygonRings)
        );
        if (containingMembers.length !== gulListeMembers.length) {
          logger.info(
            `Teigid ${teigid}: ${gulListeMembers.length} gul-liste-oppføring(er) totalt, ` +
              `${containingMembers.length} inneholder bygningens representasjonspunkt ` +
              `(${utm[0].toFixed(1)}, ${utm[1].toFixed(1)})`
          );
        }
        gulListeMembers = containingMembers;
      }
    }

    if (gulListeMembers.length > 0) {
      // Foretrekk Enkeltminne-oppføringer fremfor Lokalitet-duplikater
      const best =
        gulListeMembers.find((m) => m.type === 'Enkeltminne') ??
        gulListeMembers[0];

      if (allMembers.length > gulListeMembers.length) {
        logger.info(
          `Filtrerte bort ${allMembers.length - gulListeMembers.length} ikke-gul-liste-oppføringer for teigid ${teigid}`
        );
      }

      return {
        erPaaGulListe: true,
        teigid: teigid,
        navn: best.navn,
        kategori: best.kategori ?? best.type,
        vernestatus: best.vern
      };
    }

    if (allMembers.length > 0) {
      logger.info(
        `Teigid ${teigid} har ${allMembers.length} kulturminneregistrering(er), men ingen er gul liste for denne bygningen (MAPPING: ${allMembers.map((m) => m.mapping ?? 'mangler').join(', ')})`
      );
    }

    return {
      erPaaGulListe: false,
      teigid: teigid
    };
  } catch (error) {
    logger.error('Feil ved sjekk av Gul liste:', error);
    return {
      erPaaGulListe: false,
      error: 'Kunne ikke sjekke Gul liste-status'
    };
  }
}

/**
 * Henter GNR/BNR fra adresse via Geonorge API
 */
async function hentMatrikkelDataFraAdresse(adresse: string): Promise<MatrikkelData | null> {
  try {
    const config = getAppConfig();
    const geonorgeBase =
      (config.raw?.geonorgeApiBase as string | undefined) ?? defaultGeonorgeBase;
    const url = `${geonorgeBase}/sok`;
    const params = {
      sok: adresse,
      kommunenummer: GEONORGE_DEFAULT_MUNICIPALITY,
      fuzzy: 'true',
      treffPerSide: '1'
    };

    const response = await axios.get(url, {
      params,
      headers: { 'User-Agent': GEONORGE_USER_AGENT },
    });
    
    if (response.data.adresser && response.data.adresser.length > 0) {
      const adresseData = response.data.adresser[0];

      // Hent representasjonspunkt (Geonorge bruker EPSG:4258 lat/lon)
      const repPoint: GulListePoint | undefined = adresseData.representasjonspunkt
        ? {
            x: adresseData.representasjonspunkt.lon,
            y: adresseData.representasjonspunkt.lat,
            epsg: adresseData.representasjonspunkt.epsg ?? 'EPSG:4258',
          }
        : undefined;

      // Noen adresser returnerer matrikkelinfo direkte
      if (adresseData.gardsnummer && adresseData.bruksnummer) {
        return {
          kommunenummer: adresseData.kommunenummer,
          gardsnummer: adresseData.gardsnummer,
          bruksnummer: adresseData.bruksnummer,
          adressekode: adresseData.adressekode,
          husnummer: adresseData.husnummer,
          bokstav: adresseData.bokstav,
          representasjonspunkt: repPoint,
        };
      }
      
      // Hvis ikke, prøv å hente detaljer via adressekode
      if (adresseData.adressekode) {
        const detaljerUrl = `${geonorgeBase}/adresser/${adresseData.adressekode}`;
        const detaljerResponse = await axios.get(detaljerUrl, {
          headers: { 'User-Agent': GEONORGE_USER_AGENT },
        });
        
        if (detaljerResponse.data.matrikkelenhet) {
          return {
            kommunenummer: detaljerResponse.data.kommunenummer,
            gardsnummer: detaljerResponse.data.matrikkelenhet.gardsnummer,
            bruksnummer: detaljerResponse.data.matrikkelenhet.bruksnummer,
            adressekode: detaljerResponse.data.adressekode,
            husnummer: detaljerResponse.data.husnummer,
            bokstav: detaljerResponse.data.bokstav
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Feil ved henting av matrikkeldata:', error);
    return null;
  }
}

/**
 * Hovedfunksjon: Sjekker om en adresse er på Gul liste
 * 
 * @param adresse - Adressen som skal sjekkes (f.eks. "Thereses gate 3, Oslo")
 * @returns GulListeResult med status og detaljer
 */
export async function sjekkGulListe(adresse: string, point?: GulListePoint): Promise<GulListeResult> {
  try {
    // Steg 1: Hent GNR/BNR fra adresse (og hent samtidig representasjonspunkt hvis ikke oppgitt)
    logger.info(`Sjekker Gul liste for ${adresse}`);

    const matrikkelData = await hentMatrikkelDataFraAdresse(adresse);

    if (!matrikkelData) {
      return {
        erPaaGulListe: false,
        error: 'Kunne ikke finne matrikkeldata for adressen',
        adresse: adresse
      };
    }

    logger.info(
      `Fant GNR ${matrikkelData.gardsnummer}, BNR ${matrikkelData.bruksnummer}`
    );

    // Bruk punkt fra Geonorge-oppslag hvis ikke oppgitt eksplisitt
    const effectivePoint = point ?? matrikkelData.representasjonspunkt;

    // Steg 2: Finn teigid fra GNR/BNR
    const teigid = await finnTeigidFraGnrBnr(
      matrikkelData.gardsnummer,
      matrikkelData.bruksnummer
    );

    if (!teigid) {
      return {
        erPaaGulListe: false,
        gnr: matrikkelData.gardsnummer,
        bnr: matrikkelData.bruksnummer,
        error: 'Kunne ikke finne teigid for eiendommen',
        adresse: adresse
      };
    }

    logger.info(`Fant teigid ${teigid}`);

    // Steg 3: Sjekk om teigid er på Gul liste, med point-in-polygon hvis punkt tilgjengelig
    const gulListeResultat = await sjekkGulListeForTeigid(teigid, effectivePoint);

    return {
      ...gulListeResultat,
      gnr: matrikkelData.gardsnummer,
      bnr: matrikkelData.bruksnummer,
      adresse: adresse
    };

  } catch (error) {
    logger.error('Feil i Gul liste-sjekk:', error);
    return {
      erPaaGulListe: false,
      error: 'En uventet feil oppstod',
      adresse: adresse
    };
  }
}

/**
 * Sjekker gul liste direkte med GNR/BNR (hvis du allerede har disse)
 */
export async function sjekkGulListeMedGnrBnr(
  gnr: number,
  bnr: number,
  point?: GulListePoint
): Promise<GulListeResult> {
  try {
    // Finn teigid
    const teigid = await finnTeigidFraGnrBnr(gnr, bnr);

    if (!teigid) {
      return {
        erPaaGulListe: false,
        gnr: gnr,
        bnr: bnr,
        error: 'Kunne ikke finne teigid for eiendommen'
      };
    }

    // Sjekk Gul liste (point-in-polygon hvis punkt oppgitt)
    const gulListeResultat = await sjekkGulListeForTeigid(teigid, point);

    return {
      ...gulListeResultat,
      gnr: gnr,
      bnr: bnr
    };

  } catch (error) {
    logger.error('Feil i Gul liste-sjekk:', error);
    return {
      erPaaGulListe: false,
      gnr: gnr,
      bnr: bnr,
      error: 'En uventet feil oppstod'
    };
  }
}

// Eksporter også hjelpefunksjonene hvis de trengs andre steder
export {
  finnTeigidFraGnrBnr,
  sjekkGulListeForTeigid,
  hentMatrikkelDataFraAdresse
};

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
import { getAppConfig } from '../runtimeConfig.ts';
import { createLogger } from '../utils/logger';

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
 * Sjekker om et teigid er på Gul liste
 */
async function sjekkGulListeForTeigid(teigid: string): Promise<GulListeResult> {
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
    const xml = response.data;

    // Sjekk om eiendommen er på Gul liste
    if (xml.includes('<gml:featureMember>')) {
      // Parse detaljer fra XML
      const navnMatch = xml.match(/<ms:NAVN>(.*?)<\/ms:NAVN>/);
      const kategoriMatch = xml.match(/<ms:KATEGORI>(.*?)<\/ms:KATEGORI>/);
      const vernMatch = xml.match(/<ms:VERN>(.*?)<\/ms:VERN>/);
      const typeMatch = xml.match(/<ms:TYPE>(.*?)<\/ms:TYPE>/);

      return {
        erPaaGulListe: true,
        teigid: teigid,
        navn: navnMatch ? navnMatch[1] : undefined,
        kategori: kategoriMatch ? kategoriMatch[1] : typeMatch ? typeMatch[1] : undefined,
        vernestatus: vernMatch ? vernMatch[1] : undefined
      };
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
      
      // Noen adresser returnerer matrikkelinfo direkte
      if (adresseData.gardsnummer && adresseData.bruksnummer) {
        return {
          kommunenummer: adresseData.kommunenummer,
          gardsnummer: adresseData.gardsnummer,
          bruksnummer: adresseData.bruksnummer,
          adressekode: adresseData.adressekode,
          husnummer: adresseData.husnummer,
          bokstav: adresseData.bokstav
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
export async function sjekkGulListe(adresse: string): Promise<GulListeResult> {
  try {
    // Steg 1: Hent GNR/BNR fra adresse
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
    
    // Steg 3: Sjekk om teigid er på Gul liste
    const gulListeResultat = await sjekkGulListeForTeigid(teigid);
    
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
export async function sjekkGulListeMedGnrBnr(gnr: number, bnr: number): Promise<GulListeResult> {
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
    
    // Sjekk Gul liste
    const gulListeResultat = await sjekkGulListeForTeigid(teigid);
    
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

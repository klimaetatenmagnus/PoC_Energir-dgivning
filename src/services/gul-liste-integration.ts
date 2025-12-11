/**
 * Integrasjon av Gul Liste med eksisterende Building Info Service
 * 
 * Denne filen viser hvordan gul liste-sjekk kan integreres
 * med deres eksisterende system
 */

import { sjekkGulListeMedGnrBnr } from './gul-liste-service';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'gul-liste-integration' });

/**
 * Utvider BuildingInfo interface med gul liste-status
 */
export interface BuildingInfoMedGulListe {
  // Eksisterende felter (eksempler)
  address?: string;
  gnr?: number;
  bnr?: number;
  bygningsnummer?: string;
  bruksareal?: number;
  byggeaar?: number;
  
  // Nye felter for gul liste
  gulListeStatus?: {
    erPaaGulListe: boolean;
    teigid?: string;
    navn?: string;
    kategori?: string;
    vernestatus?: string;
  };
}

/**
 * Wrapper-funksjon som legger til gul liste-sjekk
 * til eksisterende building info lookup
 * 
 * Denne kan kalles etter at GNR/BNR er hentet fra matrikkel
 */
export async function berikBuildingInfoMedGulListe<T extends object>(
  buildingInfo: T,
  gnr: number,
  bnr: number
): Promise<T & BuildingInfoMedGulListe> {
  try {
    // Sjekk gul liste-status
    const gulListeResult = await sjekkGulListeMedGnrBnr(gnr, bnr);
    
    // Legg til gul liste-informasjon til building info
    return {
      ...buildingInfo,
      gulListeStatus: {
        erPaaGulListe: gulListeResult.erPaaGulListe,
        teigid: gulListeResult.teigid,
        navn: gulListeResult.navn,
        kategori: gulListeResult.kategori,
        vernestatus: gulListeResult.vernestatus
      }
    } as T & BuildingInfoMedGulListe;
  } catch (error) {
    logger.error('Feil ved berikelse med gul liste-data:', error);

    // Returner building info uten gul liste-data hvis det feiler
    return {
      ...buildingInfo,
      gulListeStatus: undefined
    } as T & BuildingInfoMedGulListe;
  }
}

/**
 * Eksempel på hvordan dette kan integreres i 
 * services/building-info-service/index.ts
 * 
 * I resolveBuildingData funksjonen, etter at GNR/BNR er hentet:
 * 
 * ```typescript
 * // Eksisterende kode som henter GNR/BNR
 * const gnr = addressInfo.gardsnummer;
 * const bnr = addressInfo.bruksnummer;
 * 
 * // Hent building info som før
 * const buildingInfo = await getBuildingInfo(...);
 * 
 * // NYTT: Berik med gul liste-status
 * const beriketBuildingInfo = await berikBuildingInfoMedGulListe(
 *   buildingInfo,
 *   gnr,
 *   bnr
 * );
 * 
 * return beriketBuildingInfo;
 * ```
 */

/**
 * Alternativ: Direkte integrasjon i API-endepunkt
 * 
 * I api-server.ts, endre /api/address-lookup endpoint:
 */
export const eksempelIntegrasjon = `
// I api-server.ts

app.post('/api/address-lookup', async (req, res) => {
  try {
    const { address } = req.body;
    
    // Eksisterende kode for å hente building info
    const buildingData = await resolveBuildingData(address);
    
    // NYTT: Hent også gul liste-status
    if (buildingData.gnr && buildingData.bnr) {
      const gulListeResult = await sjekkGulListeMedGnrBnr(
        buildingData.gnr,
        buildingData.bnr
      );
      
      buildingData.gulListeStatus = gulListeResult;
    }
    
    res.json(buildingData);
  } catch (error) {
    console.error('Error in address lookup:', error);
    res.status(500).json({ error: 'Failed to lookup address' });
  }
});
`;

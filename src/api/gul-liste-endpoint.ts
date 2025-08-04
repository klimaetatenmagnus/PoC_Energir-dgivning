/**
 * API Endpoint for Gul Liste sjekk
 * 
 * Legges til i api-server.ts
 */

import { Request, Response } from 'express';
import { sjekkGulListe, sjekkGulListeMedGnrBnr } from '../services/gul-liste-service';

/**
 * Endpoint: /api/gul-liste/sjekk-adresse
 * 
 * Body: { adresse: string }
 */
export async function sjekkGulListeForAdresse(req: Request, res: Response) {
  try {
    const { adresse } = req.body;
    
    if (!adresse) {
      return res.status(400).json({
        error: 'Adresse må oppgis'
      });
    }
    
    const resultat = await sjekkGulListe(adresse);
    
    return res.json(resultat);
  } catch (error) {
    console.error('Feil i gul liste endpoint:', error);
    return res.status(500).json({
      error: 'Feil ved sjekk av gul liste',
      erPaaGulListe: false
    });
  }
}

/**
 * Endpoint: /api/gul-liste/sjekk-gnr-bnr
 * 
 * Body: { gnr: number, bnr: number }
 */
export async function sjekkGulListeForGnrBnr(req: Request, res: Response) {
  try {
    const { gnr, bnr } = req.body;
    
    if (!gnr || !bnr) {
      return res.status(400).json({
        error: 'GNR og BNR må oppgis'
      });
    }
    
    const resultat = await sjekkGulListeMedGnrBnr(
      parseInt(gnr),
      parseInt(bnr)
    );
    
    return res.json(resultat);
  } catch (error) {
    console.error('Feil i gul liste endpoint:', error);
    return res.status(500).json({
      error: 'Feil ved sjekk av gul liste',
      erPaaGulListe: false
    });
  }
}

/**
 * Legg til disse linjene i api-server.ts:
 * 
 * import { sjekkGulListeForAdresse, sjekkGulListeForGnrBnr } from './api/gul-liste-endpoint';
 * 
 * // I app setup:
 * app.post('/api/gul-liste/sjekk-adresse', sjekkGulListeForAdresse);
 * app.post('/api/gul-liste/sjekk-gnr-bnr', sjekkGulListeForGnrBnr);
 */
import { resolveApiUrl } from '../runtimeConfig.ts';

export interface Stotteordning {
  ordning: string;
  lenke: string | null;
  belop: string | null;
  overskrift: string | null;
}

export class StotteordningService {
  private static instance: StotteordningService;
  
  public static getInstance(): StotteordningService {
    if (!StotteordningService.instance) {
      StotteordningService.instance = new StotteordningService();
    }
    return StotteordningService.instance;
  }
  
  /**
   * Henter støtteordninger direkte fra Excel via API
   */
  public async getStotteordninger(
    gulliste: boolean,
    tiltak: string,
    bygningstype: string
  ): Promise<Stotteordning[]> {
    try {
      const params = new URLSearchParams({
        gulliste: String(gulliste),
        tiltak,
        bygningstype,
      });

      const response = await fetch(
        `${resolveApiUrl('stotteordninger-live')}?${params.toString()}`
      );
      
      if (!response.ok) {
        console.error('Feil ved henting av støtteordninger:', response.status);
        return [];
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Feil ved henting av støtteordninger:', error);
      return [];
    }
  }
  
  /**
   * Henter sist oppdatert tidspunkt
   */
  public getSistOppdatert(): string {
    return new Date().toISOString();
  }
  
  /**
   * Mapper bygningstype fra API til støtteordning-format
   */
  public mapBygningstype(apiType: string): string {
    const mapping: { [key: string]: string } = {
      'Enebolig': 'enebolig',
      'Rekkehus': 'rekkehus',
      'Blokk': 'blokk',
      'Store boligbygg': 'blokk',
      'Tomannsbolig': 'enebolig',
      'Våningshus': 'enebolig'
    };
    
    return mapping[apiType] || 'enebolig';
  }
  
  /**
   * Mapper tiltak-navn til støtteordning-format
   */
  public mapTiltak(tiltakNavn: string): string {
    const mapping: { [key: string]: string } = {
      'Tetting': 'tetting',
      'Solenergi': 'solenergi',
      'Etterisolering av fasade': 'etterisolering_fasade',
      'Isolering av kjeller og loft': 'etterisolering_kjeller_loft',
      'Varmepumpe': 'varmepumpe',
      'Ventilasjon': 'ventilasjon',
      'Utskiftning av vindu': 'vinduer',
      'Smart energistyring': 'smart_energistyring',
      'Annen oppvarming': 'annen_oppvarming'
    };
    
    return mapping[tiltakNavn] || tiltakNavn.toLowerCase();
  }
  
  /**
   * Henter alle tilgjengelige tiltak
   */
  public getTilgjengeligeTiltak(): string[] {
    return [
      'tetting',
      'solenergi',
      'etterisolering_fasade',
      'etterisolering_kjeller_loft',
      'varmepumpe',
      'ventilasjon',
      'vinduer',
      'smart_energistyring',
      'annen_oppvarming'
    ];
  }
}

export default StotteordningService.getInstance();

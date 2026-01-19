export interface EnergyEstimatorBuildingData {
  bruksarealM2?: number;
  bygningstypeKode?: string;
  bygningstype?: string;
  byggeaar?: number;
  energiattest?: {
    energikarakter?: string;
    oppvarmingskarakter?: string;
    utstedelsesdato?: string;
    attestnummer?: string;
    attestUrl?: string;
    registering?: {
      beregnetLevertEnergiTotaltkWh?: number;
      beregnetLevertEnergiTotaltkWhm2?: number;
    };
  };
  filteredSolarEnergy?: number;
}

// TEK-perioder inkludert nyere standarder
export type TEKPeriod = 'Eldre' | 'TEK49' | 'TEK69' | 'TEK87' | 'TEK97' | 'TEK07' | 'TEK17' | 'TEK10';

// Energitype-spesifikke rates for romoppvarming, tappevann og elspesifikt
export interface EnergyTypeRates {
  romoppvarming: number;  // Prosent gjenstående (f.eks. 0.85 = 85%)
  tappevann: number;
  elspesifikt: number;
}

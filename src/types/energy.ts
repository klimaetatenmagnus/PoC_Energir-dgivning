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

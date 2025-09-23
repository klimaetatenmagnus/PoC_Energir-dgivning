import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { EnergyEstimatorBuildingData } from '../types/energy';

type SimulationMeasure =
  | 'vindu'
  | 'etterisolering'
  | 'etterisolering-tak'
  | 'varmepumpe'
  | 'solcellepanel';

type BuildingCategory = 'småhus' | 'blokk';
type TekLabel = 'TEK7' | 'TEK97' | 'TEK87' | 'TEK69' | 'TEK49' | 'eldre';
type TekKey = 'eldre' | 49 | 69 | 87 | 97 | 7;

type CategorySavings = {
  '0.75': number;
  '1.2': number;
  etteriso_yttervegg: number;
  etteriso_takloft: number;
};

type SavingsMatrix = Record<TekKey, Record<BuildingCategory, CategorySavings>>;

interface SavingsResult {
  percentage: number;
  kWh: number;
}

interface UseEnergyEstimatorResult {
  yearlyConsumption: string;
  handleConsumptionChange: (value: string) => void;
  estimatedRating: string | null;
  energyIntensity: number | null;
  showSimulation: SimulationMeasure | null;
  openSimulation: (measure: SimulationMeasure) => void;
  closeSimulation: () => void;
  selectedMeasures: Set<SimulationMeasure>;
  toggleMeasure: (measure: SimulationMeasure) => void;
  totalSavings: number;
  newRating: string | null;
  getSavings: (measure: SimulationMeasure | null) => SavingsResult | null;
  getBaselineValue: (measure: SimulationMeasure) => number | null;
  tekLabel: TekLabel | null;
  buildingCategory: BuildingCategory | null;
  hasEnovaAttest: boolean;
}

const ENERGY_SAVINGS_DATA: SavingsMatrix = {
  eldre: {
    blokk: {
      '0.75': 38.9,
      '1.2': 32.1,
      etteriso_yttervegg: 81.7,
      etteriso_takloft: 24.4,
    },
    småhus: {
      '0.75': 42.2,
      '1.2': 34.3,
      etteriso_yttervegg: 94.1,
      etteriso_takloft: 41.2,
    },
  },
  49: {
    blokk: {
      '0.75': 38.9,
      '1.2': 32.1,
      etteriso_yttervegg: 81.7,
      etteriso_takloft: 24.4,
    },
    småhus: {
      '0.75': 42.2,
      '1.2': 34.3,
      etteriso_yttervegg: 94.1,
      etteriso_takloft: 41.2,
    },
  },
  69: {
    blokk: {
      '0.75': 38.3,
      '1.2': 31.3,
      etteriso_yttervegg: 39.7,
      etteriso_takloft: 8.4,
    },
    småhus: {
      '0.75': 41.7,
      '1.2': 33.7,
      etteriso_yttervegg: 27.7,
      etteriso_takloft: 11.4,
    },
  },
  87: {
    blokk: {
      '0.75': 28.1,
      '1.2': 21.0,
      etteriso_yttervegg: 9.7,
      etteriso_takloft: 2.8,
    },
    småhus: {
      '0.75': 31.4,
      '1.2': 23.4,
      etteriso_yttervegg: 15.0,
      etteriso_takloft: 4.7,
    },
  },
  97: {
    blokk: {
      '0.75': 12.1,
      '1.2': 5.0,
      etteriso_yttervegg: 7.3,
      etteriso_takloft: 0.4,
    },
    småhus: {
      '0.75': 14.2,
      '1.2': 6.1,
      etteriso_yttervegg: 3.7,
      etteriso_takloft: 0.6,
    },
  },
  7: {
    blokk: {
      '0.75': 7.2,
      '1.2': 0,
      etteriso_yttervegg: 1.3,
      etteriso_takloft: 0.4,
    },
    småhus: {
      '0.75': 8.2,
      '1.2': 0,
      etteriso_yttervegg: 0,
      etteriso_takloft: 0,
    },
  },
};

function calculateTekLabel(byggeaar: number): TekLabel {
  const threshold = 2;

  if (byggeaar >= 2007 + threshold) return 'TEK7';
  if (byggeaar >= 1997 + threshold) return 'TEK97';
  if (byggeaar >= 1987 + threshold) return 'TEK87';
  if (byggeaar >= 1969 + threshold) return 'TEK69';
  if (byggeaar >= 1949 + threshold) return 'TEK49';

  return 'eldre';
}

function toTekKey(label: TekLabel | null): TekKey {
  switch (label) {
    case 'TEK7':
      return 7;
    case 'TEK97':
      return 97;
    case 'TEK87':
      return 87;
    case 'TEK69':
      return 69;
    case 'TEK49':
      return 49;
    default:
      return 'eldre';
  }
}

function detectBuildingCategory(
  data: EnergyEstimatorBuildingData
): BuildingCategory | null {
  const code = data.bygningstypeKode?.substring(0, 2);
  if (code) {
    if (['11', '12', '13'].includes(code)) {
      return 'småhus';
    }
    if (['14', '15', '16', '17'].includes(code)) {
      return 'blokk';
    }
  }

  const typeString = data.bygningstype?.toLowerCase();
  if (typeString) {
    if (
      typeString.includes('enebolig') ||
      typeString.includes('tomannsbolig') ||
      typeString.includes('rekkehus') ||
      typeString.includes('kjedehus')
    ) {
      return 'småhus';
    }
    if (
      typeString.includes('blokk') ||
      typeString.includes('leilighet') ||
      typeString.includes('boligbygg')
    ) {
      return 'blokk';
    }
  }

  return null;
}

function determineRating(
  intensity: number,
  buildingCategory: BuildingCategory | null,
  bruksareal?: number
): string {
  if (!bruksareal || !Number.isFinite(intensity)) {
    return 'G';
  }

  const bra = bruksareal;

  if (buildingCategory === 'småhus') {
    if (intensity <= 95 + 800 / bra) return 'A';
    if (intensity <= 120 + 1600 / bra) return 'B';
    if (intensity <= 145 + 2500 / bra) return 'C';
    if (intensity <= 175 + 4100 / bra) return 'D';
    if (intensity <= 205 + 5800 / bra) return 'E';
    if (intensity <= 250 + 8000 / bra) return 'F';
    return 'G';
  }

  if (buildingCategory === 'blokk') {
    if (intensity <= 85 + 600 / bra) return 'A';
    if (intensity <= 95 + 1000 / bra) return 'B';
    if (intensity <= 100 + 1500 / bra) return 'C';
    if (intensity <= 135 + 2200 / bra) return 'D';
    if (intensity <= 160 + 3000 / bra) return 'E';
    if (intensity <= 200 + 4000 / bra) return 'F';
    return 'G';
  }

  if (intensity <= 90 + 700 / bra) return 'A';
  if (intensity <= 107.5 + 1300 / bra) return 'B';
  if (intensity <= 122.5 + 2000 / bra) return 'C';
  if (intensity <= 155 + 3150 / bra) return 'D';
  if (intensity <= 182.5 + 4400 / bra) return 'E';
  if (intensity <= 225 + 6000 / bra) return 'F';
  return 'G';
}

export function useEnergyRatingEstimator(
  buildingData: EnergyEstimatorBuildingData
): UseEnergyEstimatorResult {
  const [yearlyConsumption, setYearlyConsumption] = useState('');
  const [estimatedRating, setEstimatedRating] = useState<string | null>(null);
  const [energyIntensity, setEnergyIntensity] = useState<number | null>(null);
  const [showSimulation, setShowSimulation] = useState<SimulationMeasure | null>(null);
  const [selectedMeasures, setSelectedMeasures] = useState<Set<SimulationMeasure>>(
    () => new Set()
  );

  const buildingCategory = useMemo(
    () => detectBuildingCategory(buildingData),
    [buildingData]
  );

  const tekLabel = useMemo<TekLabel | null>(() => {
    if (!buildingData.byggeaar) {
      return null;
    }
    return calculateTekLabel(buildingData.byggeaar);
  }, [buildingData.byggeaar]);

  const tekKey = useMemo(() => toTekKey(tekLabel), [tekLabel]);

  const hasEnovaAttest = Boolean(buildingData.energiattest?.energikarakter);
  const enovaConsumption = buildingData.energiattest?.registering?.beregnetLevertEnergiTotaltkWh;

  const updateRatingForConsumption = useCallback(
    (consumption: number) => {
      if (!buildingData.bruksarealM2 || consumption <= 0) {
        setEstimatedRating(null);
        setEnergyIntensity(null);
        return;
      }

      const intensity = consumption / buildingData.bruksarealM2;
      setEnergyIntensity(intensity);
      setEstimatedRating(determineRating(intensity, buildingCategory, buildingData.bruksarealM2));
    },
    [buildingCategory, buildingData.bruksarealM2]
  );

  const handleConsumptionChange = useCallback(
    (value: string) => {
      const numeric = value.replace(/[^0-9]/g, '');
      setYearlyConsumption(numeric);

      if (!numeric) {
        setEstimatedRating(null);
        setEnergyIntensity(null);
        return;
      }

      const consumption = Number.parseFloat(numeric);
      if (!Number.isFinite(consumption)) {
        setEstimatedRating(null);
        setEnergyIntensity(null);
        return;
      }

      updateRatingForConsumption(consumption);
    },
    [updateRatingForConsumption]
  );

  useEffect(() => {
    if (hasEnovaAttest && enovaConsumption && !yearlyConsumption) {
      const rounded = Math.round(enovaConsumption);
      setYearlyConsumption(String(rounded));
      updateRatingForConsumption(rounded);
    }
  }, [
    enovaConsumption,
    hasEnovaAttest,
    updateRatingForConsumption,
    yearlyConsumption,
  ]);

  const toggleMeasure = useCallback((measure: SimulationMeasure) => {
    setSelectedMeasures((previous) => {
      const next = new Set(previous);
      if (next.has(measure)) {
        next.delete(measure);
      } else {
        next.add(measure);
      }
      return next;
    });
  }, []);

  const getSavings = useCallback(
    (measure: SimulationMeasure | null): SavingsResult | null => {
      if (!measure) {
        return null;
      }

      const consumption = Number.parseFloat(yearlyConsumption);
      if (!Number.isFinite(consumption) || !buildingData.bruksarealM2 || consumption <= 0) {
        return null;
      }

      if (measure === 'varmepumpe') {
        const kWhSaved = (consumption * 30) / 100;
        return { percentage: 30, kWh: Math.round(kWhSaved) };
      }

      if (measure === 'solcellepanel') {
        const solarEnergy = buildingData.filteredSolarEnergy ?? 0;
        if (solarEnergy <= 0) {
          return { percentage: 0, kWh: 0 };
        }
        const percentage = (solarEnergy / consumption) * 100;
        return {
          percentage: Math.round(percentage * 10) / 10,
          kWh: Math.round(solarEnergy),
        };
      }

      const category = buildingCategory;
      if (!category) {
        return null;
      }

      const data = ENERGY_SAVINGS_DATA[tekKey]?.[category];
      if (!data) {
        return null;
      }

      let savingsPerBRA = 0;
      if (measure === 'vindu') {
        savingsPerBRA = data['0.75'] ?? 0;
      } else if (measure === 'etterisolering') {
        savingsPerBRA = data.etteriso_yttervegg ?? 0;
      } else if (measure === 'etterisolering-tak') {
        savingsPerBRA = data.etteriso_takloft ?? 0;
      }

      const kWhSaved = savingsPerBRA * buildingData.bruksarealM2;
      if (kWhSaved <= 0) {
        return null;
      }

      const percentage = (kWhSaved / consumption) * 100;
      return {
        percentage: Math.round(percentage * 10) / 10,
        kWh: Math.round(kWhSaved),
      };
    },
    [
      buildingCategory,
      buildingData.bruksarealM2,
      buildingData.filteredSolarEnergy,
      tekKey,
      yearlyConsumption,
    ]
  );

  const getBaselineValue = useCallback(
    (measure: SimulationMeasure): number | null => {
      if (measure === 'varmepumpe') {
        return 30;
      }

      if (measure === 'solcellepanel') {
        const savings = getSavings('solcellepanel');
        return savings ? savings.percentage : null;
      }

      const category = buildingCategory;
      if (!category) {
        return null;
      }

      const data = ENERGY_SAVINGS_DATA[tekKey]?.[category];
      if (!data) {
        return null;
      }

      if (measure === 'vindu') {
        return data['0.75'] ?? null;
      }

      if (measure === 'etterisolering') {
        return data.etteriso_yttervegg ?? null;
      }

      if (measure === 'etterisolering-tak') {
        return data.etteriso_takloft ?? null;
      }

      return null;
    },
    [buildingCategory, getSavings, tekKey]
  );

  const totalSavings = useMemo(() => {
    let total = 0;
    selectedMeasures.forEach((measure) => {
      const savings = getSavings(measure);
      if (savings) {
        total += savings.kWh;
      }
    });
    return total;
  }, [getSavings, selectedMeasures]);

  const newRating = useMemo(() => {
    if (!yearlyConsumption || !buildingData.bruksarealM2) {
      return null;
    }

    const consumption = Number.parseFloat(yearlyConsumption);
    if (!Number.isFinite(consumption) || consumption <= 0) {
      return null;
    }

    const newConsumption = Math.max(0, consumption - totalSavings);
    const intensity = newConsumption / buildingData.bruksarealM2;
    return determineRating(intensity, buildingCategory, buildingData.bruksarealM2);
  }, [
    buildingCategory,
    buildingData.bruksarealM2,
    totalSavings,
    yearlyConsumption,
  ]);

  const openSimulation = useCallback((measure: SimulationMeasure) => {
    setShowSimulation(measure);
  }, []);

  const closeSimulation = useCallback(() => {
    setShowSimulation(null);
  }, []);

  return {
    yearlyConsumption,
    handleConsumptionChange,
    estimatedRating,
    energyIntensity,
    showSimulation,
    openSimulation,
    closeSimulation,
    selectedMeasures,
    toggleMeasure,
    totalSavings,
    newRating,
    getSavings,
    getBaselineValue,
    tekLabel,
    buildingCategory,
    hasEnovaAttest,
  };
}

export type { SimulationMeasure, SavingsResult };

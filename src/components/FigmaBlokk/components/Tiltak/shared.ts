import { useEffect, useState } from 'react';
import stotteordningService, { Stotteordning } from '../../../../services/stotteordning-service';
import type { AddressLookupResponse } from '../../../../services/buildingApi';

export interface TiltakComponentProps {
  onBack?: () => void;
  buildingType?: string;
  buildingData?: AddressLookupResponse;
  className?: string;
}

export type BuildingCategory = 'enebolig' | 'rekkehus' | 'blokk';
export type EnergyBuildingCategory = 'småhus' | 'blokk';
export type TekPeriod = 'eldre' | '49' | '69' | '87' | '97' | '7';
export type SavingsMetric = '0.75' | '1.2' | 'etteriso_yttervegg' | 'etteriso_takloft';

const FALLBACK_ENTRY: Stotteordning = {
  ordning: 'Kunne ikke hente støtteordninger',
  lenke: null,
  belop: 'Sjekk at API-serveren kjører',
  overskrift: 'Feil'
};

const DEFAULT_BUILDING_CATEGORY: BuildingCategory = 'enebolig';

export const OVERSKRIFT_FARGER: Record<string, string> = {
  'Enova': '#C7F6C9',
  'Klima- og energifondet': '#D1F9FF',
  'Oslo kommune': '#D1F9FF',
  'Klimaetaten': '#D1F9FF',
  'Byantikvaren': '#FFE4B5',
  'Riksantikvaren': '#FFB4AC',
  'Kulturminnefondet': '#DDA0DD'
};

const DEFAULT_OVERSKRIFT_FARGE = '#E0E0E0';

export const getOverskriftColor = (overskrift?: string | null): string => {
  if (!overskrift) {
    return DEFAULT_OVERSKRIFT_FARGE;
  }

  return OVERSKRIFT_FARGER[overskrift] ?? DEFAULT_OVERSKRIFT_FARGE;
};

export const openExternalLink = (url?: string | null): void => {
  if (!url) {
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
};

export const resolveBuildingCategory = (buildingType?: string): BuildingCategory => {
  if (!buildingType) {
    return DEFAULT_BUILDING_CATEGORY;
  }

  const normalized = buildingType.trim().toLowerCase();

  if (normalized.includes('blokk') || normalized.includes('leilighet') || normalized.includes('store boligbygg')) {
    return 'blokk';
  }

  if (
    normalized.includes('rekkehus') ||
    normalized.includes('tomannsbolig') ||
    normalized.includes('kjedehus') ||
    normalized.includes('småhus')
  ) {
    return 'rekkehus';
  }

  return DEFAULT_BUILDING_CATEGORY;
};

export const resolveEnergyCategory = (buildingType?: string): EnergyBuildingCategory | undefined => {
  if (!buildingType) {
    return undefined;
  }

  const normalized = buildingType.trim().toLowerCase();

  if (normalized.includes('blokk') || normalized.includes('leilighet') || normalized.includes('store boligbygg')) {
    return 'blokk';
  }

  if (
    normalized.includes('enebolig') ||
    normalized.includes('småhus') ||
    normalized.includes('rekkehus') ||
    normalized.includes('tomannsbolig') ||
    normalized.includes('kjedehus')
  ) {
    return 'småhus';
  }

  return undefined;
};

export interface UseStotteordningerOptions {
  tiltak: string;
  buildingType?: string;
  gulliste?: boolean;
  enabled?: boolean;
}

export interface UseStotteordningerResult {
  stotteordninger: Stotteordning[];
  isLoading: boolean;
  error?: string;
}

export const useStotteordninger = ({ tiltak, buildingType, gulliste = false, enabled = true }: UseStotteordningerOptions): UseStotteordningerResult => {
  const [stotteordninger, setStotteordninger] = useState<Stotteordning[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    if (!enabled) {
      setStotteordninger([]);
      setIsLoading(false);
      setError(undefined);
      return () => {
        isMounted = false;
      };
    }

    const fetchStotteordninger = async () => {
      setIsLoading(true);
      setError(undefined);

      try {
        const mappedType = resolveBuildingCategory(buildingType);
        const data = await stotteordningService.getStotteordninger(gulliste, tiltak, mappedType);

        if (!isMounted) {
          return;
        }

        setStotteordninger(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Feil ved henting av støtteordninger', err);

        if (!isMounted) {
          return;
        }

        setStotteordninger([FALLBACK_ENTRY]);
        setError('Kunne ikke hente støtteordninger');
        setIsLoading(false);
      }
    };

    fetchStotteordninger();

    return () => {
      isMounted = false;
    };
  }, [buildingType, gulliste, tiltak, enabled]);

  return { stotteordninger, isLoading, error };
};

export type EnergySavingsData = Record<
  TekPeriod,
  Record<EnergyBuildingCategory, Record<SavingsMetric, number>>
>;

export const ENERGY_SAVINGS_DATA: EnergySavingsData = {
  eldre: {
    blokk: {
      '0.75': 38.9,
      '1.2': 32.1,
      etteriso_yttervegg: 81.7,
      etteriso_takloft: 24.4
    },
    småhus: {
      '0.75': 42.2,
      '1.2': 34.3,
      etteriso_yttervegg: 94.1,
      etteriso_takloft: 41.2
    }
  },
  '49': {
    blokk: {
      '0.75': 38.9,
      '1.2': 32.1,
      etteriso_yttervegg: 81.7,
      etteriso_takloft: 24.4
    },
    småhus: {
      '0.75': 42.2,
      '1.2': 34.3,
      etteriso_yttervegg: 94.1,
      etteriso_takloft: 41.2
    }
  },
  '69': {
    blokk: {
      '0.75': 38.3,
      '1.2': 31.3,
      etteriso_yttervegg: 39.7,
      etteriso_takloft: 8.4
    },
    småhus: {
      '0.75': 41.7,
      '1.2': 33.7,
      etteriso_yttervegg: 27.7,
      etteriso_takloft: 11.4
    }
  },
  '87': {
    blokk: {
      '0.75': 28.1,
      '1.2': 21.0,
      etteriso_yttervegg: 9.7,
      etteriso_takloft: 2.8
    },
    småhus: {
      '0.75': 31.4,
      '1.2': 23.4,
      etteriso_yttervegg: 15.0,
      etteriso_takloft: 4.7
    }
  },
  '97': {
    blokk: {
      '0.75': 12.1,
      '1.2': 5.0,
      etteriso_yttervegg: 7.3,
      etteriso_takloft: 0.4
    },
    småhus: {
      '0.75': 14.2,
      '1.2': 6.1,
      etteriso_yttervegg: 3.7,
      etteriso_takloft: 0.6
    }
  },
  '7': {
    blokk: {
      '0.75': 7.2,
      '1.2': 0,
      etteriso_yttervegg: 1.3,
      etteriso_takloft: 0.4
    },
    småhus: {
      '0.75': 8.2,
      '1.2': 0,
      etteriso_yttervegg: 0,
      etteriso_takloft: 0
    }
  }
};

export const toTekPeriod = (label: string): TekPeriod => {
  if (label === 'eldre') {
    return 'eldre';
  }

  const trimmed = label.trim().toLowerCase();

  if (trimmed.startsWith('tek')) {
    const value = trimmed.replace('tek', '');

    if (value === '7') {
      return '7';
    }

    if (value === '97') {
      return '97';
    }

    if (value === '87') {
      return '87';
    }

    if (value === '69') {
      return '69';
    }

    if (value === '49') {
      return '49';
    }
  }

  return 'eldre';
};

export const calculateTekPeriod = (byggeaar: number): TekPeriod => {
  const threshold = 2;

  if (Number.isNaN(byggeaar)) {
    return 'eldre';
  }

  if (byggeaar >= 2007 + threshold) {
    return '7';
  }

  if (byggeaar >= 1997 + threshold) {
    return '97';
  }

  if (byggeaar >= 1987 + threshold) {
    return '87';
  }

  if (byggeaar >= 1969 + threshold) {
    return '69';
  }

  if (byggeaar >= 1949 + threshold) {
    return '49';
  }

  return 'eldre';
};

export const parseNumericValue = (value?: number | string | null): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

import { useCallback, useMemo } from 'react';
import type { AddressLookupResponse } from '../../../../services/buildingApi';
import { useContentDictionary } from '../../../../hooks/contentHooks';
import type { ContentAudience } from '../../../../../content/schema-helpers';
import { trackExternalLinkClick } from '../../../../analytics';

export interface Stotteordning {
  ordning: string;
  lenke: string | null;
  belop: string | null;
  overskrift: string | null;
}

export interface TiltakComponentProps {
  onBack?: () => void;
  buildingType?: string;
  buildingData?: AddressLookupResponse;
  className?: string;
  audience?: ContentAudience;
}

export type BuildingCategory = 'enebolig' | 'rekkehus' | 'blokk';
export type EnergyBuildingCategory = 'småhus' | 'blokk';
export type TekPeriod = 'eldre' | '49' | '69' | '87' | '97' | '7' | '10' | '17';
const DEFAULT_BUILDING_CATEGORY: BuildingCategory = 'enebolig';

/**
 * Legacy-mapping av tilbydernavn til farger.
 * Brukes kun internt av useProviderColors() som fallback når dictionary ikke er tilgjengelig.
 * Ikke eksportert – bruk useProviderColors() hook i stedet.
 */
const LEGACY_OVERSKRIFT_FARGER: Record<string, string> = {
  // Legacy-navn for bakoverkompatibilitet med eksterne datakilder
  'Klima- og energifondet': '#D1F9FF',
  'Klima- og energifondet (Oslo kommune)': '#D1F9FF',
  'Klimaetaten': '#D1F9FF',
  'Byantikvaren i Oslo': '#F9C66B',
  'Enova SF': '#C7F6C9'
};

const DEFAULT_OVERSKRIFT_FARGE = '#E0E0E0';

/**
 * Hook som gir tilgang til provider-farger fra dictionary.
 * Returnerer en funksjon som slår opp farge basert på provider-navn.
 */
export function useProviderColors(): (providerName?: string | null) => string {
  const { data: dictionary } = useContentDictionary();

  const providerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (dictionary?.providers) {
      for (const provider of dictionary.providers) {
        if (provider.color) {
          map.set(provider.name, provider.color);
        }
      }
    }
    return map;
  }, [dictionary?.providers]);

  return useCallback(
    (providerName?: string | null): string => {
      if (!providerName) {
        return DEFAULT_OVERSKRIFT_FARGE;
      }

      // 1. Først sjekk dictionary
      const dictionaryColor = providerColorMap.get(providerName);
      if (dictionaryColor) {
        return dictionaryColor;
      }

      // 2. Sjekk legacy-mapping for gamle navn
      const legacyColor = LEGACY_OVERSKRIFT_FARGER[providerName];
      if (legacyColor) {
        return legacyColor;
      }

      // 3. Fallback
      return DEFAULT_OVERSKRIFT_FARGE;
    },
    [providerColorMap]
  );
}

/**
 * Konverterer tilbyder-navn til visningsnavn.
 * Legacy-mappinger beholdes for bakoverkompatibilitet med eventuelle
 * eksterne datakilder som ikke er oppdatert.
 */
export const getOverskriftLabel = (overskrift?: string | null): string => {
  if (!overskrift) {
    return 'Støtte';
  }
  // Legacy-mappinger for bakoverkompatibilitet
  if (overskrift === 'Klima- og energifondet' || overskrift === 'Klima- og energifondet (Oslo kommune)') {
    return 'Oslo kommune';
  }
  if (overskrift === 'Byantikvaren i Oslo') {
    return 'Byantikvaren';
  }
  if (overskrift === 'Enova SF') {
    return 'Enova';
  }
  return overskrift;
};

export const openExternalLink = (url?: string | null, context?: string): void => {
  if (!url) {
    return;
  }

  trackExternalLinkClick(url, context);
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

export const calculateTekPeriod = (byggeaar: number): TekPeriod => {
  if (!byggeaar || Number.isNaN(byggeaar) || byggeaar < 1860) {
    return '49';
  }

  const threshold = 2;

  if (byggeaar >= 2017 + threshold) {
    return '17';
  }

  if (byggeaar >= 2010 + threshold) {
    return '10';
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

/**
 * Formaterer tall med mellomrom som tusenskille.
 * F.eks. 5000 → "5 000", 100000 → "100 000"
 */
export const formatNumberWithSpaces = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

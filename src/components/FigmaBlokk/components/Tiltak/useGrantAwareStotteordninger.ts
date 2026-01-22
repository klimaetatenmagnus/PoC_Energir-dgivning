import { useMemo } from 'react';
import type { TilskuddContent } from '../../../../../content/tilskudd/schema';
import type { ProviderDictionaryEntry } from '../../../../../content/dictionaries/schema';
import type { Stotteordning } from './shared';
import { useTilskuddBatch, useContentDictionary } from '../../../../hooks/contentHooks';
import { normaliseBuildingTypeKey } from '../../../../utils/tiltakContent';

type UseGrantAwareStotteordningerOptions = {
  grantIds?: string[] | null;
  /** Bygningstype for filtrering av støtteordninger */
  buildingType?: string | null;
};

export type UseGrantAwareStotteordningerResult = {
  stotteordninger: Stotteordning[];
  isLoading: boolean;
  error?: Error;
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatCurrency(amount: number, currency = 'NOK'): string {
  const normalisedCurrency = currency?.toUpperCase() || 'NOK';
  let formatter = currencyFormatters.get(normalisedCurrency);

  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: normalisedCurrency,
        maximumFractionDigits: 0
      });
    } catch {
      formatter = new Intl.NumberFormat('nb-NO', {
        maximumFractionDigits: 0
      });
    }
    currencyFormatters.set(normalisedCurrency, formatter);
  }

  return formatter.format(Math.round(amount));
}

function formatFundingSummary(funding: TilskuddContent['funding']): string | null {
  if (!funding?.length) {
    return null;
  }

  const primary = funding[0];
  switch (primary.kind) {
    case 'range': {
      const min = formatCurrency(primary.minAmount, primary.currency);
      const max = formatCurrency(primary.maxAmount, primary.currency);
      return primary.minAmount === primary.maxAmount ? max : `${min}–${max}`;
    }
    case 'fixed': {
      const value = formatCurrency(primary.amount, primary.currency);
      return primary.perUnit ? `${value} ${primary.perUnit}` : value;
    }
    case 'percentage':
      return `${primary.rate}% av kostnadene`;
    case 'custom':
      return primary.description ?? null;
    default:
      return null;
  }
}

/**
 * Slår opp tilbydernavn fra dictionary basert på provider.id.
 * Returnerer fallback hvis provider ikke finnes i dictionary.
 */
function getProviderNameFromDictionary(
  providerId: string | undefined,
  providers: ProviderDictionaryEntry[] | undefined
): string | null {
  if (!providerId) {
    return null;
  }
  const provider = providers?.find((p) => p.id === providerId);
  return provider?.name ?? null;
}

function mapTilskuddToStotteordning(
  tilskudd: TilskuddContent,
  providers: ProviderDictionaryEntry[] | undefined
): Stotteordning {
  // Slå opp provider-navn fra dictionary basert på id
  const providerName = getProviderNameFromDictionary(tilskudd.provider?.id, providers);

  return {
    ordning: tilskudd.title,
    lenke: tilskudd.application?.url ?? tilskudd.links[0]?.url ?? null,
    belop: formatFundingSummary(tilskudd.funding),
    // Bruk navn fra dictionary hvis tilgjengelig, ellers fallback til deprecated name-felt
    overskrift: providerName ?? tilskudd.provider?.name ?? null
  };
}

export function useGrantAwareStotteordninger({
  grantIds,
  buildingType
}: UseGrantAwareStotteordningerOptions): UseGrantAwareStotteordningerResult {
  // Hent providers fra dictionary for å slå opp tilbydernavn
  const { data: dictionary } = useContentDictionary();
  const providers = dictionary?.providers;

  // Normaliser buildingType for matching mot tilskuddets buildingTypes-array
  const normalizedBuildingType = useMemo(
    () => normaliseBuildingTypeKey(buildingType),
    [buildingType]
  );

  const uniqueGrantIds = useMemo(() => {
    const sanitisedIds = (grantIds ?? [])
      .map((id) => id?.trim())
      .filter((id): id is string => Boolean(id));
    const result: string[] = [];
    const seen = new Set<string>();
    for (const id of sanitisedIds) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      result.push(id);
    }
    return result;
  }, [grantIds]);

  const hasGrantIds = uniqueGrantIds.length > 0;

  const {
    data: grantData,
    isLoading,
    error
  } = useTilskuddBatch(hasGrantIds ? uniqueGrantIds : null);

  const stotteordninger = useMemo(() => {
    if (!grantData?.length) {
      return [];
    }
    // Filtrer tilskudd basert på buildingType
    // Hvis normalizedBuildingType er 'default', vis alle tilskudd (ingen filtrering)
    const filteredGrants = normalizedBuildingType === 'default'
      ? grantData
      : grantData.filter((tilskudd) =>
          tilskudd.buildingTypes.includes(normalizedBuildingType)
        );
    return filteredGrants.map((tilskudd) => mapTilskuddToStotteordning(tilskudd, providers));
  }, [grantData, providers, normalizedBuildingType]);

  return {
    stotteordninger,
    isLoading,
    error
  };
}

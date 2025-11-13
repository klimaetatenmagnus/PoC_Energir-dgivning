import { useMemo } from 'react';
import type { TilskuddContent } from '../../../../../content/tilskudd/schema';
import type { Stotteordning } from '../../../../services/stotteordning-service';
import { useTilskuddBatch } from '../../../../hooks/contentHooks';
import { useStotteordninger } from './shared';

type UseGrantAwareStotteordningerOptions = {
  grantIds?: string[] | null;
  legacyTiltakSlug: string;
  buildingType?: string;
};

export type UseGrantAwareStotteordningerResult = {
  stotteordninger: Stotteordning[];
  source: 'grants' | 'legacy';
  intendedSource: 'grants' | 'legacy';
  isLoading: boolean;
  grantLoading: boolean;
  legacyLoading: boolean;
  grantError?: Error;
  legacyError?: string;
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

function mapTilskuddToStotteordning(tilskudd: TilskuddContent): Stotteordning {
  return {
    ordning: tilskudd.title,
    lenke: tilskudd.application?.url ?? tilskudd.links[0]?.url ?? null,
    belop: formatFundingSummary(tilskudd.funding),
    overskrift: tilskudd.provider?.name ?? null
  };
}

export function useGrantAwareStotteordninger({
  grantIds,
  legacyTiltakSlug,
  buildingType
}: UseGrantAwareStotteordningerOptions): UseGrantAwareStotteordningerResult {
  const sanitisedIds = (grantIds ?? [])
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));

  const uniqueGrantIds: string[] = [];
  const seen = new Set<string>();
  for (const id of sanitisedIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    uniqueGrantIds.push(id);
  }

  const hasGrantOverrides = uniqueGrantIds.length > 0;

  const {
    data: grantData,
    isLoading: isGrantLoading,
    error: grantError
  } = useTilskuddBatch(hasGrantOverrides ? uniqueGrantIds : null);

  const grantBasedStotteordninger = useMemo(() => {
    if (!grantData?.length) {
      return [];
    }
    return grantData.map(mapTilskuddToStotteordning);
  }, [grantData]);

  const shouldEnableLegacyFallback =
    !hasGrantOverrides ||
    Boolean(grantError) ||
    (grantData !== undefined && grantBasedStotteordninger.length === 0);

  const {
    stotteordninger: legacyStotteordninger,
    isLoading: isLegacyLoading,
    error: legacyError
  } = useStotteordninger({
    tiltak: legacyTiltakSlug,
    buildingType,
    enabled: shouldEnableLegacyFallback
  });

  const useGrantSource = hasGrantOverrides && grantBasedStotteordninger.length > 0 && !grantError;
  const intendedSource: 'grants' | 'legacy' = hasGrantOverrides && !grantError ? 'grants' : 'legacy';

  const stotteordninger = useGrantSource ? grantBasedStotteordninger : legacyStotteordninger;
  const source: 'grants' | 'legacy' = useGrantSource ? 'grants' : 'legacy';

  const isLoading =
    source === 'grants'
      ? isGrantLoading
      : shouldEnableLegacyFallback
        ? isLegacyLoading
        : isGrantLoading;

  return {
    stotteordninger,
    source,
    intendedSource,
    isLoading,
    grantLoading: isGrantLoading,
    legacyLoading: isLegacyLoading,
    grantError,
    legacyError
  };
}

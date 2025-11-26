import { useEffect, useMemo } from 'react';
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
  const forceLegacyGrants = import.meta.env.VITE_FORCE_LEGACY_GRANTS === '1';
  const minGrantCount =
    Number.parseInt(import.meta.env.VITE_MIN_GRANT_COUNT ?? '', 10) || 2;
  const debugGrants =
    import.meta.env.VITE_DEBUG_GRANTS === '1' ||
    import.meta.env.VITE_DEBUG_GRANTS === 'true';
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
    (grantData !== undefined &&
      grantBasedStotteordninger.length < minGrantCount) ||
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

  const useGrantSource =
    !forceLegacyGrants &&
    hasGrantOverrides &&
    grantBasedStotteordninger.length >= minGrantCount &&
    !grantError;
  const intendedSource: 'grants' | 'legacy' =
    useGrantSource && hasGrantOverrides ? 'grants' : 'legacy';

  const stotteordninger = useGrantSource ? grantBasedStotteordninger : legacyStotteordninger;
  const source: 'grants' | 'legacy' = useGrantSource ? 'grants' : 'legacy';

  const isLoading =
    source === 'grants'
      ? isGrantLoading
      : shouldEnableLegacyFallback
        ? isLegacyLoading
        : isGrantLoading;

  useEffect(() => {
    if (!debugGrants) {
      return;
    }
    // Log a compact snapshot for troubleshooting in devtools console
    // Includes counts and which source is used.
    console.info('[grants-debug]', {
      legacyTiltakSlug,
      forceLegacyGrants,
      minGrantCount,
      grantIds: uniqueGrantIds,
      grantCount: grantBasedStotteordninger.length,
      legacyCount: legacyStotteordninger.length,
      source,
      intendedSource,
      grantError: grantError?.message,
      legacyError
    });
  }, [
    debugGrants,
    forceLegacyGrants,
    minGrantCount,
    uniqueGrantIds,
    grantBasedStotteordninger.length,
    legacyStotteordninger.length,
    source,
    intendedSource,
    grantError,
    legacyError,
    legacyTiltakSlug
  ]);

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

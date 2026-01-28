import { useMemo } from 'react';
import type { TilskuddContent } from '../../../../../content/tilskudd/schema';
import type { ProviderDictionaryEntry } from '../../../../../content/dictionaries/schema';
import type { ContentAudience } from '../../../../../content/schema-helpers';
import type { Stotteordning } from './shared';
import { useTilskuddBatch, useTilskuddCatalog, useContentDictionary } from '../../../../hooks/contentHooks';
import { normaliseBuildingTypeKey } from '../../../../utils/tiltakContent';

type UseGrantAwareStotteordningerOptions = {
  /** Tiltak-ID for å finne tilskudd som gjelder dette tiltaket (via appliesToTiltak) */
  tiltakId?: string | null;
  /** Bygningstype for filtrering av støtteordninger */
  buildingType?: string | null;
  /** Audience for filtrering av støtteordninger (standard eller gulliste) */
  audience?: ContentAudience | null;
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

/**
 * Hook som henter støtteordninger basert på tiltak-ID.
 *
 * Slår opp hvilke tilskudd som gjelder for dette tiltaket via tilskuddenes
 * `appliesToTiltak`-felt (satt i admin-verktøyet), og filtrerer deretter
 * på buildingType og audience.
 *
 * Dette gjør at admin-verktøyet blir eneste kilde til sannhet for
 * hvilke tilskudd som vises på hvilke tiltak.
 */
export function useGrantAwareStotteordninger({
  tiltakId,
  buildingType,
  audience
}: UseGrantAwareStotteordningerOptions): UseGrantAwareStotteordningerResult {
  // Hent providers fra dictionary for å slå opp tilbydernavn
  const { data: dictionary } = useContentDictionary();
  const providers = dictionary?.providers;

  // Hent tilskuddskatalog for å finne hvilke tilskudd som gjelder dette tiltaket
  const { data: tilskuddCatalog, isLoading: catalogLoading } = useTilskuddCatalog();

  // Normaliser buildingType for matching mot tilskuddets buildingTypes-array
  const normalizedBuildingType = useMemo(
    () => normaliseBuildingTypeKey(buildingType),
    [buildingType]
  );

  // Finn tilskudd-IDer som gjelder for dette tiltaket (via appliesToTiltak)
  const matchingTilskuddIds = useMemo(() => {
    if (!tiltakId || !tilskuddCatalog?.items?.length) {
      return [];
    }

    // Filtrer katalogen for tilskudd som har dette tiltaket i sin appliesToTiltak-liste
    return tilskuddCatalog.items
      .filter((item) => item.appliesToTiltak.includes(tiltakId))
      .map((item) => item.id);
  }, [tiltakId, tilskuddCatalog?.items]);

  const hasTilskuddIds = matchingTilskuddIds.length > 0;

  // Hent full tilskudd-data for de matchende IDene
  const {
    data: grantData,
    isLoading: grantsLoading,
    error
  } = useTilskuddBatch(hasTilskuddIds ? matchingTilskuddIds : null);

  const isLoading = catalogLoading || grantsLoading;

  const stotteordninger = useMemo(() => {
    if (!grantData?.length) {
      return [];
    }
    // Filtrer tilskudd basert på buildingType og audience
    const filteredGrants = grantData.filter((tilskudd) => {
      // Filtrer på buildingType (hvis ikke 'default')
      if (normalizedBuildingType !== 'default' && !tilskudd.buildingTypes.includes(normalizedBuildingType)) {
        return false;
      }
      // Filtrer på audience - tilskudd må inkludere gjeldende audience
      // Hvis audience ikke er satt, bruk 'standard' som default
      const effectiveAudience = audience ?? 'standard';
      if (!tilskudd.audiences.includes(effectiveAudience)) {
        return false;
      }
      return true;
    });
    return filteredGrants.map((tilskudd) => mapTilskuddToStotteordning(tilskudd, providers));
  }, [grantData, providers, normalizedBuildingType, audience]);

  return {
    stotteordninger,
    isLoading,
    error
  };
}

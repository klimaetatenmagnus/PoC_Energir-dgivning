/**
 * Service for henting av boligstruktur-data fra Oslo kommune ArcGIS
 *
 * Datakilder:
 * - KPA_variert_boligstruktur: Boligstatistikk per bydel fra kommuneplanen
 * - Bymiljøetaten karttjenester: Kartlag og geometri
 *
 * Brukes for å supplere Enova-data med kommunal boligstatistikk.
 */

// ArcGIS REST API endepunkter
const ARCGIS_BASE_URL =
  'https://services-eu1.arcgis.com/Hky23fkHucfDZYMu/arcgis/rest/services';
const KPA_BOLIGSTRUKTUR_URL = `${ARCGIS_BASE_URL}/KPA_variert_boligstruktur/FeatureServer/0/query`;

// Timeout og retry-konfigurasjon
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

/**
 * Typer for ArcGIS API-responser
 */
export interface ArcGISDistrictStats {
  bydel: string;
  bygningstyper: BuildingTypeCount[];
  totaltAntall: number;
}

export interface BuildingTypeCount {
  type: string;
  antall: number;
  andel: number; // Prosent av totalt
}

export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

interface ArcGISFeature {
  attributes: Record<string, unknown>;
}

interface ArcGISStatisticsResponse {
  features: Array<{
    attributes: {
      total?: number;
      Bygningstype?: string;
      Bydel?: string;
      [key: string]: unknown;
    };
  }>;
}

/**
 * Cache for ArcGIS-data (30 min TTL)
 */
const arcgisCache: Map<string, { data: unknown; timestamp: number }> = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutter

function getCachedData<T>(key: string): T | null {
  const cached = arcgisCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  arcgisCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Hjelpefunksjon for å bygge ArcGIS query URL
 */
function buildQueryUrl(baseUrl: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams({
    f: 'json', // Alltid JSON-format
    ...params,
  });
  return `${baseUrl}?${searchParams.toString()}`;
}

/**
 * Utfører fetch med timeout og retry
 */
async function fetchWithRetry<T>(
  url: string,
  retries: number = MAX_RETRIES,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (isLastAttempt) {
        console.warn(`[ArcGIS] Feil etter ${retries + 1} forsøk: ${errorMessage}`);
        return null;
      }

      // Vent før retry (eksponentiell backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }
  return null;
}

/**
 * Henter boligstatistikk per bydel fra KPA_variert_boligstruktur
 *
 * @param bydel - Bydelsnavn (f.eks. "Nordre Aker")
 * @returns Statistikk om bygningstyper i bydelen
 */
export async function fetchDistrictBuildingStats(
  bydel: string
): Promise<ArcGISDistrictStats | null> {
  const cacheKey = `district-stats:${bydel.toLowerCase()}`;
  const cached = getCachedData<ArcGISDistrictStats>(cacheKey);
  if (cached) {
    return cached;
  }

  // Bygg statistikk-query
  const url = buildQueryUrl(KPA_BOLIGSTRUKTUR_URL, {
    where: `Bydel='${bydel}'`,
    outStatistics: JSON.stringify([
      {
        statisticType: 'count',
        onStatisticField: 'OBJECTID',
        outStatisticFieldName: 'total',
      },
    ]),
    groupByFieldsForStatistics: 'Bygningstype',
  });

  const response = await fetchWithRetry<ArcGISStatisticsResponse>(url);

  if (!response?.features?.length) {
    return null;
  }

  // Parse respons til strukturert format
  const bygningstyper: BuildingTypeCount[] = [];
  let totaltAntall = 0;

  for (const feature of response.features) {
    const antall = Number(feature.attributes.total) || 0;
    const type = String(feature.attributes.Bygningstype || 'Ukjent');

    totaltAntall += antall;
    bygningstyper.push({ type, antall, andel: 0 });
  }

  // Beregn andeler
  for (const bt of bygningstyper) {
    bt.andel = totaltAntall > 0 ? Math.round((bt.antall / totaltAntall) * 100) : 0;
  }

  const result: ArcGISDistrictStats = {
    bydel,
    bygningstyper,
    totaltAntall,
  };

  setCachedData(cacheKey, result);
  return result;
}

/**
 * Henter total boligstatistikk for alle bydeler
 *
 * @returns Statistikk gruppert etter bydel og bygningstype
 */
export async function fetchAllDistrictStats(): Promise<Map<string, ArcGISDistrictStats>> {
  const cacheKey = 'all-district-stats';
  const cached = getCachedData<Map<string, ArcGISDistrictStats>>(cacheKey);
  if (cached) {
    return cached;
  }

  // Hent alle bydeler med gruppering
  const url = buildQueryUrl(KPA_BOLIGSTRUKTUR_URL, {
    where: '1=1', // Alle rader
    outStatistics: JSON.stringify([
      {
        statisticType: 'count',
        onStatisticField: 'OBJECTID',
        outStatisticFieldName: 'total',
      },
    ]),
    groupByFieldsForStatistics: 'Bydel,Bygningstype',
  });

  const response = await fetchWithRetry<ArcGISStatisticsResponse>(url);

  if (!response?.features?.length) {
    return new Map();
  }

  // Gruppper etter bydel
  const bydelMap = new Map<string, { bygningstyper: Map<string, number>; total: number }>();

  for (const feature of response.features) {
    const bydel = String(feature.attributes.Bydel || '');
    const bygningstype = String(feature.attributes.Bygningstype || 'Ukjent');
    const antall = Number(feature.attributes.total) || 0;

    if (!bydel) continue;

    if (!bydelMap.has(bydel)) {
      bydelMap.set(bydel, { bygningstyper: new Map(), total: 0 });
    }

    const bydelData = bydelMap.get(bydel)!;
    bydelData.bygningstyper.set(bygningstype, antall);
    bydelData.total += antall;
  }

  // Konverter til resultatformat
  const result = new Map<string, ArcGISDistrictStats>();

  for (const [bydel, data] of bydelMap) {
    const bygningstyper: BuildingTypeCount[] = [];

    for (const [type, antall] of data.bygningstyper) {
      bygningstyper.push({
        type,
        antall,
        andel: data.total > 0 ? Math.round((antall / data.total) * 100) : 0,
      });
    }

    // Sorter etter antall (synkende)
    bygningstyper.sort((a, b) => b.antall - a.antall);

    result.set(bydel, {
      bydel,
      bygningstyper,
      totaltAntall: data.total,
    });
  }

  setCachedData(cacheKey, result);
  return result;
}

/**
 * Henter antall boliger av en spesifikk type i en bydel
 *
 * @param bydel - Bydelsnavn
 * @param bygningstype - Bygningstype (f.eks. "Blokk", "Småhus")
 * @returns Antall boliger, eller null hvis ikke tilgjengelig
 */
export async function getCountForBuildingType(
  bydel: string,
  bygningstype: string
): Promise<number | null> {
  const stats = await fetchDistrictBuildingStats(bydel);

  if (!stats) {
    return null;
  }

  const normalizedType = bygningstype.toLowerCase();
  const match = stats.bygningstyper.find(bt =>
    bt.type.toLowerCase().includes(normalizedType)
  );

  return match?.antall ?? null;
}

/**
 * Sjekker om ArcGIS-tjenesten er tilgjengelig
 *
 * @returns true hvis tjenesten svarer
 */
export async function checkArcGISHealth(): Promise<boolean> {
  const url = buildQueryUrl(KPA_BOLIGSTRUKTUR_URL, {
    where: '1=1',
    returnCountOnly: 'true',
  });

  const response = await fetchWithRetry<{ count: number }>(url, 1, 5000);
  return response !== null && typeof response.count === 'number';
}

/**
 * Tømmer ArcGIS-cachen
 * Nyttig for testing eller ved oppdatering av data
 */
export function clearArcGISCache(): void {
  arcgisCache.clear();
}

/**
 * Returnerer cache-statistikk
 */
export function getArcGISCacheStats(): { entries: number; oldestMs: number | null } {
  if (arcgisCache.size === 0) {
    return { entries: 0, oldestMs: null };
  }

  let oldest = Infinity;
  for (const entry of arcgisCache.values()) {
    if (entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
  }

  return {
    entries: arcgisCache.size,
    oldestMs: Date.now() - oldest,
  };
}

// Liste over kjente bydeler i Oslo (for validering)
export const OSLO_BYDELER = [
  'Alna',
  'Bjerke',
  'Frogner',
  'Gamle Oslo',
  'Grorud',
  'Grünerløkka',
  'Nordre Aker',
  'Nordstrand',
  'Sagene',
  'St. Hanshaugen',
  'Stovner',
  'Søndre Nordstrand',
  'Ullern',
  'Vestre Aker',
  'Østensjø',
] as const;

export type OsloBydel = (typeof OSLO_BYDELER)[number];

/**
 * Validerer at et bydelsnavn er gyldig
 */
export function isValidBydel(bydel: string): bydel is OsloBydel {
  return OSLO_BYDELER.some(
    b => b.toLowerCase() === bydel.toLowerCase()
  );
}

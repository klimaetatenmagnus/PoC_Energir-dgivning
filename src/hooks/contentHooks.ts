import useSWR, { type KeyedMutator } from 'swr';
import type { TiltakContent } from '../../content/tiltak/schema';
import type { TilskuddContent } from '../../content/tilskudd/schema';
import type {
  ContentCatalogResponse,
  TiltakCatalogItem
} from '../types/contentCatalog';

type ContentFetcherResult<T> = {
  data: T;
  etag: string | null;
  fetchedAt: string;
  fromCache: boolean;
};

type ContentResourceCacheEntry<T> = {
  data: T;
  etag: string | null;
  rawEtag: string | null;
};

export type ContentHookResult<T> = {
  data: T | undefined;
  etag: string | null | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ContentFetcherResult<T>>;
  refresh: () => Promise<ContentFetcherResult<T> | undefined>;
};

export type ContentHookOptions = {
  includeDrafts?: boolean;
};

const resourceCache = new Map<string, ContentResourceCacheEntry<unknown>>();

function buildResourceCacheKey(relativePath: string, includeDrafts: boolean): string {
  return `${relativePath}|draft=${includeDrafts ? '1' : '0'}`;
}

function buildContentUrl(relativePath: string, includeDrafts: boolean): string {
  const query = includeDrafts ? '?draft=1' : '';
  return `/config/content/${relativePath}${query}`;
}

function normaliseEtag(rawEtag: string | null): { raw: string | null; clean: string | null } {
  if (!rawEtag) {
    return { raw: null, clean: null };
  }

  let normalised = rawEtag.trim();
  if (!normalised) {
    return { raw: null, clean: null };
  }

  if (normalised.startsWith('W/')) {
    normalised = normalised.slice(2).trim();
  }

  if (normalised.startsWith('"') && normalised.endsWith('"') && normalised.length >= 2) {
    normalised = normalised.slice(1, -1);
  }

  return { raw: rawEtag.trim(), clean: normalised };
}

async function parseErrorBody(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    return text ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}

async function fetchContentResource<T>(
  relativePath: string,
  includeDrafts: boolean
): Promise<ContentFetcherResult<T>> {
  const resourceKey = buildResourceCacheKey(relativePath, includeDrafts);
  const cached = resourceCache.get(resourceKey) as ContentResourceCacheEntry<T> | undefined;

  const headers: Record<string, string> = {};
  if (cached?.rawEtag) {
    headers['If-None-Match'] = cached.rawEtag;
  }

  const url = buildContentUrl(relativePath, includeDrafts);
  const response = await fetch(url, {
    headers,
    cache: 'no-store'
  });

  if (response.status === 304) {
    if (cached) {
      return {
        data: cached.data,
        etag: cached.etag,
        fetchedAt: new Date().toISOString(),
        fromCache: true
      };
    }

    // Retry once without conditional headers if cache entry is missing
    resourceCache.delete(resourceKey);
    return fetchContentResourceWithoutCache<T>(relativePath, includeDrafts);
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw new Error(
      `Failed to load ${relativePath}: ${response.status} ${response.statusText}${
        errorBody ? ` – ${errorBody}` : ''
      }`
    );
  }

  const rawEtag = response.headers.get('ETag');
  const { raw, clean } = normaliseEtag(rawEtag);
  const json = (await response.json()) as T;
  const cacheEntry: ContentResourceCacheEntry<T> = {
    data: json,
    etag: clean,
    rawEtag: raw
  };
  resourceCache.set(resourceKey, cacheEntry);

  return {
    data: json,
    etag: clean,
    fetchedAt: new Date().toISOString(),
    fromCache: false
  };
}

async function fetchContentResourceWithoutCache<T>(
  relativePath: string,
  includeDrafts: boolean
): Promise<ContentFetcherResult<T>> {
  const url = buildContentUrl(relativePath, includeDrafts);
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw new Error(
      `Failed to load ${relativePath}: ${response.status} ${response.statusText}${
        errorBody ? ` – ${errorBody}` : ''
      }`
    );
  }

  const rawEtag = response.headers.get('ETag');
  const { raw, clean } = normaliseEtag(rawEtag);
  const json = (await response.json()) as T;
  const cacheEntry: ContentResourceCacheEntry<T> = {
    data: json,
    etag: clean,
    rawEtag: raw
  };

  const resourceKey = buildResourceCacheKey(relativePath, includeDrafts);
  resourceCache.set(resourceKey, cacheEntry);

  return {
    data: json,
    etag: clean,
    fetchedAt: new Date().toISOString(),
    fromCache: false
  };
}

export async function fetchTiltakContent(
  tiltakId: string,
  options: ContentHookOptions = {}
): Promise<ContentFetcherResult<TiltakContent>> {
  return fetchContentResource<TiltakContent>(
    `tiltak/${tiltakId}.json`,
    Boolean(options.includeDrafts)
  );
}

export async function fetchTilskuddContent(
  tilskuddId: string,
  options: ContentHookOptions = {}
): Promise<ContentFetcherResult<TilskuddContent>> {
  return fetchContentResource<TilskuddContent>(
    `tilskudd/${tilskuddId}.json`,
    Boolean(options.includeDrafts)
  );
}

async function fetchTilskuddBatch(
  tilskuddIds: string[],
  includeDrafts: boolean
): Promise<ContentFetcherResult<TilskuddContent[]>> {
  if (!tilskuddIds.length) {
    return {
      data: [],
      etag: null,
      fetchedAt: new Date().toISOString(),
      fromCache: true
    };
  }

  const results = await Promise.all(
    tilskuddIds.map((id) => fetchTilskuddContent(id, { includeDrafts }))
  );

  return {
    data: results.map((entry) => entry.data),
    etag:
      results
        .map((entry) => entry.etag)
        .filter((etag): etag is string => Boolean(etag && etag.trim()))
        .join('|') || null,
    fetchedAt: new Date().toISOString(),
    fromCache: results.every((entry) => entry.fromCache)
  };
}

export async function fetchTiltakCatalog(
  options: ContentHookOptions = {}
): Promise<ContentFetcherResult<ContentCatalogResponse<TiltakCatalogItem>>> {
  return fetchContentResource<ContentCatalogResponse<TiltakCatalogItem>>(
    'tiltak/index.json',
    Boolean(options.includeDrafts)
  );
}

type TiltakKey = ['tiltak', string, boolean];
type TilskuddKey = ['tilskudd', string, boolean];
type TilskuddBatchKey = ['tilskudd-batch', string, boolean];
type TiltakCatalogKey = ['tiltak-catalog', boolean];

const swrConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 15_000
} as const;

export function useTiltakContent(
  tiltakId: string | null | undefined,
  options: ContentHookOptions = {}
): ContentHookResult<TiltakContent> {
  const includeDrafts = Boolean(options.includeDrafts);
  const key = tiltakId ? (['tiltak', tiltakId, includeDrafts] as TiltakKey) : null;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<TiltakContent>,
    Error,
    TiltakKey | null
  >(key, ([, id, draft]) => fetchTiltakContent(id, { includeDrafts: draft }), swrConfig);

  return {
    data: data?.data,
    etag: data?.etag,
    isLoading: Boolean(key) && !data && !error,
    error,
    mutate,
    refresh: () => mutate()
  };
}

export function useTilskuddContent(
  tilskuddId: string | null | undefined,
  options: ContentHookOptions = {}
): ContentHookResult<TilskuddContent> {
  const includeDrafts = Boolean(options.includeDrafts);
  const key = tilskuddId ? (['tilskudd', tilskuddId, includeDrafts] as TilskuddKey) : null;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<TilskuddContent>,
    Error,
    TilskuddKey | null
  >(key, ([, id, draft]) => fetchTilskuddContent(id, { includeDrafts: draft }), swrConfig);

  return {
    data: data?.data,
    etag: data?.etag,
    isLoading: Boolean(key) && !data && !error,
    error,
    mutate,
    refresh: () => mutate()
  };
}

export function useTilskuddBatch(
  tilskuddIds: string[] | null | undefined,
  options: ContentHookOptions = {}
): ContentHookResult<TilskuddContent[]> {
  const includeDrafts = Boolean(options.includeDrafts);
  const sanitisedIds = (tilskuddIds ?? [])
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));

  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const id of sanitisedIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    uniqueIds.push(id);
  }

  const keyPayload = JSON.stringify(uniqueIds);
  const key = uniqueIds.length
    ? (['tilskudd-batch', keyPayload, includeDrafts] as TilskuddBatchKey)
    : null;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<TilskuddContent[]>,
    Error,
    TilskuddBatchKey | null
  >(
    key,
    (args) => {
      if (!args) {
        return Promise.resolve<ContentFetcherResult<TilskuddContent[]>>({
          data: [],
          etag: null,
          fetchedAt: new Date().toISOString(),
          fromCache: true
        });
      }

      const [, idsJson, draft] = args;
      const ids = JSON.parse(idsJson) as string[];
      return fetchTilskuddBatch(ids, draft);
    },
    swrConfig
  );

  return {
    data: data?.data,
    etag: data?.etag,
    isLoading: Boolean(key) && !data && !error,
    error,
    mutate,
    refresh: () => mutate()
  };
}

export function useTiltakCatalog(
  options: ContentHookOptions = {}
): ContentHookResult<ContentCatalogResponse<TiltakCatalogItem>> {
  const includeDrafts = Boolean(options.includeDrafts);
  const key = ['tiltak-catalog', includeDrafts] as TiltakCatalogKey;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<ContentCatalogResponse<TiltakCatalogItem>>,
    Error,
    TiltakCatalogKey
  >(key, ([, draft]) => fetchTiltakCatalog({ includeDrafts: draft }), swrConfig);

  return {
    data: data?.data,
    etag: data?.etag,
    isLoading: !data && !error,
    error,
    mutate,
    refresh: () => mutate()
  };
}

import { createContext, useContext, type ReactNode } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import type { TiltakContent } from '../../content/tiltak/schema';
import type { TilskuddContent } from '../../content/tilskudd/schema';
import type {
  ContentCatalogResponse,
  TiltakCatalogItem,
  TilskuddCatalogItem
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
  baseUrl?: string;
};

type ResolvedContentHookOptions = {
  includeDrafts: boolean;
  baseUrl: string;
};

type ContentFetchContextValue = ResolvedContentHookOptions;

const DEFAULT_CONTENT_BASE_URL = '/config/content';

const ContentFetchContext = createContext<ContentFetchContextValue>({
  includeDrafts: false,
  baseUrl: DEFAULT_CONTENT_BASE_URL
});

export function ContentFetchProvider({
  includeDrafts,
  baseUrl,
  children
}: {
  includeDrafts?: boolean;
  baseUrl?: string;
  children: ReactNode;
}) {
  const value: ContentFetchContextValue = {
    includeDrafts: Boolean(includeDrafts),
    baseUrl: normaliseContentBaseUrl(baseUrl)
  };

  return <ContentFetchContext.Provider value={value}>{children}</ContentFetchContext.Provider>;
}

export function useContentFetchSettings(): ContentFetchContextValue {
  return useContext(ContentFetchContext);
}

function useContentFetchOptions(options: ContentHookOptions = {}): ResolvedContentHookOptions {
  const context = useContentFetchSettings();
  const includeDrafts =
    options.includeDrafts !== undefined ? Boolean(options.includeDrafts) : context.includeDrafts;
  return {
    includeDrafts,
    baseUrl: normaliseContentBaseUrl(options.baseUrl ?? context.baseUrl)
  };
}

function resolveContentFetchOptions(options: ContentHookOptions = {}): ResolvedContentHookOptions {
  return {
    includeDrafts: Boolean(options.includeDrafts),
    baseUrl: normaliseContentBaseUrl(options.baseUrl)
  };
}

const resourceCache = new Map<string, ContentResourceCacheEntry<unknown>>();

function buildResourceCacheKey(
  relativePath: string,
  includeDrafts: boolean,
  baseUrl: string
): string {
  return `${baseUrl}|${relativePath}|draft=${includeDrafts ? '1' : '0'}`;
}

function normaliseContentBaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return DEFAULT_CONTENT_BASE_URL;
  }

  let trimmed = baseUrl.trim();
  if (!trimmed) {
    return DEFAULT_CONTENT_BASE_URL;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  if (!trimmed.startsWith('/')) {
    trimmed = `/${trimmed}`;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function buildContentUrl(relativePath: string, includeDrafts: boolean, baseUrl: string): string {
  const sanitizedPath = relativePath.replace(/^\/+/, '');
  const query = includeDrafts ? '?draft=1' : '';
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${prefix}${sanitizedPath}${query}`;
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
  includeDrafts: boolean,
  baseUrl: string
): Promise<ContentFetcherResult<T>> {
  const resourceKey = buildResourceCacheKey(relativePath, includeDrafts, baseUrl);
  const cached = resourceCache.get(resourceKey) as ContentResourceCacheEntry<T> | undefined;

  const headers: Record<string, string> = {};
  if (cached?.rawEtag) {
    headers['If-None-Match'] = cached.rawEtag;
  }

  const url = buildContentUrl(relativePath, includeDrafts, baseUrl);
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
    return fetchContentResourceWithoutCache<T>(relativePath, includeDrafts, baseUrl);
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
  includeDrafts: boolean,
  baseUrl: string
): Promise<ContentFetcherResult<T>> {
  const url = buildContentUrl(relativePath, includeDrafts, baseUrl);
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

  const resourceKey = buildResourceCacheKey(relativePath, includeDrafts, baseUrl);
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
  const resolved = resolveContentFetchOptions(options);
  return fetchContentResource<TiltakContent>(
    `tiltak/${tiltakId}.json`,
    resolved.includeDrafts,
    resolved.baseUrl
  );
}

export async function fetchTilskuddContent(
  tilskuddId: string,
  options: ContentHookOptions = {}
): Promise<ContentFetcherResult<TilskuddContent>> {
  const resolved = resolveContentFetchOptions(options);
  return fetchContentResource<TilskuddContent>(
    `tilskudd/${tilskuddId}.json`,
    resolved.includeDrafts,
    resolved.baseUrl
  );
}

async function fetchTilskuddBatch(
  tilskuddIds: string[],
  includeDrafts: boolean,
  baseUrl: string
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
    tilskuddIds.map((id) => fetchTilskuddContent(id, { includeDrafts, baseUrl }))
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
  const resolved = resolveContentFetchOptions(options);
  return fetchContentResource<ContentCatalogResponse<TiltakCatalogItem>>(
    'tiltak/index.json',
    resolved.includeDrafts,
    resolved.baseUrl
  );
}

export async function fetchTilskuddCatalog(
  options: ContentHookOptions = {}
): Promise<ContentFetcherResult<ContentCatalogResponse<TilskuddCatalogItem>>> {
  const resolved = resolveContentFetchOptions(options);
  return fetchContentResource<ContentCatalogResponse<TilskuddCatalogItem>>(
    'tilskudd/index.json',
    resolved.includeDrafts,
    resolved.baseUrl
  );
}

type TiltakKey = ['tiltak', string, boolean, string];
type TilskuddKey = ['tilskudd', string, boolean, string];
type TilskuddBatchKey = ['tilskudd-batch', string, boolean, string];
type TiltakCatalogKey = ['tiltak-catalog', boolean, string];
type TilskuddCatalogKey = ['tilskudd-catalog', boolean, string];

const swrConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 15_000
} as const;

export function useTiltakContent(
  tiltakId: string | null | undefined,
  options: ContentHookOptions = {}
): ContentHookResult<TiltakContent> {
  const resolved = useContentFetchOptions(options);
  const key = tiltakId
    ? (['tiltak', tiltakId, resolved.includeDrafts, resolved.baseUrl] as TiltakKey)
    : null;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<TiltakContent>,
    Error,
    TiltakKey | null
  >(
    key,
    ([, id, draft, base]) => fetchTiltakContent(id, { includeDrafts: draft, baseUrl: base }),
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

export function useTilskuddContent(
  tilskuddId: string | null | undefined,
  options: ContentHookOptions = {}
): ContentHookResult<TilskuddContent> {
  const resolved = useContentFetchOptions(options);
  const key = tilskuddId
    ? (['tilskudd', tilskuddId, resolved.includeDrafts, resolved.baseUrl] as TilskuddKey)
    : null;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<TilskuddContent>,
    Error,
    TilskuddKey | null
  >(
    key,
    ([, id, draft, base]) => fetchTilskuddContent(id, { includeDrafts: draft, baseUrl: base }),
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

export function useTilskuddBatch(
  tilskuddIds: string[] | null | undefined,
  options: ContentHookOptions = {}
): ContentHookResult<TilskuddContent[]> {
  const resolved = useContentFetchOptions(options);
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
    ? (['tilskudd-batch', keyPayload, resolved.includeDrafts, resolved.baseUrl] as TilskuddBatchKey)
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

      const [, idsJson, draft, base] = args;
      const ids = JSON.parse(idsJson) as string[];
      return fetchTilskuddBatch(ids, draft, base);
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
  const resolved = useContentFetchOptions(options);
  const key = ['tiltak-catalog', resolved.includeDrafts, resolved.baseUrl] as TiltakCatalogKey;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<ContentCatalogResponse<TiltakCatalogItem>>,
    Error,
    TiltakCatalogKey
  >(
    key,
    ([, draft, base]) => fetchTiltakCatalog({ includeDrafts: draft, baseUrl: base }),
    swrConfig
  );

  return {
    data: data?.data,
    etag: data?.etag,
    isLoading: !data && !error,
    error,
    mutate,
    refresh: () => mutate()
  };
}

export function useTilskuddCatalog(
  options: ContentHookOptions = {}
): ContentHookResult<ContentCatalogResponse<TilskuddCatalogItem>> {
  const resolved = useContentFetchOptions(options);
  const key = ['tilskudd-catalog', resolved.includeDrafts, resolved.baseUrl] as TilskuddCatalogKey;

  const { data, error, mutate } = useSWR<
    ContentFetcherResult<ContentCatalogResponse<TilskuddCatalogItem>>,
    Error,
    TilskuddCatalogKey
  >(
    key,
    ([, draft, base]) => fetchTilskuddCatalog({ includeDrafts: draft, baseUrl: base }),
    swrConfig
  );

  return {
    data: data?.data,
    etag: data?.etag,
    isLoading: !data && !error,
    error,
    mutate,
    refresh: () => mutate()
  };
}

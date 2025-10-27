import { useEffect, useState } from 'react';

const runtimeContentCache = new Map<string, unknown>();
const runtimeContentPromises = new Map<string, Promise<unknown>>();

async function requestRuntimeJson<T>(relativePath: string): Promise<T> {
  const cached = runtimeContentCache.get(relativePath);
  if (cached) {
    return cached as T;
  }

  const existing = runtimeContentPromises.get(relativePath);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async () => {
    const response = await fetch(`/config/content/${relativePath}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load runtime content ${relativePath}: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as T;
    runtimeContentCache.set(relativePath, json);
    runtimeContentPromises.delete(relativePath);
    return json;
  })().catch((error) => {
    runtimeContentPromises.delete(relativePath);
    throw error;
  });

  runtimeContentPromises.set(relativePath, promise);
  return promise;
}

export async function fetchRuntimeJson<T>(relativePath: string): Promise<T> {
  return requestRuntimeJson<T>(relativePath);
}

export function useRuntimeJson<T>(relativePath: string, fallback: T): {
  data: T;
  loading: boolean;
  error?: Error;
} {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    requestRuntimeJson<T>(relativePath)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setData(result);
        setError(undefined);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        const normalisedError = err instanceof Error ? err : new Error(String(err));
        console.warn('[runtime-content] Failed to load', relativePath, normalisedError);
        setError(normalisedError);
        setData(fallback);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [relativePath, fallback]);

  return { data, loading, error };
}

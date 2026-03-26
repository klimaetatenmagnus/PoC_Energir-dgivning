import fetch, { type RequestInit, type Response } from 'node-fetch';

/**
 * Wrapper rundt node-fetch som prøver på nytt ved timeout/nettverksfeil.
 * Designet for å håndtere Geonorge-throttling ved samtidige forespørsler.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
  maxRetries = 2
): Promise<Response> {
  const { timeoutMs = 5_000, ...fetchOptions } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response;
    } catch (error) {
      lastError = error;

      const isRetryable =
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.name === 'TimeoutError' ||
          ('code' in error &&
            typeof (error as Record<string, unknown>).code === 'string' &&
            ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(
              (error as Record<string, unknown>).code as string
            )));

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Vent litt før neste forsøk (500ms, 1000ms)
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
    }
  }

  throw lastError;
}

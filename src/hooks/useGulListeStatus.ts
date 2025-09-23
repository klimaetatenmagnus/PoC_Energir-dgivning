import { useEffect, useState } from 'react';

export interface GulListeResult {
  erPaaGulListe: boolean;
  teigid?: string;
  gnr?: number;
  bnr?: number;
  navn?: string;
  kategori?: string;
  vernestatus?: string;
  adresse?: string;
  error?: string;
}

interface UseGulListeStatusParams {
  adresse?: string;
  gnr?: number;
  bnr?: number;
  onStatusChange?: (erPaaGulListe: boolean) => void;
}

interface UseGulListeStatusResult {
  status: GulListeResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const message = `${response.status}: ${response.statusText}`;
    throw new Error(`Feil ved henting av gul liste-status (${message})`);
  }

  return response.json() as Promise<T>;
}

export function useGulListeStatus({
  adresse,
  gnr,
  bnr,
  onStatusChange,
}: UseGulListeStatusParams): UseGulListeStatusResult {
  const [status, setStatus] = useState<GulListeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const hasAdresse = typeof adresse === 'string' && adresse.trim().length > 0;
    const hasGnrBnr = typeof gnr === 'number' && typeof bnr === 'number';

    if (!hasAdresse && !hasGnrBnr) {
      setStatus(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchStatus = async () => {
      setLoading(true);
      setError(null);

      try {
        let result: GulListeResult;

        if (hasAdresse) {
          result = await postJson<GulListeResult>(
            '/api/gul-liste/sjekk-adresse',
            { adresse: adresse?.trim() },
            controller.signal
          );
        } else {
          result = await postJson<GulListeResult>(
            '/api/gul-liste/sjekk-gnr-bnr',
            { gnr, bnr },
            controller.signal
          );
        }

        setStatus(result);
        onStatusChange?.(result.erPaaGulListe);
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return;
        }
        const message = fetchError instanceof Error ? fetchError.message : 'Ukjent feil';
        setError(message);
        setStatus(null);
        onStatusChange?.(false);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    return () => {
      controller.abort();
    };
  }, [adresse, bnr, gnr, onStatusChange, refreshToken]);

  const refetch = () => setRefreshToken((token) => token + 1);

  return { status, loading, error, refetch };
}

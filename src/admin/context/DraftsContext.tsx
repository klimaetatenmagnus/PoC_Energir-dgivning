/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import {
  fetchDrafts,
  syncDraftsToStaging,
  discardAllDrafts,
  type DraftSummary,
  type SyncStagingResponse,
  type DiscardAllDraftsResponse,
} from "../api/adminApiClient";

export interface DraftsContextValue {
  /** Liste over alle upubliserte drafts */
  drafts: DraftSummary[];
  /** Antall drafts */
  count: number;
  /** Om vi holder på å laste drafts */
  loading: boolean;
  /** Feilmelding hvis noe gikk galt */
  error: string | null;
  /** Hent drafts på nytt fra API */
  refresh: () => Promise<void>;
  /** Synk alle drafts til staging */
  syncToStaging: () => Promise<SyncStagingResponse>;
  /** Forkast alle drafts */
  discardAll: () => Promise<DiscardAllDraftsResponse>;
}

const DraftsContext = createContext<DraftsContextValue | undefined>(undefined);

export function DraftsProvider({ children }: PropsWithChildren) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDrafts();
      setDrafts(response.drafts);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncToStaging = useCallback(async (): Promise<SyncStagingResponse> => {
    const response = await syncDraftsToStaging();
    // Refresh draft-listen etter sync (drafts eksisterer fortsatt, men er nå synket)
    await refresh();
    return response;
  }, [refresh]);

  const discardAll = useCallback(async (): Promise<DiscardAllDraftsResponse> => {
    const response = await discardAllDrafts();
    // Refresh draft-listen etter discard (bør nå være tom)
    await refresh();
    return response;
  }, [refresh]);

  // Hent drafts ved oppstart
  useEffect(() => {
    const controller = new AbortController();

    const loadDrafts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchDrafts(controller.signal);
        setDrafts(response.drafts);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Ignorert - komponenten ble unmounted
        }
        const message = err instanceof Error ? err.message : "Ukjent feil";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadDrafts();

    return () => {
      controller.abort();
    };
  }, []);

  const value: DraftsContextValue = {
    drafts,
    count: drafts.length,
    loading,
    error,
    refresh,
    syncToStaging,
    discardAll,
  };

  return (
    <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>
  );
}

export function useDrafts(): DraftsContextValue {
  const context = useContext(DraftsContext);
  if (!context) {
    throw new Error("useDrafts må brukes innenfor DraftsProvider");
  }
  return context;
}

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdminContentDictionary,
  AdminDictionaryContextValue,
  AdminDictionaryStatus,
} from "../types";
import { fetchDictionary as fetchDictionaryFromApi } from "../api/adminApiClient";

export function useContentDictionary(): AdminDictionaryContextValue {
  const [dictionary, setDictionary] =
    useState<AdminContentDictionary | null>(null);
  const [generation, setGeneration] = useState<string | null>(null);
  const [status, setStatus] = useState<AdminDictionaryStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const loadDictionary = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus("loading");
    setError(null);

    try {
      const payload = await fetchDictionaryFromApi(controller.signal);
      setDictionary(payload.dictionary);
      setGeneration(payload.generation ?? null);
      setStatus("ready");
    } catch (fetchError) {
      if (controller.signal.aborted) {
        return;
      }
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Uventet feil under henting av dictionary";
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadDictionary();
    return () => controllerRef.current?.abort();
  }, [loadDictionary]);

  const reload = useCallback(() => {
    void loadDictionary();
  }, [loadDictionary]);

  return { dictionary, generation, status, error, reload };
}

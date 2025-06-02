// src/hooks/useBuildingInfo.ts
import { useEffect, useState } from "react";
import type { House } from "../types/House";

export function useBuildingInfo(adresse: string) {
  const [data, setData] = useState<House | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* -------------------------------------------------------
   *  Hent /lookup hver gang adressen endrer seg
   * ----------------------------------------------------- */
  useEffect(() => {
    if (!adresse) return;

    const controller = new AbortController();
    setLoading(true);

    fetch(`/lookup?adresse=${encodeURIComponent(adresse)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(t))))
      .then((info: Partial<House>) => {
        /*  Slå sammen tidligere state med ny /lookup-info
            – vi sprer først *eksisterende* verdier, slik at bruker-input
              (forbruk_kwh, tiltak osv.) bevares
            – deretter sprer vi svaret fra back-end, som dermed overskriver
              kun de feltene den faktisk har                                                                      */
        setData((prev) => (prev ? { ...prev, ...info } : (info as House)));
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e));
      })
      .finally(() => setLoading(false));

    /*  Avbryt fetch hvis komponenten unmountes eller adressen
        endrer seg før kallet er ferdig                                           */
    return () => controller.abort();
  }, [adresse]);

  return { data, error, loading };
}

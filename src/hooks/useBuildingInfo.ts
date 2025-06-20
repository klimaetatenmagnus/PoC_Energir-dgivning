// src/hooks/useBuildingInfo.ts
import { useEffect, useState } from "react";
import type { House } from "../types/House";

/** Basen til building-info-service (fra .env eller dev-proxy). */
const BIS_BASE =
  import.meta.env.VITE_BIS_BASE?.toString().replace(/\/$/, "") || "";

/**
 * React-hook som henter /lookup-data hver gang `adresse` endrer seg.
 * Returnerer { data, error, loading }.
 */
export function useBuildingInfo(adresse: string | null) {
  const [data, setData] = useState<House | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoad] = useState(false);

  useEffect(() => {
    if (!adresse) return; // ingen adresse → gjør ingenting

    const controller = new AbortController();
    setLoad(true);

    fetch(`${BIS_BASE}/lookup?adresse=${encodeURIComponent(adresse)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await (r.ok ? r.json() : r.text());
        if (!r.ok) throw new Error(body as string);
        return body as Partial<House>;
      })
      .then((info) => {
        // Bevar eventuelle bruker-felter (forbruk_kwh, tiltak …)
        setData((prev) => (prev ? { ...prev, ...info } : (info as House)));
        setError(null);
      })
      .catch((e: any) => {
        if (e.name !== "AbortError") setError(String(e.message ?? e));
      })
      .finally(() => setLoad(false));

    // Avbryt fetch ved unmount eller adresse-endring
    return () => controller.abort();
  }, [adresse]);

  return { data, error, loading };
}

/* Default-eksport for dem som foretrekker   `import useBuildingInfo from …`  */
export default useBuildingInfo;

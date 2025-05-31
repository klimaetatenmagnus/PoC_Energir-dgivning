// src/hooks/useBuildingInfo.ts
import { useState, useEffect } from "react";
import { House } from "../types/House";

export function useBuildingInfo(adresse: string) {
  const [data, setData] = useState<House | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!adresse) return;
    setLoading(true);
    fetch(`/lookup?adresse=${encodeURIComponent(adresse)}`)
      .then((r) => (r.ok ? r.json() : r.text().then((t) => Promise.reject(t))))
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [adresse]);

  return { data, error, loading };
}

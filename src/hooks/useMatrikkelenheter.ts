// src/hooks/useMatrikkelenheter.ts
import { useState, useEffect } from "react";
import { MatrikkelClient } from "../clients/MatrikkelClient";

export function useMatrikkelenheter(søk: {
  kommunenummer: number;
  status: string;
  gardsnummer: number;
  bruksnummer: number;
}) {
  const [ids, setIds] = useState<number[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const client = new MatrikkelClient(
      process.env.REACT_APP_API_BASE_URL!, // eks: http://localhost:3000/api/matrikkel
      "", // brukernavn/pw håndteres av proxy
      ""
    );
    const ctx = {
      locale: "no_NO_B",
      brukOriginaleKoordinater: false,
      koordinatsystemKodeId: 25833,
      systemVersion: "trunk",
      klientIdentifikasjon: "frontend",
      snapshotVersion: "9999-01-01T00:00:00+01:00",
    };

    client.findMatrikkelenheter(søk, ctx).then(setIds).catch(setError);
  }, [søk]);

  return { ids, error };
}

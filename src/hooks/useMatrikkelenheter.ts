// src/hooks/useMatrikkelenheter.ts
import { useState, useEffect } from 'react';
import { MatrikkelClient } from '../clients/MatrikkelClient';

export type MatrikkelSok = {
  kommunenummer: number | string;
  gardsnummer: number;
  bruksnummer: number;
  adressekode?: number;
  husnummer?: number;
  bokstav?: string;
};

export function useMatrikkelenheter(søk: MatrikkelSok | null | undefined) {
  const [ids, setIds] = useState<number[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!søk) {
      setIds(null);
      return;
    }

    const client = new MatrikkelClient(
      process.env.REACT_APP_API_BASE_URL!, // eks: http://localhost:3000/api/matrikkel
      '', // brukernavn/pw håndteres av proxy
      ''
    );
    const ctx = {
      locale: 'no_NO_B',
      brukOriginaleKoordinater: false,
      koordinatsystemKodeId: 25833,
      systemVersion: 'trunk',
      klientIdentifikasjon: 'frontend',
      snapshotVersion: '9999-01-01T00:00:00+01:00'
    };

    const normalisedQuery = {
      kommunenummer: String(søk.kommunenummer).padStart(4, '0'),
      gnr: søk.gardsnummer,
      bnr: søk.bruksnummer,
      adressekode: søk.adressekode,
      husnummer: søk.husnummer,
      bokstav: søk.bokstav
    };

    client
      .findMatrikkelenheter(normalisedQuery, ctx)
      .then((result) => {
        setIds(result);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [søk]);

  return { ids, error };
}

// src/App.tsx
import { useEffect, useState } from "react";
import type { House, Tiltak } from "./types/House";
import { MatrikkelClient } from "./clients/MatrikkelClient";

// Hent proxy-URL fra Vite-env (må ligge i .env som VITE_API_PROXY_URL)
const PROXY_BASE = import.meta.env.VITE_API_PROXY_URL ?? "/api/matrikkel";

function App() {
  const [house, setHouse] = useState<House | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [matrikkelIds, setMatrikkelIds] = useState<number[] | null>(null);
  const [loadingIds, setLoadingIds] = useState(false);

  const [loadingSubsidy, setLoadingSubsidy] = useState(false);
  const [subsidyFetched, setSubsidyFetched] = useState(false);

  // 1) Hent house.json + bygg-info
  useEffect(() => {
    fetch("/house.json")
      .then((res) => {
        if (!res.ok)
          throw new Error(`Kunne ikke laste husdata (${res.status})`);
        return res.json() as Promise<House>;
      })
      .then((data) => {
        setHouse(data);
        return fetch(`/lookup?adresse=${encodeURIComponent(data.adresse)}`);
      })
      .then((res) => {
        if (!res.ok)
          throw new Error(`Kunne ikke hente bygg-info (${res.status})`);
        return res.json() as Promise<Record<string, any>>;
      })
      .then((info) => {
        setHouse((prev) =>
          prev
            ? {
                ...prev,
                byggår: info.byggår ?? prev.byggår,
                bra_m2: info.bra_m2 ?? prev.bra_m2,
                energikarakter: info.energikarakter ?? null,
                oppvarmingskarakter: info.oppvarmingskarakter ?? null,
                energiattest_kwh: info.energiattest_kwh ?? null,
              }
            : prev
        );
      })
      .catch((err) => setError(err.message));
  }, []);

  // 1b) Når vi vet gardsnr/bruksnr, kall MatrikkelClient
  useEffect(() => {
    if (
      !house ||
      matrikkelIds !== null ||
      !house.gardsnummer ||
      !house.bruksnummer
    )
      return;

    setLoadingIds(true);

    const client = new MatrikkelClient(PROXY_BASE, "", "");
    const søk = {
      kommunenummer: house.kommunenummer ?? 301,
      status: "BESTAENDE",
      gardsnummer: house.gardsnummer,
      bruksnummer: house.bruksnummer,
    };
    const ctx = {
      locale: "no_NO_B",
      brukOriginaleKoordinater: false,
      koordinatsystemKodeId: 25833,
      systemVersion: "trunk",
      klientIdentifikasjon: "frontend",
      snapshotVersion: "9999-01-01T00:00:00+01:00",
    };

    client
      .findMatrikkelenheter(søk, ctx)
      .then((ids) => setMatrikkelIds(ids))
      .catch((err) => setError(`Feil ved matrikkelenhet-søk: ${err.message}`))
      .finally(() => setLoadingIds(false));
  }, [house, matrikkelIds]);

  // 2) Subsidy-fetch ved steg 3
  useEffect(() => {
    if (step !== 3 || !house?.tiltak || subsidyFetched) return;

    setLoadingSubsidy(true);
    setSubsidyFetched(true);

    Promise.all(
      house.tiltak.map((t) =>
        fetch(`/subsidy?tiltak=${encodeURIComponent(t.navn)}`)
          .then((res) => {
            if (!res.ok)
              throw new Error(`Kunne ikke hente støtte (${res.status})`);
            return res.json() as Promise<{ enova_støtte_kr: number }>;
          })
          .then((s) => s.enova_støtte_kr)
      )
    )
      .then((støtteTall) => {
        setHouse((prev) => {
          if (!prev) return prev;
          const nyeTiltak = prev.tiltak.map((t, i) => ({
            ...t,
            enova_støtte_kr: støtteTall[i],
          }));
          return { ...prev, tiltak: nyeTiltak };
        });
      })
      .catch((err) => setError("Feil ved lasting av støtte: " + err.message))
      .finally(() => setLoadingSubsidy(false));
  }, [step, house, subsidyFetched]);

  // --- Render ---
  if (error) return <p className="text-red-600">Error: {error}</p>;
  if (!house) return <p>Laster data…</p>;

  return (
    <div className="max-w-xl mx-auto p-4">
      {/* Debug: matrikkel-IDs */}
      {loadingIds && <p>Henter matrikkelenhets-ID…</p>}
      {matrikkelIds && matrikkelIds.length > 0 && (
        <p className="mb-4">
          <strong>Matrikkelenhets-IDer:</strong> {matrikkelIds.join(", ")}
        </p>
      )}

      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold mb-4">Grønn hus-sjekk</h1>
          <p>
            <strong>Adresse:</strong> {house.adresse}
          </p>
          {house.byggår != null && (
            <p>
              <strong>Byggeår:</strong> {house.byggår}
            </p>
          )}
          {house.energikarakter && (
            <p>
              <strong>Energimerke:</strong>{" "}
              <span className="font-semibold">{house.energikarakter}</span>
              {house.oppvarmingskarakter && (
                <> ({house.oppvarmingskarakter.toLowerCase()})</>
              )}
            </p>
          )}
          <button
            className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
            onClick={() => setStep(2)}
          >
            Neste: Energibruk
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <p>
            <strong>Årlig forbruk:</strong> {house.forbruk_kwh.toLocaleString()}{" "}
            kWh
          </p>
          {house.energiattest_kwh != null && (
            <p>
              <strong>Beregnet levert energi:</strong>{" "}
              {house.energiattest_kwh.toLocaleString()} kWh
            </p>
          )}
          <p>
            <strong>Estimert CO₂:</strong>{" "}
            {(house.forbruk_kwh * 0.2).toLocaleString()} kg
          </p>
          <button
            className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
            onClick={() => setStep(3)}
          >
            Neste: Tiltak
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Forslag til tiltak</h2>
          {loadingSubsidy ? (
            <p>Laster støtte­tall…</p>
          ) : (
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr>
                  <th className="border px-2 py-1">Tiltak</th>
                  <th className="border px-2 py-1">Sparing (kWh)</th>
                  <th className="border px-2 py-1">Kostnad (kr)</th>
                  <th className="border px-2 py-1">Enova-støtte (kr)</th>
                </tr>
              </thead>
              <tbody>
                {house.tiltak.map((t, i) => (
                  <tr key={i}>
                    <td className="border px-2 py-1">{t.navn}</td>
                    <td className="border px-2 py-1">
                      {t.kwh_sparing.toLocaleString()}
                    </td>
                    <td className="border px-2 py-1">
                      {t.kost_kr.toLocaleString()}
                    </td>
                    <td className="border px-2 py-1">
                      {t.enova_støtte_kr != null
                        ? t.enova_støtte_kr.toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            className="mt-6 px-4 py-2 bg-gray-300 text-black rounded"
            onClick={() => {
              setStep(1);
              setSubsidyFetched(false);
              setMatrikkelIds(null);
            }}
          >
            Start på nytt
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

// src/App.tsx
import { useEffect, useState } from "react";

interface Tiltak {
  navn: string;
  kwh_sparing: number;
  kost_kr: number;
  enova_støtte_kr?: number;
}

interface House {
  adresse: string;
  byggår: number;
  bra_m2: number;
  forbruk_kwh: number;
  oppvarming: string;
  tiltak: Tiltak[];
}

function App() {
  const [house, setHouse] = useState<House | null>(null);
  const [step, setStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [loadingSubsidy, setLoadingSubsidy] = useState<boolean>(false);
  const [subsidyFetched, setSubsidyFetched] = useState<boolean>(false);

  // 1) Initial load: house.json + lookup via proxy
  useEffect(() => {
    console.log("🟢 Starter initial load av house.json");
    fetch("/house.json")
      .then((res) => {
        console.log("📥 house.json status:", res.status);
        if (!res.ok)
          throw new Error(`Kunne ikke laste husdata (status ${res.status})`);
        return res.json() as Promise<House>;
      })
      .then((data) => {
        console.log("📦 Mottatt house.json:", data);
        setHouse(data);
        console.log("🔍 Starter lookup på bygg-info");
        return fetch(`/lookup?adresse=${encodeURIComponent(data.adresse)}`);
      })
      .then((res) => {
        console.log("⮕ lookup-status:", res.status, res.statusText);
        if (!res.ok)
          throw new Error(`Kunne ikke hente bygg-info (status ${res.status})`);
        return res.json() as Promise<{ byggår: number; bra_m2: number }>;
      })
      .then((info) => {
        console.log("✔️ Mottatt bygg-info:", info);
        setHouse(
          (prev) =>
            prev && {
              ...prev,
              byggår: info.byggår,
              bra_m2: info.bra_m2,
            }
        );
      })
      .catch((err) => {
        console.error("🚨 Initial load feilet:", err);
        setError(err.message);
      });
  }, []);

  // 2) Subsidy-fetch kun én gang når vi går til steg 3
  useEffect(() => {
    if (step === 3 && house?.tiltak && !subsidyFetched) {
      setLoadingSubsidy(true);
      setSubsidyFetched(true);
      console.log(
        "🔍 Starter subsidy-fetch for tiltak:",
        house.tiltak.map((t) => t.navn)
      );

      Promise.all(
        house.tiltak.map((t) =>
          fetch(`/subsidy?tiltak=${encodeURIComponent(t.navn)}`)
            .then((res) => {
              console.log(
                `⮕ Subsidy-status for ${t.navn}:`,
                res.status,
                res.statusText
              );
              if (!res.ok)
                throw new Error(
                  `Kunne ikke hente støtte (status ${res.status})`
                );
              return res.json() as Promise<{ enova_støtte_kr: number }>;
            })
            .then((s) => {
              console.log(`✔️ Respons-data for ${t.navn}:`, s);
              return s.enova_støtte_kr;
            })
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
        .catch((err) => {
          console.error("❌ Fetch subsidy feilet:", err);
          setError("Feil ved lasting av Enova-støtte: " + err.message);
        })
        .finally(() => setLoadingSubsidy(false));
    }
  }, [step, house, subsidyFetched]);

  if (error) return <p className="text-red-600">Error: {error}</p>;
  if (!house) return <p>Laster data…</p>;

  return (
    <div className="max-w-xl mx-auto p-4">
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold mb-4">Grønn hus-sjekk</h1>
          <p>
            <strong>Adresse:</strong> {house.adresse}
          </p>
          <p>
            <strong>Byggeår:</strong> {house.byggår}
          </p>
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

// src/App.tsx
import { useState, useEffect } from "react";
import type { House } from "./types/House";
import DebugDataTable from "./components/DebugDataTable";
import { useBuildingInfo } from "./hooks/useBuildingInfo";

/* ------------------------------------------------------------------ */
/*  Konstanter                                                        */
/* ------------------------------------------------------------------ */
const DEFAULT_ADDRESS = "Kapellveien 156C";

/* ------------------------------------------------------------------ */
/*  App – starter i diagnose-modus                                    */
/* ------------------------------------------------------------------ */
export default function App() {
  const [adresse, setAdresse] = useState(DEFAULT_ADDRESS);
  const [mode, setMode] = useState<"debug" | "wizard">("debug");

  /* 1. Bygg-/Enova-/sol-data  */
  const { data: lookupData, error } = useBuildingInfo(adresse);

  /* 2. house.json (lagret eksempelhus) */
  const [houseJson, setHouseJson] = useState<House | null>(null);
  useEffect(() => {
    fetch("/house.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setHouseJson)
      .catch((e) => console.error("Feil ved /house.json:", e));
  }, []);

  /* --- RENDER ---------------------------------------------------- */
  if (error) return <p className="text-red-600 p-4">Feil: {error}</p>;

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Adresse-input */}
      <div className="flex gap-2">
        <input
          className="border p-2 flex-1"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="Skriv adresse …"
        />
        {mode === "wizard" ? (
          <button
            className="px-3 py-2 bg-gray-200 rounded"
            onClick={() => setMode("debug")}
          >
            Tilbake til diagnose
          </button>
        ) : (
          <button
            className="px-3 py-2 bg-green-600 text-white rounded"
            onClick={() => setMode("wizard")}
            disabled={!lookupData || !houseJson}
          >
            Start veileder
          </button>
        )}
      </div>

      {/* ➊ Diagnose-tabell */}
      {mode === "debug" && (
        <>
          {!lookupData && <p>Laster data …</p>}
          {lookupData && <DebugDataTable data={lookupData} />}
        </>
      )}

      {/* ➋ Trinn-veileder */}
      {mode === "wizard" && lookupData && houseJson && (
        <WizardFlow
          initialHouse={{ ...houseJson, ...lookupData }}
          onRestart={() => {
            setMode("debug");
          }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  WizardFlow – 3-stegs veileder                                     */
/* ------------------------------------------------------------------ */
function WizardFlow({
  initialHouse,
  onRestart,
}: {
  initialHouse: House;
  onRestart: () => void;
}) {
  const [house, setHouse] = useState<House>(initialHouse);
  const [step, setStep] = useState(1);
  const [loadingSubsidy, setLoadingSubsidy] = useState(false);
  const [subsidyFetched, setSubsidyFetched] = useState(false);

  /* Enova-støtte når vi er på steg 3 */
  useEffect(() => {
    if (step !== 3 || subsidyFetched) return;
    setLoadingSubsidy(true);
    setSubsidyFetched(true);

    Promise.all(
      house.tiltak.map((t) =>
        fetch(`/subsidy?tiltak=${encodeURIComponent(t.navn)}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((j: { enova_støtte_kr: number }) => j.enova_støtte_kr)
          .catch(() => 0)
      )
    )
      .then((beløp) =>
        setHouse((h) => ({
          ...h,
          tiltak: h.tiltak.map((t, i) => ({
            ...t,
            enova_støtte_kr: beløp[i],
          })),
        }))
      )
      .finally(() => setLoadingSubsidy(false));
  }, [step, house, subsidyFetched]);

  /* ---------- RENDER TRINNENE ---------------- */
  if (step === 1)
    return (
      <section>
        <h1 className="text-2xl font-bold mb-4">Grønn hus-sjekk</h1>
        <p>
          <strong>Adresse:</strong> {house.adresse}
        </p>
        {house.byggår && (
          <p>
            <strong>Byggeår:</strong> {house.byggår}
          </p>
        )}
        {house.energikarakter && (
          <p>
            <strong>E-merke:</strong> {house.energikarakter}
          </p>
        )}
        <button
          className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
          onClick={() => setStep(2)}
        >
          Neste: Energibruk
        </button>
      </section>
    );

  if (step === 2)
    return (
      <section>
        <p>
          <strong>Årlig forbruk:</strong> {house.forbruk_kwh.toLocaleString()}{" "}
          kWh
        </p>
        {house.energiattest_kwh && (
          <p>
            <strong>Levert energi (attest):</strong>{" "}
            {house.energiattest_kwh.toLocaleString()} kWh
          </p>
        )}
        <button
          className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
          onClick={() => setStep(3)}
        >
          Neste: Tiltak
        </button>
      </section>
    );

  /* ---- steg 3 ---- */
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Forslag til tiltak</h2>

      {loadingSubsidy ? (
        <p>Laster støtte …</p>
      ) : (
        <table className="border w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2">Tiltak</th>
              <th className="border px-2">Sparing (kWh)</th>
              <th className="border px-2">Kostnad (kr)</th>
              <th className="border px-2">Enova-støtte</th>
            </tr>
          </thead>
          <tbody>
            {house.tiltak.map((t, i) => (
              <tr key={i} className="border-t">
                <td className="px-2">{t.navn}</td>
                <td className="px-2">{t.kwh_sparing.toLocaleString()}</td>
                <td className="px-2">{t.kost_kr.toLocaleString()}</td>
                <td className="px-2">
                  {t.enova_støtte_kr ? t.enova_støtte_kr.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        className="mt-6 px-4 py-2 bg-gray-300 rounded"
        onClick={onRestart}
      >
        Start på nytt
      </button>
    </section>
  );
}

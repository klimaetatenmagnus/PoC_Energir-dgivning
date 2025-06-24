// src/App.tsx
import { useState, useEffect } from "react";
import type { House } from "./types/House";
import DebugDataTable from "./components/DebugDataTable";
import useBuildingInfo from "./hooks/useBuildingInfo";
import { AddressSearch } from "./components/AddressSearch";
import { ResultsTable } from "./components/ResultsTable";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { buildingApi } from "./services/buildingApi";
import { PktButton } from "@oslokommune/punkt-react";

/* ------------------------------------------------------------------ */
/*  Konstanter                                                        */
/* ------------------------------------------------------------------ */
const DEFAULT_ADDRESS = "Kapellveien 156C, 0493 Oslo";

/* ------------------------------------------------------------------ */
/*  App – starter i diagnose-modus                                    */
/* ------------------------------------------------------------------ */
export default function App() {
  const [adresse, setAdresse] = useState(DEFAULT_ADDRESS);
  const [mode, setMode] = useState<"debug" | "wizard" | "lookup">("lookup");

  /* 1. Bygg-/Enova-/sol-data  */
  const { data: lookupData, error } = useBuildingInfo(mode === "debug" || mode === "wizard" ? adresse : "");

  /* 2. house.json (lagret eksempelhus) */
  const [houseJson, setHouseJson] = useState<House | null>(null);
  useEffect(() => {
    fetch("/house.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setHouseJson)
      .catch((e) => console.error("Feil ved /house.json:", e));
  }, []);

  /* 3. Lookup mode state */
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<Error | null>(null);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [searchedAddress, setSearchedAddress] = useState<string>("");

  const handleAddressLookup = async (address: string) => {
    setLookupLoading(true);
    setLookupError(null);
    setSearchedAddress(address);
    
    try {
      const result = await buildingApi.lookupAddress(address);
      setLookupResult(result);
      console.log('[App] Lookup successful:', result);
    } catch (error) {
      console.error('[App] Lookup failed:', error);
      setLookupError(error instanceof Error ? error : new Error('Ukjent feil'));
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  /* --- RENDER ---------------------------------------------------- */
  if (error && mode !== "lookup") return <p className="text-red-600 p-4">Feil: {error}</p>;

  return (
    <main className="container">
      <h1 className="page-title">Adresseoppslag - Matrikkel og Energiattest</h1>
      
      {/* Mode selector */}
      <div className="flex gap-2 mb-4">
        <PktButton
          onClick={() => setMode("lookup")}
        >
          Adresseoppslag
        </PktButton>
        <PktButton
          onClick={() => setMode("debug")}
        >
          Debug-modus
        </PktButton>
        <PktButton
          onClick={() => setMode("wizard")}
          disabled={!lookupData || !houseJson}
        >
          Veileder
        </PktButton>
      </div>

      {/* ➊ Adresseoppslag mode */}
      {mode === "lookup" && (
        <>
          <AddressSearch 
            onSearch={handleAddressLookup} 
            isLoading={lookupLoading}
          />
          
          {lookupLoading && (
            <LoadingSpinner text="Henter bygningsdata..." />
          )}
          
          {lookupError && !lookupLoading && (
            <ErrorDisplay 
              error={lookupError}
              onRetry={() => searchedAddress && handleAddressLookup(searchedAddress)}
              context={{ address: searchedAddress }}
            />
          )}
          
          {lookupResult && !lookupLoading && (
            <ResultsTable 
              data={lookupResult}
              searchAddress={searchedAddress}
            />
          )}
        </>
      )}

      {/* ➋ Diagnose-tabell */}
      {mode === "debug" && (
        <>
          <div className="flex gap-2 mb-4">
            <input
              className="border p-2 flex-1"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Skriv adresse …"
            />
          </div>
          {!lookupData && <p>Laster data …</p>}
          {lookupData && <DebugDataTable data={lookupData} />}
        </>
      )}

      {/* ➌ Trinn-veileder */}
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

// src/App.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { FigmaMainScript } from "./components/FigmaMainScript";
import { FigmaLanding } from "./components/FigmaBlokk/FigmaLanding";
import { MobileLanding } from "./components/mobile/MobileLanding";
import { MobileEnergySolutions } from "./components/mobile/MobileEnergySolutions";
import { MobileTiltakDetail } from "./components/mobile/MobileTiltakDetail";
import { TransitionOverlayRenderer } from "./components/TransitionOverlayRenderer";
import { useFigmaAddressSearch } from "./hooks/useFigmaAddressSearch";
import { useResponsive } from "./hooks/useResponsive";
import { useAddressCoordinates } from "./components/FigmaBlokk/hooks/useAddressCoordinates";
import { fetchSolarData, SolarEnergyData } from "./services/solarEnergyService";
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating } from "./utils/tekEnergyCalculations";
import { sjekkGulListeMedGnrBnr } from "./services/gul-liste-service";
import { lookupBuildingFromEnovaData, EnovaBuildingData } from "./services/districtStatisticsService";

export default function App() {
  const {
    mode,
    searchValue,
    loading,
    error,
    result,
    suggestions,
    showSuggestions,
    selectedSuggestionIndex,
    suggestionsLoading,
    skylineFadeOpacity,
    headerFadeOpacity,
    wrapperRef,
    isEnebolig,
    handleSearch,
    handleInputChange,
    handleKeyDown,
    handleSuggestionSelect,
    openSuggestions,
    handleBack,
    highlightSuggestion,
    clearHighlightedSuggestion,
    landingSnapshot,
  } = useFigmaAddressSearch();

  const { isMobileView } = useResponsive();

  // Hent kartkoordinater for mobil
  const mapCoordinates = useAddressCoordinates(searchValue, null);

  // State for mobil tiltaksdetalj
  const [selectedMobileTiltak, setSelectedMobileTiltak] = useState<string | null>(null);
  const [selectedMobileTiltakSavings, setSelectedMobileTiltakSavings] = useState<number | undefined>(undefined);

  // State for solarData (for mobil)
  const [solarData, setSolarData] = useState<SolarEnergyData | null>(null);

  // State for Enova bulk-data (for mobil sammenligning)
  const [enovaBulkData, setEnovaBulkData] = useState<EnovaBuildingData | null>(null);

  // Hent Enova bulk-data når result endres (for mobil)
  useEffect(() => {
    if (!result || !isMobileView) {
      setEnovaBulkData(null);
      return;
    }

    let cancelled = false;

    async function fetchEnovaData() {
      const gnr = String(result.gnr || result.csvData?.gnr || '');
      const bnr = String(result.bnr || result.csvData?.bnr || '');
      const snr = String(result.seksjonsnummer || '0');
      const bygningsnummer = result.bygningsnummer || '';

      if (!bygningsnummer && (!gnr || !bnr)) {
        return;
      }

      try {
        const data = await lookupBuildingFromEnovaData(bygningsnummer, gnr, bnr, snr);
        if (!cancelled) {
          setEnovaBulkData(data);
        }
      } catch {
        // Stille feil - Enova-data er ikke kritisk
        if (!cancelled) {
          setEnovaBulkData(null);
        }
      }
    }

    fetchEnovaData();

    return () => {
      cancelled = true;
    };
  }, [result, isMobileView]);

  // Hent soldata når result endres (for mobil)
  useEffect(() => {
    if (!result || !isMobileView) {
      setSolarData(null);
      return;
    }

    const gnrRaw = result.gnr || result.csvData?.gnr;
    const bnrRaw = result.bnr || result.csvData?.bnr;

    if (!gnrRaw || !bnrRaw) {
      return;
    }

    const gnr = typeof gnrRaw === 'string' ? Number(gnrRaw) : gnrRaw;
    const bnr = typeof bnrRaw === 'string' ? Number(bnrRaw) : bnrRaw;

    fetchSolarData({ gnr, bnr })
      .then((data) => {
        setSolarData(data);
      })
      .catch(() => {
        // Stille feil - soldata er ikke kritisk
        setSolarData(null);
      });
  }, [result, isMobileView]);

  // Beregn årlig energiforbruk (for mobil)
  // Prioriterer Enova bulk-data for "epler med epler"-sammenligning
  const { yearlyConsumption, isUsingEnovaData } = useMemo(() => {
    if (!result) return { yearlyConsumption: '', isUsingEnovaData: false };

    // Hvis boligen finnes i Enova bulk-data, bruk kWh/m² derfra
    // Dette sikrer at sammenligningen er basert på samme datakilde som bydelsstatistikken
    if (enovaBulkData?.kwhPerM2 && enovaBulkData.kwhPerM2 > 0) {
      const bruksareal = result.bruksarealM2 ||
        result.csvData?.bruksareal_totalt ||
        result.csvData?.bruksareal;
      const consumption = bruksareal ? enovaBulkData.kwhPerM2 * Number(bruksareal) : 0;
      return { yearlyConsumption: consumption > 0 ? String(Math.round(consumption)) : '', isUsingEnovaData: true };
    }

    // Fallback: Sjekk om det finnes energiattest med registrert forbruk fra API
    const registrertForbruk = result.energiattest?.registering?.beregnetLevertEnergiTotaltkWh;
    if (registrertForbruk) {
      return { yearlyConsumption: String(registrertForbruk), isUsingEnovaData: true };
    }

    // Fallback: Beregn basert på byggeår og bruksareal (TEK-estimering)
    const byggeaar = result.byggeaar || result.csvData?.byggeaar;
    const bruksareal = result.bruksarealM2 ||
      result.csvData?.bruksareal_totalt ||
      result.csvData?.bruksareal;

    if (!byggeaar || !bruksareal) return { yearlyConsumption: '', isUsingEnovaData: false };

    const buildingType = determineBuildingType(
      result.bygningstypeKode || result.csvData?.bygningstypekode,
      result.bygningstype || result.csvData?.bygningstype
    );

    const consumption = calculateAnnualEnergyConsumption(
      Number(byggeaar),
      Number(bruksareal),
      buildingType
    );

    return { yearlyConsumption: consumption ? String(consumption) : '', isUsingEnovaData: false };
  }, [result, enovaBulkData]);

  // Beregn estimert energikarakter (for mobil)
  // Bruker sentral calculateEnergyRating fra tekEnergyCalculations.ts
  const estimatedRating = useMemo(() => {
    if (!result) return null;

    const consumption = parseFloat(yearlyConsumption);
    const bruksareal = result.bruksarealM2 || result.bruksareal_totalt ||
      result.csvData?.bruksareal_totalt || result.csvData?.bruksarealM2;

    if (!consumption || !bruksareal) return null;

    const bra = Number(bruksareal);
    const intensity = consumption / bra;
    const buildingType = determineBuildingType(
      result.bygningstypeKode || result.csvData?.bygningstypekode,
      result.bygningstype || result.csvData?.bygningstype
    );

    return calculateEnergyRating(intensity, bra, buildingType);
  }, [result, yearlyConsumption]);

  const handleSelectMobileTiltak = useCallback((tiltakId: string, savingsKwh?: number) => {
    setSelectedMobileTiltak(tiltakId);
    setSelectedMobileTiltakSavings(savingsKwh);
  }, []);

  const handleBackFromMobileTiltak = useCallback(() => {
    setSelectedMobileTiltak(null);
    setSelectedMobileTiltakSavings(undefined);
  }, []);

  const overlay = <TransitionOverlayRenderer />;

  // Bestem byggtype for tiltaksdetalj
  const buildingTypeForTiltak = useMemo(() => {
    if (!result) return undefined;
    const code = result.bygningstypeKode || result.csvData?.bygningstypekode || '';
    const name = (result.bygningstype || result.csvData?.bygningstype || '').toLowerCase();

    if (code === '11' || name.includes('enebolig')) return 'enebolig';
    if (code === '12' || name.includes('tomannsbolig')) return 'tomannsbolig';
    if (code === '13' || name.includes('rekkehus') || name.includes('kjedehus')) return 'rekkehus';
    if (['14', '15', '16', '17'].includes(code) || name.includes('blokk') || name.includes('leilighet')) return 'blokk';
    return undefined;
  }, [result]);

  // State for gulliste-status (for mobil)
  const [isGulliste, setIsGulliste] = useState(false);

  // Sjekk gulliste-status når result endres
  useEffect(() => {
    if (!result) {
      setIsGulliste(false);
      return;
    }

    const gnrRaw = result.gnr || result.csvData?.gnr;
    const bnrRaw = result.bnr || result.csvData?.bnr;

    if (!gnrRaw || !bnrRaw) {
      setIsGulliste(false);
      return;
    }

    const gnr = typeof gnrRaw === 'string' ? Number(gnrRaw) : gnrRaw;
    const bnr = typeof bnrRaw === 'string' ? Number(bnrRaw) : bnrRaw;

    sjekkGulListeMedGnrBnr(gnr, bnr)
      .then((gulListeResult) => {
        setIsGulliste(gulListeResult.erPaaGulListe);
      })
      .catch((err) => {
        console.warn('Kunne ikke sjekke gulliste-status:', err);
        setIsGulliste(false);
      });
  }, [result]);

  // Bestem audience basert på gulliste-status
  const audienceForTiltak = useMemo(() => {
    return isGulliste ? 'gulliste' as const : 'standard' as const;
  }, [isGulliste]);

  // Special rendering for Figma blokk mode (handles both enebolig and blokk)
  if (mode === "figma-blokk" && result) {
    // Mobil (<768px): Vis MobileEnergySolutions eller MobileTiltakDetail
    if (isMobileView) {
      // Vis tiltaksdetalj hvis et tiltak er valgt
      if (selectedMobileTiltak) {
        return (
          <>
            {overlay}
            <MobileTiltakDetail
              tiltakId={selectedMobileTiltak}
              buildingType={buildingTypeForTiltak}
              audience={audienceForTiltak}
              onBack={handleBackFromMobileTiltak}
              annualSavingsKwh={selectedMobileTiltakSavings}
            />
          </>
        );
      }

      // Vis tiltakslisten
      return (
        <>
          {overlay}
          <MobileEnergySolutions
            searchAddress={searchValue}
            buildingData={result}
            onBack={handleBack}
            onSelectTiltak={handleSelectMobileTiltak}
            yearlyConsumption={yearlyConsumption}
            estimatedRating={estimatedRating}
            solarData={solarData}
            mapCoordinates={mapCoordinates}
            audience={audienceForTiltak}
            isUsingEnovaData={isUsingEnovaData}
          />
        </>
      );
    }

    // Desktop (>=768px): Vis FigmaMainScript med skalert Figma-design
    return (
      <>
        {overlay}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--pkt-color-brand-neutrals-100, #f9f9f9)',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <FigmaMainScript
            searchAddress={searchValue}
            buildingData={result}
            onBack={handleBack}
            landingSnapshot={landingSnapshot}
          />
        </div>
      </>
    );
  }


  // Special rendering for Figma mode - completely separate page
  // Mobil (<768px): Vis MobileLanding med Punkt-komponenter
  // Desktop (>=768px): Vis FigmaLanding med skalert Figma-design
  if (mode === "figma") {
    const hasResult = Boolean(result);

    // Mobil landing
    if (isMobileView) {
      return (
        <>
          {overlay}
          <MobileLanding
            headerShouldFadeOut={headerFadeOpacity < 1}
            skylineShouldFadeOut={skylineFadeOpacity < 1}
            searchValue={searchValue}
            loading={loading}
            error={error}
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            selectedSuggestionIndex={selectedSuggestionIndex}
            suggestionsLoading={suggestionsLoading}
            wrapperRef={wrapperRef}
            handleSearch={handleSearch}
            handleInputChange={handleInputChange}
            handleKeyDown={handleKeyDown}
            handleSuggestionSelect={handleSuggestionSelect}
            openSuggestions={openSuggestions}
            highlightSuggestion={highlightSuggestion}
            clearHighlightedSuggestion={clearHighlightedSuggestion}
          />
        </>
      );
    }

    // Desktop landing
    return (
      <>
        {overlay}
        <FigmaLanding
          headerFadeOpacity={headerFadeOpacity}
          skylineFadeOpacity={skylineFadeOpacity}
          searchValue={searchValue}
          loading={loading}
          error={error}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          selectedSuggestionIndex={selectedSuggestionIndex}
          suggestionsLoading={suggestionsLoading}
          wrapperRef={wrapperRef}
          handleSearch={handleSearch}
          handleInputChange={handleInputChange}
          handleKeyDown={handleKeyDown}
          handleSuggestionSelect={handleSuggestionSelect}
          openSuggestions={openSuggestions}
          highlightSuggestion={highlightSuggestion}
          clearHighlightedSuggestion={clearHighlightedSuggestion}
          isEnebolig={isEnebolig}
          hasResult={hasResult}
        />
      </>
    );
  }

  return overlay;
}

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
// Enova bulk-data håndteres internt i MobileEnergySolutions (kun for sammenligningsmodulen)

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
    isReturning,
  } = useFigmaAddressSearch();

  const { isMobileView } = useResponsive();

  useEffect(() => {
    const BASE_VIEWPORT = { width: 1250, height: 838 };

    const updateDesktopScale = () => {
      if (isMobileView) {
        document.documentElement.style.setProperty('--desktop-scale', '1');
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      if (dpr >= 1) {
        document.documentElement.style.setProperty('--desktop-scale', '1');
        return;
      }

      const viewport = window.visualViewport ?? { width: window.innerWidth, height: window.innerHeight };
      const widthRatio = viewport.width / BASE_VIEWPORT.width;
      const heightRatio = viewport.height / BASE_VIEWPORT.height;
      const scale = Math.min(widthRatio, heightRatio);
      const clamped = Math.min(1.6, Math.max(1, scale));
      document.documentElement.style.setProperty('--desktop-scale', clamped.toFixed(3));
    };

    updateDesktopScale();
    window.addEventListener('resize', updateDesktopScale);
    return () => window.removeEventListener('resize', updateDesktopScale);
  }, [isMobileView]);

  // Hent kartkoordinater for mobil
  const mapCoordinates = useAddressCoordinates(searchValue, null);

  // State for mobil tiltaksdetalj
  const [selectedMobileTiltak, setSelectedMobileTiltak] = useState<string | null>(null);
  const [selectedMobileTiltakSavings, setSelectedMobileTiltakSavings] = useState<number | undefined>(undefined);

  // State for solarData (for mobil)
  const [solarData, setSolarData] = useState<SolarEnergyData | null>(null);

  // Enova bulk-data håndteres nå internt i MobileEnergySolutions
  // (brukes kun i sammenligningsmodulen, ikke for hovedvisning)

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

  // Beregn årlig energiforbruk (for mobil hovedvisning)
  // ALLTID TEK-basert: byggeår, bruksareal, boligtype
  // Enova-data brukes KUN i sammenligningsmodulen (MobileDistrictComparison)
  const yearlyConsumption = useMemo(() => {
    if (!result) return '';

    const byggeaar = result.byggeaar || result.csvData?.byggeaar;
    const bruksareal = result.bruksarealM2 ||
      result.csvData?.bruksareal_totalt ||
      result.csvData?.bruksareal;

    if (!byggeaar || !bruksareal) return '';

    const buildingType = determineBuildingType(
      result.bygningstypeKode || result.csvData?.bygningstypekode,
      result.bygningstype || result.csvData?.bygningstype
    );

    const consumption = calculateAnnualEnergyConsumption(
      Number(byggeaar),
      Number(bruksareal),
      buildingType
    );

    return consumption ? String(consumption) : '';
  }, [result]);

  // isUsingEnovaData er ikke lenger relevant for hovedvisningen
  // (Enova-data håndteres kun internt i MobileEnergySolutions for sammenligningsmodulen)
  const isUsingEnovaData = false;

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

  // Shared background layer – always rendered for desktop figma modes
  // Ensures no flash between page transitions (same background persists)
  const sharedBackground = !isMobileView ? (
    <div className="app-background" aria-hidden="true">
      <div className="app-background__decorative-corner">
        <div className="app-background__decorative-circle" />
      </div>
    </div>
  ) : null;

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
            isDetailViewActive={!!selectedMobileTiltak}
          />
          {selectedMobileTiltak && (
            <MobileTiltakDetail
              tiltakId={selectedMobileTiltak}
              buildingType={buildingTypeForTiltak}
              audience={audienceForTiltak}
              onBack={handleBackFromMobileTiltak}
              annualSavingsKwh={selectedMobileTiltakSavings}
            />
          )}
        </>
      );
    }

    // Desktop (>=768px): Vis FigmaMainScript med skalert Figma-design
    return (
      <>
        {sharedBackground}
        {overlay}
        <div
          className="page2-wrapper"
          style={{
            opacity: isReturning ? 0 : 1,
            transition: `opacity ${isReturning ? '0.8s' : '0.4s'} ease-in-out`,
          }}
        >
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
        {sharedBackground}
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

// src/App.tsx
import React, { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { FigmaLanding } from "./components/FigmaBlokk/FigmaLanding";
import { MobileLanding } from "./components/mobile/MobileLanding";
import { TransitionOverlayRenderer } from "./components/TransitionOverlayRenderer";
import { useFigmaAddressSearch } from "./hooks/useFigmaAddressSearch";
import { useResponsive } from "./hooks/useResponsive";
import { useAddressCoordinates } from "./components/FigmaBlokk/hooks/useAddressCoordinates";
import { fetchSolarData, SolarEnergyData } from "./services/solarEnergyService";
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating } from "./utils/tekEnergyCalculations";
import { sjekkGulListeMedGnrBnr } from "./services/gul-liste-service";
import { trackResultViewed, trackPageStep, trackTiltakExpanded } from "./analytics";
import { getActiveTema } from "./tema";
import { TemaSeoSection } from "./components/TemaSeoSection";

// Side 2-komponentene lastes lazy: de trengs først etter adresseoppslag og
// utgjør en stor del av bundelen. Chunkene prefetches i idle-tid etter mount.
const importFigmaMainScript = () => import("./components/FigmaMainScript");
const importMobileEnergySolutions = () => import("./components/mobile/MobileEnergySolutions");
const importMobileTiltakDetail = () => import("./components/mobile/MobileTiltakDetail");

const FigmaMainScript = React.lazy(() =>
  importFigmaMainScript().then((m) => ({ default: m.FigmaMainScript }))
);
const MobileEnergySolutions = React.lazy(() =>
  importMobileEnergySolutions().then((m) => ({ default: m.MobileEnergySolutions }))
);
const MobileTiltakDetail = React.lazy(() =>
  importMobileTiltakDetail().then((m) => ({ default: m.MobileTiltakDetail }))
);
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

  // Temavariant fra URL (/solceller, /vinduer, /varmepumpe eller ?tema=) — leses én gang
  const tema = useMemo(() => getActiveTema(), []);

  // Prefetch side 2-chunkene i idle-tid så overgangen etter adresseoppslag er umiddelbar
  useEffect(() => {
    const prefetch = () => {
      void importFigmaMainScript();
      void importMobileEnergySolutions();
      void importMobileTiltakDetail();
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetch, 2500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const BASE_VIEWPORT = { width: 1250, height: 838 };
    const SCALE_DOWN_FACTOR = 0.8;
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';
    const isWindows = /Win/.test(platform) || /Windows/.test(userAgent);

    const getDisplayScaleCompensation = (dpr: number) => {
      if (!isWindows) {
        return 1;
      }

      if (dpr <= 1.1) {
        return 1;
      }

      // Stronger compensation for OS-level display scaling (e.g. 125%/150% in Windows).
      const normalized = Math.min(0.6, dpr - 1);
      return Math.max(0.82, Math.min(1, 1 - normalized * 0.28));
    };

    const updateDesktopScale = () => {
      const root = document.documentElement;
      if (isMobileView) {
        root.style.setProperty('--desktop-scale', '1');
        root.style.setProperty('--display-scale-compensation', '1');
        root.classList.remove('platform-windows-scaled', 'platform-windows-scaled-150');
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const isWindowsScaled = isWindows && dpr > 1.1;
      const isWindowsScaled150 = isWindows && dpr >= 1.4 && dpr < 1.6;
      root.style.setProperty('--device-pixel-ratio', dpr.toFixed(3));
      root.classList.toggle('platform-windows-scaled', isWindowsScaled);
      root.classList.toggle('platform-windows-scaled-150', isWindowsScaled150);

      const viewport = window.visualViewport ?? { width: window.innerWidth, height: window.innerHeight };
      const widthRatio = viewport.width / BASE_VIEWPORT.width;
      const heightRatio = viewport.height / BASE_VIEWPORT.height;
      const scale = Math.min(widthRatio, heightRatio);
      const compensation = getDisplayScaleCompensation(dpr);
      const adjusted = (scale >= 1 ? scale * SCALE_DOWN_FACTOR : scale) * compensation;
      const clamped = Math.min(1.6, adjusted);
      document.documentElement.style.setProperty('--desktop-scale', clamped.toFixed(3));
      document.documentElement.style.setProperty('--display-scale-compensation', compensation.toFixed(3));
    };

    updateDesktopScale();
    window.addEventListener('resize', updateDesktopScale);
    window.visualViewport?.addEventListener('resize', updateDesktopScale);
    return () => {
      window.removeEventListener('resize', updateDesktopScale);
      window.visualViewport?.removeEventListener('resize', updateDesktopScale);
    };
  }, [isMobileView]);

  useEffect(() => {
    const root = document.documentElement;
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';
    const isMac = /Mac/.test(platform) || /Macintosh/.test(userAgent);
    const isWindows = /Win/.test(platform) || /Windows/.test(userAgent);
    root.classList.toggle('platform-mac', isMac);
    root.classList.toggle('platform-windows', isWindows);
  }, []);

  // Hent kartkoordinater for mobil - bruk koordinater fra API-respons direkte (unngår ekstra Geonorge-kall)
  const initialCoords = useMemo(() => {
    const wgs84 = result?.coordinatesWgs84;
    if (wgs84 && Number.isFinite(wgs84.lat) && Number.isFinite(wgs84.lon)) {
      return { lat: wgs84.lat, lng: wgs84.lon };
    }
    return null;
  }, [result?.coordinatesWgs84]);
  const mapCoordinates = useAddressCoordinates(searchValue, initialCoords);

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

    const bygningsnummer = result.bygningsnummer || result.csvData?.bygningsnummer;

    fetchSolarData({ bygningsnummer, gnr, bnr })
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
    trackTiltakExpanded(tiltakId);
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
    if (code === '13' || name.includes('rekkehus') || name.includes('kjedehus') || name.includes('småhus')) return 'rekkehus';
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

    // Send bygningens representasjonspunkt for point-in-polygon-sjekk
    // (forhindrer falske positiver for naboer på samme gnr/bnr).
    const repPoint = result.representasjonspunkt
      ? {
          x: result.representasjonspunkt.east,
          y: result.representasjonspunkt.north,
          epsg: result.representasjonspunkt.epsg,
        }
      : undefined;

    sjekkGulListeMedGnrBnr(gnr, bnr, repPoint)
      .then((gulListeResult) => {
        setIsGulliste(gulListeResult.erPaaGulListe);
      })
      .catch((err) => {
        console.warn('Kunne ikke sjekke gulliste-status:', err);
        setIsGulliste(false);
      });
  }, [result]);

  // Spor resultatvisning og sidenavigasjon
  useEffect(() => {
    if (mode === 'figma-blokk' && result) {
      const platform = isMobileView ? 'mobile' : 'desktop';
      trackResultViewed(platform, result.csvData?.bydelsnavn);
      trackPageStep('result', platform);
    }
  }, [mode, result, isMobileView]);

  // Bestem audience basert på gulliste-status
  const audienceForTiltak = useMemo(() => {
    return isGulliste ? 'gulliste' as const : 'standard' as const;
  }, [isGulliste]);

  // Special rendering for Figma blokk mode (handles both enebolig and blokk)
  if (mode === "figma-blokk" && result) {
    // Mobil (<768px): Vis MobileEnergySolutions eller MobileTiltakDetail
    if (isMobileView) {
      return (
        <Suspense fallback={overlay}>
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
            initialCheckedTiltak={tema?.preselectTiltak}
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
        </Suspense>
      );
    }

    // Desktop (>=768px): Vis FigmaMainScript med skalert Figma-design
    return (
      <Suspense fallback={<>{sharedBackground}{overlay}</>}>
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
            initialCheckedTiltak={tema?.preselectTiltak}
          />
        </div>
      </Suspense>
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
            tema={tema}
          />
          {tema && <TemaSeoSection tema={tema} opacity={headerFadeOpacity} />}
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
          tema={tema}
        />
        {tema && <TemaSeoSection tema={tema} opacity={headerFadeOpacity} />}
      </>
    );
  }

  return overlay;
}

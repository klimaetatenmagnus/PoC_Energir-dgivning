import React from 'react';
import { PktButton } from '@oslokommune/punkt-react';
import { AddressLookupResponse } from '../services/buildingApi';
import { useAddressCoordinates } from './FigmaBlokk/hooks/useAddressCoordinates';
import { EnergySolutionButtons } from './FigmaBlokk/components/EnergySolutionButtons';
import type { TiltakCanonicalKey } from './FigmaBlokk/utils/tiltakCanonicalKeys';
import type { TiltakSavingsInfo } from '../utils/energySavingsData';
import { WhiteInfoBox } from './FigmaBlokk/components/WhiteInfoBox';
import { OsloLogo } from './FigmaBlokk/components/OsloLogo';
import { ProsessenVidere } from './FigmaBlokk/components/ProsessenVidere';
import { SolarEnergyData } from '../services/solarEnergyService';
import { sjekkGulListeMedGnrBnr } from '../services/gul-liste-service';
import { LYSEVEIEN_3_DATA } from '../testData/lyseveien3';
import { THERESES_11A_DATA } from '../testData/theresegate11a';
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating, getEnergyIntensityFromTEK, calculateTEK } from '../utils/tekEnergyCalculations';
import { THERESES_44A_DATA } from '../testData/theresegate44a';
import { Enebolig2LayerSvg, Blokk2LayerSvg } from './FigmaBlokk/components/BuildingSprites';
import type { LandingSnapshot } from '../hooks/useFigmaAddressSearch';
import { useTransitionOverlay, toViewportRect } from '../context/useTransitionOverlay';
import { createLogger } from '../utils/logger';
import './FigmaBlokk/FigmaMainScript.css';

const logger = createLogger({ prefix: 'figma-main' });

// Blokk SVG has ~5.149px viewBox padding at the bottom (204 - 198.851), scaled by 3 in detail view.
const BLOKK_VIEWBOX_HEIGHT = 204;
const BLOKK_CONTENT_BOTTOM = 198.851;
const BLOKK_BOTTOM_PADDING = BLOKK_VIEWBOX_HEIGHT - BLOKK_CONTENT_BOTTOM;
const BLOKK_DETAIL_SCALE = 3;
const ENEBOLIG_DETAIL_SCALE = 408 / 93;

// Energy rating colors (A-G scale)
const ENERGY_RATING_COLORS: Record<string, string> = {
  A: '#097E3E',
  B: '#32A548',
  C: '#96C133',
  D: '#EFE61E',
  E: '#F7AD24',
  F: '#EA6927',
  G: '#E31829'
};

interface FigmaBlokkProps {
  searchAddress: string;
  buildingData: AddressLookupResponse;
  onBack: () => void;
  landingSnapshot?: LandingSnapshot | null;
}

export const FigmaMainScript: React.FC<FigmaBlokkProps> = ({ searchAddress, buildingData, onBack }) => {
  // Check if building is an Enebolig
  const isEnebolig = React.useMemo(() => {
    // First check CSV/Excel data
    const csvBuildingType = buildingData.csvData?.bygningstypeNavn?.toLowerCase();
    if (csvBuildingType) {
      return csvBuildingType.includes('enebolig') ||
             csvBuildingType.includes('tomannsbolig') ||
             csvBuildingType.includes('rekkehus');
    }

    // Fallback to API data
    const buildingTypeCode = buildingData.bygningstypeKode;
    const buildingTypeId = buildingData.bygningstypeKodeId;

    if (buildingTypeCode) {
      const code = parseInt(buildingTypeCode);
      return code >= 110 && code < 140;
    } else if (buildingTypeId) {
      return buildingTypeId === 1 || buildingTypeId === 4 || buildingTypeId === 5 || buildingTypeId === 8;
    }
    return false;
  }, [buildingData]);

  // Use custom hooks for coordinates
  const mapCoordinates = useAddressCoordinates(searchAddress, null);
  const {
    phase: overlayPhase,
    buildingType: overlayBuildingType,
    isActive: overlayIsActive,
    setTargetRect,
    recentlyCompleted,
    finalizeTransition,
  } = useTransitionOverlay();
  const buildingKind = isEnebolig ? 'enebolig' : 'blokk';
  const overlayActiveForThisBuilding = overlayIsActive && overlayBuildingType === buildingKind;

  // Animation state
  const [showHeader, setShowHeader] = React.useState(false);

  // Show header after a delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowHeader(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // State for expanded mode
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [selectedSolution, setSelectedSolution] = React.useState<string | null>(null);
  const [solarData, setSolarData] = React.useState<SolarEnergyData | null>(null);
  const [showYellowBox, setShowYellowBox] = React.useState(false);
  const [gulListeLoading, setGulListeLoading] = React.useState(true);
  const [layoutScale, setLayoutScale] = React.useState(1);
  const [virtualWidth, setVirtualWidth] = React.useState<number | null>(null);

  const headerScale = Math.min(1.25, layoutScale);

  React.useEffect(() => {
    const BASE_VIEWPORT = { width: 1250, height: 838 };
    const SCALE_DOWN_FACTOR = 0.8;

    const updateLayoutScale = () => {
      const viewport = window.visualViewport ?? { width: window.innerWidth, height: window.innerHeight };
      const widthRatio = viewport.width / BASE_VIEWPORT.width;
      const heightRatio = viewport.height / BASE_VIEWPORT.height;
      const scale = Math.min(widthRatio, heightRatio);
      const adjusted = scale >= 1 ? scale * SCALE_DOWN_FACTOR : scale;
      const clamped = Math.min(1.6, adjusted);
      const resolvedScale = Number(clamped.toFixed(3));
      setLayoutScale(resolvedScale);
      setVirtualWidth(viewport.width / resolvedScale);
    };

    updateLayoutScale();
    window.addEventListener('resize', updateLayoutScale);
    return () => window.removeEventListener('resize', updateLayoutScale);
  }, []);

  const virtualClass = React.useMemo(() => {
    if (!virtualWidth) return '';
    if (virtualWidth < 1280) return 'tiltak-side--virtual-tablet';
    if (virtualWidth < 1600) return 'tiltak-side--virtual-laptop';
    return 'tiltak-side--virtual-desktop';
  }, [virtualWidth]);

  const scaleUpClass = layoutScale > 1 ? 'tiltak-side--scale-up' : '';
  const scaleDownClass = layoutScale < 1 ? 'tiltak-side--scale-down' : '';

  // State for updated building data
  const [updatedBuildingData, setUpdatedBuildingData] = React.useState<AddressLookupResponse>(buildingData);

  // Calculate initial estimated energy consumption
  const initialEnergyConsumption = React.useMemo(() => {
    const byggeaar = buildingData?.csvData?.byggeaar || buildingData?.byggeaar;
    const bruksareal = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt;
    const buildingType = determineBuildingType(
      buildingData?.bygningstypeKode || buildingData?.csvData?.bygningstypekode,
      buildingData?.bygningstype || buildingData?.csvData?.bygningstype
    );

    return calculateAnnualEnergyConsumption(byggeaar, bruksareal, buildingType);
  }, [buildingData]);

  const [energiforbruk, setEnergiforbruk] = React.useState<string>(
    String(initialEnergyConsumption)
  );

  // Refs for building elements
  const eneboligRef = React.useRef<HTMLDivElement>(null);
  const blokkRef = React.useRef<HTMLDivElement>(null);
  const buildingAreaRef = React.useRef<HTMLDivElement>(null);
  const circleRef = React.useRef<HTMLDivElement>(null);


  // State for process slide animation
  const [showProcess, setShowProcess] = React.useState(false);
  const [isProcessButtonExiting, setIsProcessButtonExiting] = React.useState(false);
  const [showInfoModal, setShowInfoModal] = React.useState(false);

  // State for tiltak animations and arrow feedback
  const [activeTiltak, setActiveTiltak] = React.useState<TiltakCanonicalKey[]>([]);
  const [arrowState, setArrowState] = React.useState<'add' | 'remove' | null>(null);
  const [arrowColor, setArrowColor] = React.useState<string>('#32A548');
  const prevTiltak = React.useRef(new Set<TiltakCanonicalKey>());

  // Track process button anchor near the rendered building
  const [processButtonX, setProcessButtonX] = React.useState<number | null>(null);
  const [processButtonY, setProcessButtonY] = React.useState<number | null>(null);

  React.useEffect(() => {
    const shouldTrackButton = activeTiltak.length > 0 && !isExpanded && !showProcess;
    if (!shouldTrackButton) {
      return;
    }

    let rafId = 0;
    const update = () => {
      const areaEl = buildingAreaRef.current;
      const buildingEl = (isEnebolig ? eneboligRef.current : blokkRef.current) ?? areaEl;
      if (!areaEl || !buildingEl) {
        rafId = window.requestAnimationFrame(update);
        return;
      }

      const buildingRect = buildingEl.getBoundingClientRect();
      const circleRect = circleRef.current?.getBoundingClientRect();

      const desiredTop = buildingRect.bottom + 38;
      const clampedTop = Math.min(window.innerHeight - 98, Math.max(96, desiredTop));

      setProcessButtonX(circleRect ? (circleRect.left + circleRect.width / 2) : (buildingRect.left + buildingRect.width / 2));
      setProcessButtonY(clampedTop);
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(rafId);
  }, [isEnebolig, showProcess, activeTiltak.length, isExpanded]);

  React.useEffect(() => {
    if (!showProcess) {
      setIsProcessButtonExiting(false);
      return;
    }

    setIsProcessButtonExiting(true);
    const timer = window.setTimeout(() => {
      setIsProcessButtonExiting(false);
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [showProcess]);

  const handleShowProcess = React.useCallback(() => {
    setIsProcessButtonExiting(true);
    setShowProcess(true);
  }, []);

  // Building animation: place in final position, use overlay for transition
  const [buildingReady, setBuildingReady] = React.useState(false);

  // State for total energy savings
  const [totalEnergySavings, setTotalEnergySavings] = React.useState<number>(0);
  const [tiltakInfo, setTiltakInfo] = React.useState<TiltakSavingsInfo[]>([]);
  const [newEnergyRating, setNewEnergyRating] = React.useState<string | null>(null);

  const getEnergyRatingColor = React.useCallback((rating?: string | null): string => {
    if (!rating) return '#32A548';
    return ENERGY_RATING_COLORS[rating.toUpperCase()] ?? '#32A548';
  }, []);

  const handleSelectionChange = React.useCallback((
    nextList: TiltakCanonicalKey[],
    finalRating?: string | null
  ) => {
    const next = new Set(nextList);
    const prev = prevTiltak.current;

    let mode: 'add' | 'remove' | null = null;

    for (const tiltak of next) {
      if (!prev.has(tiltak)) {
        mode = 'add';
        break;
      }
    }

    if (!mode) {
      for (const tiltak of prev) {
        if (!next.has(tiltak)) {
          mode = 'remove';
          break;
        }
      }
    }

    setArrowColor(getEnergyRatingColor(finalRating));
    setNewEnergyRating(finalRating ?? null);
    setActiveTiltak(nextList);

    if (mode) {
      setArrowState(mode);
    }

    prevTiltak.current = next;
  }, [getEnergyRatingColor]);

  // Delay enabling long transform transitions until after first paint
  const [allowProcessTransition, setAllowProcessTransition] = React.useState(false);
  React.useEffect(() => {
    setAllowProcessTransition(true);
  }, []);

  // Auto-clear arrow state after 900ms
  React.useEffect(() => {
    if (!arrowState) return;

    const timer = setTimeout(() => {
      setArrowState(null);
    }, 900);

    return () => clearTimeout(timer);
  }, [arrowState]);

  // Initialize arrow color from TEK-estimated energy rating
  React.useEffect(() => {
    const byggeaar = buildingData?.csvData?.byggeaar || buildingData?.byggeaar;
    const bruksareal = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt;
    const buildingType = determineBuildingType(
      buildingData?.bygningstypeKode || buildingData?.csvData?.bygningstypekode,
      buildingData?.bygningstype || buildingData?.csvData?.bygningstype
    );

    const yearNum = typeof byggeaar === 'string' ? parseInt(byggeaar) : byggeaar;
    const areaNum = typeof bruksareal === 'string' ? parseFloat(bruksareal) : bruksareal;

    if (yearNum && areaNum && !isNaN(yearNum) && !isNaN(areaNum) && areaNum > 0) {
      const tek = calculateTEK(yearNum);
      const intensity = getEnergyIntensityFromTEK(tek, buildingType, areaNum);
      const rating = calculateEnergyRating(intensity, areaNum, buildingType);
      setArrowColor(getEnergyRatingColor(rating));
    }
  }, [buildingData, getEnergyRatingColor]);

  // Handle building data updates from WhiteInfoBox
  const handleUpdateBuildingData = React.useCallback((
    byggeaar: string,
    areal: string,
    arealLeilighet: string,
    energiforbruk: string
  ) => {
    const parsedByggeaar = byggeaar ? Number(byggeaar) : undefined;
    const parsedAreal = areal ? Number(areal) : undefined;
    const parsedArealLeilighet = arealLeilighet ? Number(arealLeilighet) : undefined;

    setUpdatedBuildingData((previous) => ({
      ...previous,
      byggeaar: parsedByggeaar,
      bruksarealM2: parsedAreal,
      arealLeilighet: parsedArealLeilighet,
      csvData: {
        ...previous.csvData,
        byggeaar,
        bruksareal_totalt: areal,
        areal_leilighet: arealLeilighet,
      },
    }));
    setEnergiforbruk(energiforbruk);
  }, []);

  const handleTiltakBack = React.useCallback(() => {
    setIsExpanded(false);
    setSelectedSolution(null);
  }, []);

  // Track if solar data has been fetched
  const [hasFetchedSolarData, setHasFetchedSolarData] = React.useState(false);

  React.useEffect(() => {
    if (hasFetchedSolarData || !buildingData) return;

    setHasFetchedSolarData(true);

    if (searchAddress === "Lyseveien 3, 0362 OSLO" && buildingData.gnr === 33 && buildingData.bnr === 1139) {
      setSolarData(LYSEVEIEN_3_DATA.solarData);
      return;
    } else if (searchAddress === "Thereses gate 11A, 0358 OSLO" && buildingData.gnr === 215 && buildingData.bnr === 156) {
      setSolarData(THERESES_11A_DATA.solarData);
      return;
    } else if (searchAddress === "Thereses gate 44A, 0168 OSLO" && buildingData.gnr === 215 && buildingData.bnr === 278) {
      setSolarData(THERESES_44A_DATA.solarData);
      return;
    }

    if (buildingData.filteredSolarEnergy !== undefined || buildingData.takflater) {
      setSolarData({
        takAreal_m2: buildingData.takAreal_m2,
        sol_kwh_m2_yr: buildingData.sol_kwh_m2_yr,
        sol_kwh_bygg_tot: buildingData.sol_kwh_bygg_tot,
        solKategori: buildingData.solKategori,
        takflater: buildingData.takflater,
        filteredSolarEnergy: buildingData.filteredSolarEnergy,
      });
    }
  }, [buildingData, hasFetchedSolarData, searchAddress]);

  // Track if gul liste has been checked
  const [hasCheckedGulListe, setHasCheckedGulListe] = React.useState(false);

  React.useEffect(() => {
    if (hasCheckedGulListe || !buildingData || !buildingData.gnr || !buildingData.bnr) {
      if (!buildingData || !buildingData.gnr || !buildingData.bnr) {
        setGulListeLoading(false);
      }
      return;
    }

    const checkGulListe = async () => {
      setHasCheckedGulListe(true);

      try {
        const result = await sjekkGulListeMedGnrBnr(buildingData.gnr, buildingData.bnr);

        if (result.erPaaGulListe) {
          setShowYellowBox(true);
        } else {
          setShowYellowBox(false);
        }
      } catch (error) {
        logger.error('Error checking Gul liste:', error);
        setShowYellowBox(false);
      } finally {
        setGulListeLoading(false);
      }
    };

    checkGulListe();
  }, [buildingData, hasCheckedGulListe]);

  // Building ready state: show building once overlay completes or if no overlay
  React.useEffect(() => {
    if (!overlayActiveForThisBuilding && !buildingReady) {
      // No overlay active - show building after a short delay to let layout settle
      const timer = window.setTimeout(() => {
        setBuildingReady(true);
      }, 100);
      return () => window.clearTimeout(timer);
    }
  }, [overlayActiveForThisBuilding, buildingReady]);

  // Set target rect for overlay - uses getBoundingClientRect which gives viewport coordinates
  React.useLayoutEffect(() => {
    if (!overlayActiveForThisBuilding) {
      return;
    }

    const targetRef = isEnebolig ? eneboligRef : blokkRef;
    if (!targetRef.current) {
      return;
    }

    const rect = targetRef.current.getBoundingClientRect();
    setTargetRect(buildingKind, toViewportRect(rect));
  }, [buildingKind, isEnebolig, overlayActiveForThisBuilding, setTargetRect]);

  React.useEffect(() => {
    if (overlayPhase === 'settling') {
      setBuildingReady(true);
    }
  }, [overlayPhase]);

  React.useEffect(() => {
    if (!recentlyCompleted) {
      return;
    }

    setBuildingReady(true);
  }, [recentlyCompleted]);

  React.useEffect(() => {
    if (overlayPhase !== 'settling') {
      return;
    }

    // Short delay to ensure the building is painted before the overlay is removed
    const timer = window.setTimeout(() => {
      finalizeTransition();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [overlayPhase, finalizeTransition]);

  // Building detail scale
  const detailScale = isEnebolig ? ENEBOLIG_DETAIL_SCALE : BLOKK_DETAIL_SCALE;
  // Compensate for blokk bottom padding in viewBox
  const blokkBottomCompensation = isEnebolig ? 0 : Math.round(BLOKK_BOTTOM_PADDING * BLOKK_DETAIL_SCALE);

  // Calculate dynamic font size based on address length
  const addressOnly = searchAddress.split(',')[0];

  // Calculate district name width for green box
  const districtName = buildingData.csvData?.bydelsnavn || 'Bydel';

  // Get building type name
  const defaultBuildingType = isEnebolig ? 'Enebolig' : 'Blokk';
  const buildingTypeName = buildingData.csvData?.bygningstypeNavn || buildingData.bygningstypeNavn || defaultBuildingType;

  // Determine CSS class for show/hide transition
  const tiltakSideClasses = [
    'tiltak-side',
    allowProcessTransition ? 'tiltak-side--animate' : '',
    virtualClass,
    scaleUpClass,
    scaleDownClass,
  ].filter(Boolean).join(' ');

  const headerClasses = [
    'tiltak-side__header',
    showHeader && !isExpanded ? 'tiltak-side__header--visible' : 'tiltak-side__header--hidden',
  ].join(' ');

  return (
    <>
      {/* Header with logo and back button - fixed outside tiltak-side for z-index above ProsessenVidere */}
      <div
        className={headerClasses}
        style={{ ['--header-scale' as string]: headerScale }}
      >
        <div className="tiltak-side__header-inner">
          <div className="tiltak-side__logo-row">
            <OsloLogo color="var(--pkt-color-brand-dark-blue-1000, #2a2859)" />
            <span className="tiltak-side__logo-title">
              Energinøkkelen
            </span>
          </div>

          <PktButton
            skin="secondary"
            size="medium"
            variant="icon-left"
            iconName="arrow-return"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (showProcess) {
                setShowProcess(false);
              } else {
                const clones = document.querySelectorAll('div[style*="z-index: 9999"]');
                clones.forEach(clone => clone.remove());
                onBack();
              }
            }}
          >
            Tilbake
          </PktButton>
        </div>
      </div>

      <div
        className={tiltakSideClasses}
        style={{
          ['--layout-scale' as string]: layoutScale,
          ['--header-scale' as string]: headerScale,
        }}
      >
        {/* Three-column flex layout */}
        <main className="tiltak-side__content-shell">
          <div className={`tiltak-side__content${activeTiltak.length > 0 && !isExpanded && !showProcess ? ' tiltak-side__content--with-process' : ''}${showProcess ? ' tiltak-side__content--transitioning' : ''}`}>
          {/* Left column: Tiltak list */}
          <aside className="tiltak-side__tiltak-panel">
            <EnergySolutionButtons
              showHeader={showHeader}
              isExpanded={isExpanded}
              onExpand={setIsExpanded}
              onSelectSolution={setSelectedSolution}
              buildingData={{...updatedBuildingData, filteredSolarEnergy: solarData?.filteredSolarEnergy}}
              yearlyConsumption={energiforbruk}
              onTotalSavingsChange={setTotalEnergySavings}
              onTiltakInfoChange={setTiltakInfo}
              onSelectionChange={handleSelectionChange}
              audience={showYellowBox ? 'gulliste' : 'standard'}
              showInfoModal={showInfoModal}
              onShowInfoModalChange={setShowInfoModal}
            />
          </aside>

          {/* Center column: Building area */}
          <section className="tiltak-side__building-area" ref={buildingAreaRef}>
            {/* White circle background */}
            <div
              ref={circleRef}
              className={`tiltak-side__circle-bg ${showHeader && !isExpanded ? 'tiltak-side__circle-bg--visible' : 'tiltak-side__circle-bg--hidden'}`}
            />

            {/* Building - always in final position, overlay handles transition animation */}
            {isEnebolig && (
              <div
                ref={eneboligRef}
                className="tiltak-side__building"
                style={{
                  ['--building-scale' as string]: detailScale,
                  opacity: buildingReady || overlayPhase === 'settling' ? 1 : 0,
                  transition: overlayPhase !== 'idle' ? 'transform 0.8s ease-in-out' : undefined,
                  marginBottom: `${-blokkBottomCompensation}px`,
                }}
              >
                <Enebolig2LayerSvg
                  activeTiltak={activeTiltak}
                  arrowState={arrowState}
                  arrowColor={arrowColor}
                />
              </div>
            )}
            {!isEnebolig && (
              <div
                ref={blokkRef}
                className="tiltak-side__building"
                style={{
                  ['--building-scale' as string]: detailScale,
                  opacity: buildingReady || overlayPhase === 'settling' ? 1 : 0,
                  transition: overlayPhase !== 'idle' ? 'transform 0.8s ease-in-out' : undefined,
                  marginBottom: `${-blokkBottomCompensation}px`,
                }}
              >
                <Blokk2LayerSvg
                  activeTiltak={activeTiltak}
                  arrowState={arrowState}
                  arrowColor={arrowColor}
                />
              </div>
            )}

          </section>

          {/* Right column: Info panel */}
          <aside className="tiltak-side__info-panel">
            <WhiteInfoBox
              showHeader={showHeader}
              isExpanded={isExpanded}
              selectedSolution={selectedSolution}
              addressOnly={addressOnly}
              districtName={districtName}
              buildingTypeName={buildingTypeName}
              mapCoordinates={mapCoordinates}
              buildingData={{...updatedBuildingData, filteredSolarEnergy: solarData?.filteredSolarEnergy}}
              newEnergyRating={newEnergyRating}
              onExpand={setIsExpanded}
              onBackToSolutions={handleTiltakBack}
              showYellowBox={showYellowBox}
              gulListeLoading={gulListeLoading}
              onUpdateBuildingData={handleUpdateBuildingData}
              totalEnergySavings={totalEnergySavings}
              tiltakInfo={tiltakInfo}
              onShowInfo={() => setShowInfoModal(true)}
            />
          </aside>
          </div>
        </main>

        {/* Process button */}
        {activeTiltak.length > 0 && !isExpanded && (!showProcess || isProcessButtonExiting) && processButtonX !== null && processButtonY !== null && (
          <div
            className={`tiltak-side__process-wrapper${showProcess && isProcessButtonExiting ? ' tiltak-side__process-wrapper--transitioning' : ''}`}
            style={{
              left: processButtonX,
              top: `${processButtonY}px`,
              bottom: 'auto',
            }}
          >
            <PktButton
              skin="primary"
              size="medium"
              variant="icon-left"
              iconName="chevron-thin-down"
              onClick={handleShowProcess}
              className="energy-solution-buttons__process-btn--punkt"
            >
              Hvordan gjennomføre tiltakene
            </PktButton>
            <button
              className="energy-solution-buttons__scroll-indicator"
              onClick={handleShowProcess}
              aria-label="Gå til prosessen videre"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Prosessen videre component */}
      <ProsessenVidere
        showProcess={showProcess}
        scaleFactor={1}
        onBack={() => setShowProcess(false)}
        isGulliste={showYellowBox}
      />
    </>
  );
};

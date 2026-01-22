import React from 'react';
import { PktButton } from '@oslokommune/punkt-react';
import { AddressLookupResponse } from '../services/buildingApi';
import { useAddressCoordinates } from './FigmaBlokk/hooks/useAddressCoordinates';
import { getLayoutStyles } from './FigmaBlokk/styles';
import { EnergySolutionButtons } from './FigmaBlokk/components/EnergySolutionButtons';
import type { TiltakCanonicalKey } from './FigmaBlokk/utils/tiltakCanonicalKeys';
import { WhiteInfoBox } from './FigmaBlokk/components/WhiteInfoBox';
import { OsloLogo } from './FigmaBlokk/components/OsloLogo';
import { ProsessenVidere } from './FigmaBlokk/components/ProsessenVidere';
import { SolarEnergyData } from '../services/solarEnergyService';
import { sjekkGulListeMedGnrBnr } from '../services/gul-liste-service';
import { LYSEVEIEN_3_DATA } from '../testData/lyseveien3';
import { THERESES_11A_DATA } from '../testData/theresegate11a';
import { calculateAnnualEnergyConsumption, determineBuildingType } from '../utils/tekEnergyCalculations';
import { THERESES_44A_DATA } from '../testData/theresegate44a';
import { useFigmaViewportMetrics } from './FigmaBlokk/hooks/useFigmaViewportMetrics';
import { Enebolig2LayerSvg, Blokk2LayerSvg } from './FigmaBlokk/components/BuildingSprites';
import type { LandingSnapshot, BuildingSnapshot } from '../hooks/useFigmaAddressSearch';
import { useTransitionOverlay, toViewportRect } from '../context/useTransitionOverlay';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'figma-main' });

const FIGMA_ARTBOARD_WIDTH = 1728;
const FIGMA_ARTBOARD_CENTER = FIGMA_ARTBOARD_WIDTH / 2;
const ENEBOLIG_START_LEFT = 289;
const BLOKK_START_LEFT = 1051;
// Layout sentrert med 24px Punkt-spacing mellom elementer:
// - Total bredde: 488 + 24 + 520 + 24 + 360 = 1416px
// - Marger: (1728 - 1416) / 2 = 156px
// - Tiltak-boks: 156-644px (156 + 488)
// - Gap: 24px
// - Sirkel: 668-1188px (520px diameter, center på 928px)
// - Gap: 24px
// - Info box: 1212-1572px (360px bred)
// Building left edge for å sentrere i sirkel: 928 - 204 = 724px
// With left: 864px (center), translateX = 724 - 864 = -140px
const TARGET_TRANSLATION_X = -140;
const FIGMA_ARTBOARD_CENTER_PX = `${FIGMA_ARTBOARD_CENTER}px`;
const TARGET_TRANSLATION_PX = `${TARGET_TRANSLATION_X}px`;
// Align building bottom with tiltak list bottom (same offset as list + info box)
// Increased from 64 to 120 to make room for "Hvordan gjennomføre tiltakene" button
const FINAL_BOTTOM_OFFSET = 120;
// Vertikal offset for bygningen - satt til 0 for å justere bunnkanten med tiltakslisten
const BUILDING_VERTICAL_LIFT = 0;
// Blokk SVG has ~5.149px viewBox padding at the bottom (204 - 198.851), scaled by 3 in detail view.
const BLOKK_VIEWBOX_HEIGHT = 204;
const BLOKK_CONTENT_BOTTOM = 198.851;
const BLOKK_BOTTOM_PADDING = BLOKK_VIEWBOX_HEIGHT - BLOKK_CONTENT_BOTTOM;
const BLOKK_DETAIL_SCALE = 3;
const ENEBOLIG_DETAIL_SCALE = 408 / 93;
const BLOKK_FINAL_BOTTOM_OFFSET = Math.round(FINAL_BOTTOM_OFFSET - BLOKK_BOTTOM_PADDING * BLOKK_DETAIL_SCALE);
const SNAPSHOT_RESOLUTION_TIMEOUT_MS = 250;
const DETAIL_FADE_DURATION_MS = 450;

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

type BuildingStartCoordinates = {
  left: number;
  bottom: number;
};

type StartSource = 'snapshot' | 'fallback';

const DEFAULT_ENEBOLIG_START: BuildingStartCoordinates = {
  left: ENEBOLIG_START_LEFT,
  bottom: 0,
};

const DEFAULT_BLOKK_START: BuildingStartCoordinates = {
  left: BLOKK_START_LEFT,
  bottom: 0,
};

function useBuildingStartCoordinates(
  snapshot: BuildingSnapshot | undefined,
  fallback: BuildingStartCoordinates,
  lockUpdates: boolean,
  debugLabel: string,
): { start: BuildingStartCoordinates | null; source: StartSource | null } {
  const [start, setStart] = React.useState<BuildingStartCoordinates | null>(() =>
    snapshot ? { left: Math.round(snapshot.left), bottom: Math.round(snapshot.bottom) } : null,
  );
  const [source, setSource] = React.useState<StartSource | null>(snapshot ? 'snapshot' : null);
  const fallbackTimerRef = React.useRef<number | null>(null);
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  React.useEffect(() => {
    if (lockUpdates || !snapshot) {
      return;
    }

    setStart({ left: Math.round(snapshot.left), bottom: Math.round(snapshot.bottom) });
    setSource('snapshot');
    if (isDev) {
      console.warn(`[skyline-transition] ${debugLabel} start pinned to snapshot`, snapshot);
    }
  }, [snapshot, lockUpdates, debugLabel, isDev]);

  React.useEffect(() => {
    if (lockUpdates || start) {
      return;
    }

    fallbackTimerRef.current = window.setTimeout(() => {
      if (lockUpdates || start) {
        return;
      }

      setStart({ left: fallback.left, bottom: fallback.bottom });
      setSource('fallback');
      if (isDev) {
        console.warn(
          `[skyline-transition] ${debugLabel} start fell back to defaults`,
          { left: fallback.left, bottom: fallback.bottom },
        );
      }
    }, SNAPSHOT_RESOLUTION_TIMEOUT_MS);

    return () => {
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [fallback.left, fallback.bottom, lockUpdates, start, debugLabel, isDev]);

  return { start, source };
}

interface FigmaBlokkProps {
  searchAddress: string;
  buildingData: AddressLookupResponse;
  onBack: () => void;
  landingSnapshot?: LandingSnapshot | null;
}

export const FigmaMainScript: React.FC<FigmaBlokkProps> = ({ searchAddress, buildingData, onBack, landingSnapshot }) => {
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
      // Enebolig (11x codes) or Tomannsbolig/rekkehus (12x-13x codes)
      return code >= 110 && code < 140;
    } else if (buildingTypeId) {
      // Handle internal IDs for enebolig types
      return buildingTypeId === 1 || buildingTypeId === 4 || buildingTypeId === 5 || buildingTypeId === 8;
    }
    return false;
  }, [buildingData]);

  // Use custom hooks for coordinates
  // Always use Geonorge for map coordinates - backend's coordinatesWgs84 can point to
  // wrong building when an property (gnr/bnr) has multiple buildings with different addresses
  // (e.g., Fallanveien 29 vs Kurveien 50 on the same property)
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
    String(buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh || initialEnergyConsumption)
  );

  // State for enebolig animation
  const [animateHouse, setAnimateHouse] = React.useState(false);
  const eneboligRef = React.useRef<HTMLDivElement>(null);
  const blokkRef = React.useRef<HTMLDivElement>(null);
  // State for blokk animation
  const [animateBlokk, setAnimateBlokk] = React.useState(false);
  // State for process slide animation
  const [showProcess, setShowProcess] = React.useState(false);
  
  // State for total energy savings
  const [totalEnergySavings, setTotalEnergySavings] = React.useState<number>(0);
  const [newEnergyRating, setNewEnergyRating] = React.useState<string | null>(null);

  // State for tiltak animations and arrow feedback
  // Uses canonical keys (e.g., 'ventilasjon', 'solenergi') instead of display titles for stability
  const [activeTiltak, setActiveTiltak] = React.useState<TiltakCanonicalKey[]>([]);
  const [arrowState, setArrowState] = React.useState<'add' | 'remove' | null>(null);
  const [arrowColor, setArrowColor] = React.useState<string>('#32A548'); // Default green (B rating)
  const prevTiltak = React.useRef(new Set<TiltakCanonicalKey>());

  const getEnergyRatingColor = React.useCallback((rating?: string | null): string => {
    if (!rating) return '#32A548'; // Default to B rating color
    return ENERGY_RATING_COLORS[rating.toUpperCase()] ?? '#32A548';
  }, []);

  const handleSelectionChange = React.useCallback((
    nextList: TiltakCanonicalKey[],
    finalRating?: string | null
  ) => {
    const next = new Set(nextList);
    const prev = prevTiltak.current;

    // Determine if a tiltak was added or removed
    let mode: 'add' | 'remove' | null = null;

    // Check for additions
    for (const tiltak of next) {
      if (!prev.has(tiltak)) {
        mode = 'add';
        break;
      }
    }

    // Check for removals if no addition found
    if (!mode) {
      for (const tiltak of prev) {
        if (!next.has(tiltak)) {
          mode = 'remove';
          break;
        }
      }
    }

    // Update states
    setArrowColor(getEnergyRatingColor(finalRating));
    setNewEnergyRating(finalRating ?? null);
    setActiveTiltak(nextList);

    if (mode) {
      setArrowState(mode);
    }

    prevTiltak.current = next;
  }, [getEnergyRatingColor]);

  // Delay enabling long transform transitions until after first paint to avoid initial jumps
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

  // Initialize arrow color from building's current energy rating
  React.useEffect(() => {
    const initialRating = buildingData?.energiattest?.energikarakter;
    setArrowColor(getEnergyRatingColor(initialRating));
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

  // Use solar data from backend response (already correctly fetched with right building number)
  // instead of making a separate fetch that uses potentially wrong coordinates
  React.useEffect(() => {
    // Only set once per component lifecycle
    if (hasFetchedSolarData || !buildingData) return;

    setHasFetchedSolarData(true);

    // TEST MODE: Check if this is test data
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

    // Use solar data from backend response - already correctly fetched with csvData.bygningsNr
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
  
  // Check Gul liste status when component mounts
  React.useEffect(() => {
    // Only check once per component lifecycle
    if (hasCheckedGulListe || !buildingData || !buildingData.gnr || !buildingData.bnr) {
      if (!buildingData || !buildingData.gnr || !buildingData.bnr) {
        // console.log('🏛️ Missing GNR/BNR, skipping Gul liste check');
        setGulListeLoading(false);
      }
      return;
    }
    
    const checkGulListe = async () => {
      setHasCheckedGulListe(true);
      
      try {
        // console.log(`🏛️ Checking Gul liste for GNR ${buildingData.gnr}, BNR ${buildingData.bnr}`);
        const result = await sjekkGulListeMedGnrBnr(buildingData.gnr, buildingData.bnr);
        
        if (result.erPaaGulListe) {
          // console.log('🏛️ Building is on Gul liste!', result);
          setShowYellowBox(true);
        } else {
          // console.log('🏛️ Building is NOT on Gul liste');
          setShowYellowBox(false);
        }
      } catch (error) {
        logger.error('Error checking Gul liste:', error);
        setShowYellowBox(false); // Default to false on error
      } finally {
        setGulListeLoading(false);
      }
    };
    
    checkGulListe();
  }, [buildingData, hasCheckedGulListe]);

  const {
    start: eneboligStart,
    source: eneboligStartSource,
  } = useBuildingStartCoordinates(landingSnapshot?.enebolig, DEFAULT_ENEBOLIG_START, animateHouse, 'enebolig');

  const {
    start: blokkStart,
    source: blokkStartSource,
  } = useBuildingStartCoordinates(landingSnapshot?.blokk, DEFAULT_BLOKK_START, animateBlokk, 'blokk');

  // Handle building animation start
  React.useEffect(() => {
    if (!isEnebolig || animateHouse || !eneboligStart || overlayActiveForThisBuilding) {
      return;
    }

    const delay = eneboligStartSource === 'snapshot' ? 80 : 0;
    const timer = window.setTimeout(() => {
      setAnimateHouse(true);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isEnebolig, animateHouse, eneboligStart, eneboligStartSource, overlayActiveForThisBuilding]);

  React.useEffect(() => {
    if (isEnebolig || animateBlokk || !blokkStart || overlayActiveForThisBuilding) {
      return;
    }

    const delay = blokkStartSource === 'snapshot' ? 80 : 0;
    const timer = window.setTimeout(() => {
      setAnimateBlokk(true);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isEnebolig, animateBlokk, blokkStart, blokkStartSource, overlayActiveForThisBuilding]);
  
  // Shared viewport metrics (keeps layout in sync with landing page skyline)
  const { scaleFactor } = useFigmaViewportMetrics();

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
  }, [buildingKind, isEnebolig, overlayActiveForThisBuilding, scaleFactor, setTargetRect]);

  React.useEffect(() => {
    if (!recentlyCompleted) {
      return;
    }

    if (recentlyCompleted === 'enebolig') {
      setAnimateHouse(true);
    } else if (recentlyCompleted === 'blokk') {
      setAnimateBlokk(true);
    }
  }, [recentlyCompleted]);

  React.useEffect(() => {
    if (overlayPhase !== 'settling') {
      return;
    }

    const settleTimer = window.setTimeout(() => {
      finalizeTransition();
    }, DETAIL_FADE_DURATION_MS);

    return () => window.clearTimeout(settleTimer);
  }, [overlayPhase, finalizeTransition]);

  const eneboligStyle = React.useMemo<React.CSSProperties | null>(() => {
    if (!eneboligStart) {
      return null;
    }

    const forceFinalState = overlayActiveForThisBuilding && isEnebolig;
    const isFinal = animateHouse || forceFinalState;

    return {
      position: 'absolute',
      bottom: isFinal ? `${FINAL_BOTTOM_OFFSET + BUILDING_VERTICAL_LIFT}px` : `${eneboligStart.bottom}px`,
      left: isFinal ? FIGMA_ARTBOARD_CENTER_PX : `${eneboligStart.left}px`,
      transform: isFinal
        ? `translateX(${TARGET_TRANSLATION_PX}) scale(${ENEBOLIG_DETAIL_SCALE})`
        : 'translateX(0) scale(1)',
      transformOrigin: 'bottom left',
      transition: forceFinalState
        ? 'none'
        : 'transform 2s ease-in-out, bottom 2s ease-in-out, left 2s ease-in-out',
      zIndex: 3,
    };
  }, [animateHouse, eneboligStart, overlayActiveForThisBuilding, isEnebolig]);

  const blokkStyle = React.useMemo<React.CSSProperties | null>(() => {
    if (!blokkStart) {
      return null;
    }

    const forceFinalState = overlayActiveForThisBuilding && !isEnebolig;
    const isFinal = animateBlokk || forceFinalState;

    return {
      position: 'absolute',
      bottom: isFinal ? `${BLOKK_FINAL_BOTTOM_OFFSET + BUILDING_VERTICAL_LIFT}px` : `${blokkStart.bottom}px`,
      left: isFinal ? FIGMA_ARTBOARD_CENTER_PX : `${blokkStart.left}px`,
      transform: isFinal
        ? `translateX(${TARGET_TRANSLATION_PX}) scale(3)`
        : 'translateX(0) scale(1)',
      transformOrigin: 'bottom left',
      transition: forceFinalState
        ? 'none'
        : 'transform 2s ease-in-out, bottom 2s ease-in-out, left 2s ease-in-out',
      willChange: 'transform, bottom, left',
      zIndex: 3,
    };
  }, [animateBlokk, blokkStart, overlayActiveForThisBuilding, isEnebolig]);

  
  // Calculate dynamic font size based on address length
  const addressOnly = searchAddress.split(',')[0];
  
  // Calculate district name width for green box
  const districtName = buildingData.csvData?.bydelsnavn || 'Bydel';

  // Get building type name
  const defaultBuildingType = isEnebolig ? 'Enebolig' : 'Blokk';
  const buildingTypeName = buildingData.csvData?.bygningstypeNavn || buildingData.bygningstypeNavn || defaultBuildingType;

  // Get styles
  const layoutStyles = getLayoutStyles();
  const containerOpacity =
    overlayPhase === 'captured' || overlayPhase === 'animating' ? 0 : 1;
  const containerTransition =
    [
      allowProcessTransition ? 'transform 0.8s ease-in-out' : null,
      'opacity 0.4s ease-in-out',
    ]
      .filter(Boolean)
      .join(', ') || undefined;

  return (
    <>
      {/* Background container to fill entire viewport */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--pkt-color-brand-blue-300, #D1F9FF)',
        zIndex: 0
      }} />

      {/* Decorative corner element - fixed to viewport bottom-right (Oslo.kommune.no style) */}
      {/* White square with cyan circle inside - creates a "cut-out" effect */}
      {/* Hidden on mobile (viewport width <= 768px) via CSS class */}
      {showHeader && !isExpanded && (
        <div
          className="decorative-corner-element"
          style={{
            position: 'fixed',
            right: 0,
            bottom: 0,
            width: '120px',
            height: '120px',
            backgroundColor: 'var(--pkt-color-brand-neutrals-white, #ffffff)',
            zIndex: 1,
            opacity: showHeader && !isExpanded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out' + (showHeader && !isExpanded ? ' 0.5s' : isExpanded ? '' : ' 0.8s'),
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Cyan circle - same color as background, creates cut-out effect */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: 'var(--pkt-color-brand-blue-300, #D1F9FF)',
            }}
          />
        </div>
      )}
      <div className="figma-design-container" style={{ 
        ...layoutStyles.container, 
        overflow: 'visible',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: showProcess 
          ? `translate(-50%, calc(-50% - 100vh)) scale(${scaleFactor})` 
          : `translate(-50%, -50%) scale(${scaleFactor})`,
        transformOrigin: 'center',
        width: '1728px',
        height: '900px',
        zIndex: 2,
        background: 'transparent',
        opacity: containerOpacity,
        transition: containerTransition,
      }}>
        {/* Klimaoslo header with logo and back button */}
        <div 
          style={{
            position: 'absolute',
            width: '100%',
            height: '85px',
            top: '30px', // Positioned to maintain 30px gap with white box
            left: 0,
            opacity: showHeader && !isExpanded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out' + (showHeader && !isExpanded ? ' 0.5s' : isExpanded ? '' : ' 0.8s'),
            zIndex: 10001,
            pointerEvents: showHeader && !isExpanded ? 'auto' : 'none'
          }}
        >
        {/* Logo, title and back button stacked vertically */}
        <div style={{
          position: 'absolute',
          left: '156px', /* Sentrert layout - samme marg som tiltakslisten */
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <OsloLogo color="var(--pkt-color-brand-dark-blue-1000, #2a2859)" />
            <span style={{
              marginLeft: '24px',
              marginBottom: '6px',
              fontFamily: 'Oslo Sans, sans-serif',
              fontWeight: 300,
              fontSize: '24px',
              lineHeight: '40px',
              letterSpacing: '-0.2px',
              color: 'var(--pkt-color-brand-dark-blue-1000, #2a2859)'
            }}>
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
              // Remove any animated clones before going back
              const clones = document.querySelectorAll('div[style*="z-index: 9999"]');
              clones.forEach(clone => clone.remove());
              onBack();
            }}
          >
            Tilbake
          </PktButton>
        </div>
      </div>
      
      {/* Tiltak buttons */}
      <EnergySolutionButtons
        showHeader={showHeader}
        isExpanded={isExpanded}
        onExpand={setIsExpanded}
        onSelectSolution={setSelectedSolution}
        buildingData={{...updatedBuildingData, filteredSolarEnergy: solarData?.filteredSolarEnergy}}
        yearlyConsumption={energiforbruk}
        onTotalSavingsChange={setTotalEnergySavings}
        onSelectionChange={handleSelectionChange}
        audience={showYellowBox ? 'gulliste' : 'standard'}
      />
      
      {/* White circle background for building */}
      {showHeader && !isExpanded && (
        <div
          style={{
            position: 'absolute',
            /* Sentrert i layout med 24px Punkt-spacing:
             * Sirkel center: 156 + 488 + 24 + 260 = 928px
             * Bottom på linje med tiltakslisten og info box
             */
            left: '928px',
            bottom: `${FINAL_BOTTOM_OFFSET}px`,
            transform: 'translateX(-50%)',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            backgroundColor: 'var(--pkt-color-brand-neutrals-white, #ffffff)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
            zIndex: 2,
            opacity: showHeader && !isExpanded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out' + (showHeader && !isExpanded ? ' 0.5s' : isExpanded ? '' : ' 0.8s'),
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Building animation */}
      {isEnebolig && eneboligStyle && (
        <div ref={eneboligRef} style={eneboligStyle}>
          <Enebolig2LayerSvg
            activeTiltak={activeTiltak}
            arrowState={arrowState}
            arrowColor={arrowColor}
          />
        </div>
      )}
      {!isEnebolig && blokkStyle && (
        <div ref={blokkRef} style={blokkStyle}>
          <Blokk2LayerSvg
            activeTiltak={activeTiltak}
            arrowState={arrowState}
            arrowColor={arrowColor}
          />
        </div>
      )}


      {/* White info box */}
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
      />

      {activeTiltak.length > 0 && !isExpanded && (
        <div className="energy-solution-buttons__process-wrapper">
          <PktButton
            skin="secondary"
            size="medium"
            variant="icon-right"
            iconName="chevron-thin-down"
            onClick={() => setShowProcess(true)}
            className="energy-solution-buttons__process-btn--punkt"
          >
            Hvordan gjennomføre tiltakene
          </PktButton>
        </div>
      )}
    </div>
    
    {/* Prosessen videre component */}
    <ProsessenVidere 
      showProcess={showProcess}
      scaleFactor={scaleFactor}
      onBack={() => setShowProcess(false)}
      isGulliste={showYellowBox}
    />
    </>
  );
};


import React from 'react';
import { AddressLookupResponse } from '../services/buildingApi';
import { useAddressCoordinates } from './FigmaBlokk/hooks/useAddressCoordinates';
import { getLayoutStyles } from './FigmaBlokk/styles';
import { EnergySolutionButtons } from './FigmaBlokk/components/EnergySolutionButtons';
import { WhiteInfoBox } from './FigmaBlokk/components/WhiteInfoBox';
import { OsloLogo } from './FigmaBlokk/components/OsloLogo';
import { ProsessenVidere } from './FigmaBlokk/components/ProsessenVidere';
import { fetchSolarData, SolarEnergyData } from '../services/solarEnergyService';
import { sjekkGulListeMedGnrBnr } from '../services/gul-liste-service';
import { LYSEVEIEN_3_DATA } from '../testData/lyseveien3';
import { THERESES_11A_DATA } from '../testData/theresegate11a';
import { calculateAnnualEnergyConsumption, determineBuildingType } from '../utils/tekEnergyCalculations';
import { THERESES_44A_DATA } from '../testData/theresegate44a';
import { useFigmaViewportMetrics } from './FigmaBlokk/hooks/useFigmaViewportMetrics';
import { EneboligSvg, BlokkSvg } from './FigmaBlokk/components/BuildingSprites';
import type { LandingSnapshot, BuildingSnapshot } from '../hooks/useFigmaAddressSearch';
import { useTransitionOverlay, toViewportRect } from '../context/useTransitionOverlay';

const FIGMA_ARTBOARD_WIDTH = 1728;
const FIGMA_ARTBOARD_CENTER = FIGMA_ARTBOARD_WIDTH / 2;
const ENEBOLIG_START_LEFT = 289;
const BLOKK_START_LEFT = 1051;
const TARGET_TRANSLATION_X = 235.5 + 74;
const FIGMA_ARTBOARD_CENTER_PX = `${FIGMA_ARTBOARD_CENTER}px`;
const TARGET_TRANSLATION_PX = `${TARGET_TRANSLATION_X}px`;
const FINAL_BOTTOM_OFFSET = 55;
const SNAPSHOT_RESOLUTION_TIMEOUT_MS = 250;
const DETAIL_FADE_DURATION_MS = 450;

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
    snapshot ? { left: snapshot.left, bottom: snapshot.bottom } : null,
  );
  const [source, setSource] = React.useState<StartSource | null>(snapshot ? 'snapshot' : null);
  const fallbackTimerRef = React.useRef<number | null>(null);
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  React.useEffect(() => {
    if (lockUpdates || !snapshot) {
      return;
    }

    setStart({ left: snapshot.left, bottom: snapshot.bottom });
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
  const mapCoordinates = useAddressCoordinates(searchAddress);
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
  
  // Delay enabling long transform transitions until after first paint to avoid initial jumps
  const [allowProcessTransition, setAllowProcessTransition] = React.useState(false);
  React.useEffect(() => {
    setAllowProcessTransition(true);
  }, []);


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
  
  // Track if solar data has been fetched
  const [hasFetchedSolarData, setHasFetchedSolarData] = React.useState(false);
  
  // Fetch solar data when component mounts
  React.useEffect(() => {
    // Only fetch once per component lifecycle
    if (hasFetchedSolarData || !buildingData) return;
    
    const loadSolarData = async () => {
      setHasFetchedSolarData(true);
      
      // TEST MODE: Check if this is test data
      if (searchAddress === "Lyseveien 3, 0362 OSLO" && buildingData.gnr === 33 && buildingData.bnr === 1139) {
        // console.log('🧪 [TEST MODE] Using cached solar data for Lyseveien 3');
        setSolarData(LYSEVEIEN_3_DATA.solarData);
        return;
      } else if (searchAddress === "Thereses gate 11A, 0358 OSLO" && buildingData.gnr === 215 && buildingData.bnr === 156) {
        // console.log('🧪 [TEST MODE] Using cached solar data for Thereses gate 11A');
        setSolarData(THERESES_11A_DATA.solarData);
        return;
      } else if (searchAddress === "Thereses gate 44A, 0168 OSLO" && buildingData.gnr === 215 && buildingData.bnr === 278) {
        // console.log('🧪 [TEST MODE] Using cached solar data for Thereses gate 44A');
        setSolarData(THERESES_44A_DATA.solarData);
        return;
      }
      
      const params: Parameters<typeof fetchSolarData>[0] = {
        gnr: buildingData.gnr,
        bnr: buildingData.bnr,
        seksjonsnummer: buildingData.seksjonsnummer,
        byggId: buildingData.byggId,
        representasjonspunkt: buildingData.representasjonspunkt
      };
      
      // console.log('🌞 Fetching solar data with params:', params);
      const data = await fetchSolarData(params);
      if (data) {
        // console.log('🌞 Solar data received:', data);
        setSolarData(data);
      }
    };
    
    loadSolarData();
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
        console.error('🏛️ Error checking Gul liste:', error);
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
      bottom: isFinal ? `${FINAL_BOTTOM_OFFSET}px` : `${eneboligStart.bottom}px`,
      left: isFinal ? FIGMA_ARTBOARD_CENTER_PX : `${eneboligStart.left}px`,
      transform: isFinal
        ? `translateX(${TARGET_TRANSLATION_PX}) scale(5)`
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
      bottom: isFinal ? `${FINAL_BOTTOM_OFFSET}px` : `${blokkStart.bottom}px`,
      left: isFinal ? FIGMA_ARTBOARD_CENTER_PX : `${blokkStart.left}px`,
      transform: isFinal
        ? `translateX(${TARGET_TRANSLATION_PX}) scale(3)`
        : 'translateX(0) scale(1)',
      transformOrigin: 'bottom left',
      transition: forceFinalState
        ? 'none'
        : 'transform 2s ease-in-out, bottom 2s ease-in-out, left 2s ease-in-out',
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
        backgroundColor: '#034B45',
        zIndex: 0
      }} />
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
        <div style={{
          position: 'absolute',
          left: 'calc(50% - 235.5px - 74px - 336px)', // Same as white info box
          right: '40px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <OsloLogo />
            <span style={{
              marginLeft: '24px',
              marginBottom: '6px',
              fontFamily: 'Oslo Sans, sans-serif',
              fontWeight: 300,
              fontSize: '24px',
              lineHeight: '40px',
              letterSpacing: '-0.2px',
              color: 'white'
            }}>
              Energinøkkelen
            </span>
          </div>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Remove any animated clones before going back
              const clones = document.querySelectorAll('div[style*="z-index: 9999"]');
              clones.forEach(clone => clone.remove());
              onBack();
            }}
            style={{
              position: 'relative',
              background: 'transparent',
              border: '2px solid #F9F9F9',
              color: '#F9F9F9',
              padding: '11px 18px',
              fontFamily: 'Oslo Sans, sans-serif',
              fontWeight: 500,
              fontSize: '18px',
              lineHeight: '28px',
              letterSpacing: '-0.2px',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '0',
              zIndex: 100
            }}
          >
            <span style={{ marginRight: 'auto' }}>Tilbake</span>
            <svg 
              width="24" 
              height="29" 
              viewBox="0 0 24 29" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              style={{ marginLeft: '18px', marginRight: '18px' }}
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M9.09996 16.5539L7.49995 18.2472L2 12.3207L7.49995 6.5L9.09996 8.19329L6.29999 11.1566H19.4H21.6V13.4849V14.8961V19.0938V20.505V22.8333H19.4H9.8397V20.505H19.4V19.0938V14.8961V13.4849H6.19999L9.09996 16.5539Z" fill="white"/>
            </svg>
          </button>
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
        onProcessClick={() => setShowProcess(true)}
        onTotalSavingsChange={setTotalEnergySavings}
      />
      
      {/* Building animation */}
      {isEnebolig && eneboligStyle && (
        <div ref={eneboligRef} style={eneboligStyle}>
          <EneboligSvg />
        </div>
      )}
      {!isEnebolig && blokkStyle && (
        <div ref={blokkRef} style={blokkStyle}>
          <BlokkSvg />
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
        buildingData={updatedBuildingData}
        onExpand={setIsExpanded}
        showYellowBox={showYellowBox}
        gulListeLoading={gulListeLoading}
        onUpdateBuildingData={handleUpdateBuildingData}
        totalEnergySavings={totalEnergySavings}
      />
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

import React from 'react';
import { LocationPin } from './LocationPin';
import * as EnergySolutions from './Tiltak/index';
import { calculateAnnualEnergyConsumption, determineBuildingType } from '../../../utils/tekEnergyCalculations';
import { convertKwhToNok, formatCurrency, formatNumberWithSpaces } from '../../../utils/energy';
import { AddressLookupResponse } from '../../../services/buildingApi';

const MAP_WIDTH = 336;
const MAP_HEIGHT = 204;
const MAP_TOP_Y = 496;
const SAVINGS_CARD_HEIGHT = 132;
const SAVINGS_CARD_BOTTOM_GAP = 24;
const MIN_CONTENT_TO_CARD_GAP = 40;
const MIN_MAP_CLEARANCE = 6;
const BASE_INFO_Y = 204;
const INFO_ROW_GAP = 28;
const INPUT_BASELINE_OFFSET = 18;

const roundToNearestThousandValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value / 1000) * 1000;
};

const roundToNearestThousand = (value: number): string => {
  return formatNumberWithSpaces(roundToNearestThousandValue(value));
};

interface WhiteInfoBoxProps {
  showHeader: boolean;
  isExpanded: boolean;
  selectedSolution: string | null;
  addressOnly: string;
  districtName: string;
  buildingTypeName: string;
  mapCoordinates: { lat: number; lng: number } | null;
  buildingData: AddressLookupResponse;
  onExpand?: (expanded: boolean) => void;
  showYellowBox?: boolean;
  onUpdateBuildingData?: (byggeaar: string, areal: string, arealLeilighet: string, energiforbruk: string) => void;
  totalEnergySavings?: number;
  gulListeLoading?: boolean;
  energyPricePerKwh?: number;
  animateSavings?: boolean;
}

interface EnergySolutionProps {
  onBack?: () => void;
  buildingType?: string;
  buildingData?: AddressLookupResponse;
}

export const WhiteInfoBox: React.FC<WhiteInfoBoxProps> = ({
  showHeader,
  isExpanded,
  selectedSolution,
  addressOnly,
  districtName,
  buildingTypeName,
  mapCoordinates,
  buildingData,
  onExpand,
  showYellowBox = true,
  onUpdateBuildingData,
  totalEnergySavings = 0,
  gulListeLoading = false,
  energyPricePerKwh = 1.1,
  animateSavings = true
}) => {
  // State for delayed height expansion
  const [expandHeight, setExpandHeight] = React.useState(false);
  
  const shouldShowYellowBox = showYellowBox && !gulListeLoading;
  const [isGulListeInfoOpen, setIsGulListeInfoOpen] = React.useState(false);
  const [isDropdownExpanded, setIsDropdownExpanded] = React.useState(false);
  const [showDropdownContent, setShowDropdownContent] = React.useState(false);
  const [showByantikvarTooltip, setShowByantikvarTooltip] = React.useState(false);
  const [showKommunaltTooltip, setShowKommunaltTooltip] = React.useState(false);
  const [showVernetTooltip, setShowVernetTooltip] = React.useState(false);
  const [showFredetTooltip, setShowFredetTooltip] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const DROPDOWN_EXPANSION_ADJUSTMENT = 50;
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hasShownSavings, setHasShownSavings] = React.useState(false);
  const [displayedSavings, setDisplayedSavings] = React.useState(0);
  const savingsAnimationFrame = React.useRef<number | null>(null);
  const previousSavingsRef = React.useRef(0);
  
  // Check if building has Enova energy certificate
  const hasEnovaRating = buildingData?.energiattest?.energikarakter ? true : false;
  const shouldShowSavingsCard = totalEnergySavings > 0;
  const isApartmentBuilding =
    buildingTypeName === 'Store boligbygg' || buildingTypeName.toLowerCase() === 'blokk';
  const isBlockBuilding = buildingTypeName.toLowerCase() === 'blokk';
  const roundedSavingsKwh = React.useMemo(
    () => roundToNearestThousandValue(totalEnergySavings),
    [totalEnergySavings]
  );
  const roundedSavingsNok = React.useMemo(
    () => roundToNearestThousandValue(convertKwhToNok(totalEnergySavings, energyPricePerKwh)),
    [totalEnergySavings, energyPricePerKwh]
  );
  const formattedSavingsKwh = React.useMemo(
    () => formatNumberWithSpaces(roundedSavingsKwh),
    [roundedSavingsKwh]
  );
  const formattedSavingsCurrency = React.useMemo(
    () => formatCurrency(roundedSavingsNok),
    [roundedSavingsNok]
  );
  
  const renderVernestatusRow = (yPosition: number | string) => {
    const parsedY = typeof yPosition === 'string' ? Number(yPosition) : yPosition;
    const yValue = Number.isFinite(parsedY) ? parsedY : 0;
    const top = yValue - 22;

    return (
      <foreignObject x="30" y={top} width="280" height="32">
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5ch',
            fontFamily: 'Oslo Sans, sans-serif',
            fontSize: '18px',
            lineHeight: '28px',
            letterSpacing: '-0.2px',
            color: '#2A2859'
          }}
        >
          <span style={{ fontWeight: 300 }}>Vernestatus:</span>
          <span style={{ fontWeight: 500 }}>Gul liste</span>
          <button
            type="button"
            onClick={() => {
              setIsGulListeInfoOpen(true);
              setIsDropdownExpanded(false);
              setShowDropdownContent(false);
              setShowByantikvarTooltip(false);
              setShowKommunaltTooltip(false);
              setShowVernetTooltip(false);
              setShowFredetTooltip(false);
            }}
            title="Hva betyr Gul liste?"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#FFC857',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '16px',
              lineHeight: '22px',
              marginLeft: '0.25ch',
              border: 'none',
              padding: 0,
              cursor: 'pointer'
            }}
          >
            !
          </button>
        </div>
      </foreignObject>
    );
  };

  const renderEnergyBlock = (
    yPosition: number,
    {
      displayValue,
      editableValue,
      editable,
      onChange
    }: {
      displayValue: string;
      editable?: boolean;
      editableValue?: string;
      onChange?: (nextValue: string) => void;
    }
  ) => (
    <foreignObject x="30" y={yPosition} width="276" height={editable ? 80 : 60}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontFamily: 'Oslo Sans, sans-serif'
        }}
      >
        <span
          style={{
            fontSize: '18px',
            letterSpacing: '-0.2px',
            color: '#2A2859'
          }}
        >
          Estimert energiforbruk:
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            flexWrap: 'nowrap'
          }}
        >
          {editable ? (
            <div
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                borderBottom: '1px solid #2A2859',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '6px',
                paddingBottom: '2px'
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                value={editableValue ?? ''}
                onChange={(event) => {
                  if (!onChange) {
                    return;
                  }
                  const numericValue = event.target.value.replace(/[^0-9]/g, '');
                  onChange(numericValue);
                }}
                style={{
                  flex: '1 1 auto',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 500,
                  letterSpacing: '-0.2px',
                  color: '#2A2859',
                  background: 'transparent',
                  padding: 0,
                  outline: 'none'
                }}
              />
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  letterSpacing: '-0.2px',
                  color: '#2A2859',
                  whiteSpace: 'nowrap'
                }}
              >
                kWh/år
              </span>
            </div>
          ) : (
            <>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  letterSpacing: '-0.2px',
                  color: '#2A2859'
                }}
              >
                {displayValue}
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  letterSpacing: '-0.2px',
                  color: '#2A2859',
                  whiteSpace: 'nowrap'
                }}
              >
                kWh/år
              </span>
            </>
          )}
        </div>
      </div>
    </foreignObject>
  );

  React.useEffect(() => {
    if (shouldShowSavingsCard && !hasShownSavings) {
      setHasShownSavings(true);
    }
  }, [shouldShowSavingsCard, hasShownSavings]);

  React.useEffect(() => {
    if (!shouldShowSavingsCard) {
      return;
    }

    const target = roundedSavingsNok;

    if (!animateSavings || prefersReducedMotion) {
      previousSavingsRef.current = target;
      setDisplayedSavings(target);
      return;
    }

    const startValue = previousSavingsRef.current;
    if (startValue === target) {
      return;
    }

    const duration = 900;
    const startTime = performance.now();

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(
        startValue + (target - startValue) * easedProgress
      );
      setDisplayedSavings(nextValue);

      if (progress < 1) {
        savingsAnimationFrame.current = requestAnimationFrame(tick);
      } else {
        previousSavingsRef.current = target;
        savingsAnimationFrame.current = null;
      }
    };

    savingsAnimationFrame.current = requestAnimationFrame(tick);

    return () => {
      if (savingsAnimationFrame.current !== null) {
        cancelAnimationFrame(savingsAnimationFrame.current);
        savingsAnimationFrame.current = null;
      }
    };
  }, [
    roundedSavingsNok,
    animateSavings,
    prefersReducedMotion,
    shouldShowSavingsCard
  ]);

  React.useEffect(() => {
    return () => {
      if (savingsAnimationFrame.current !== null) {
        cancelAnimationFrame(savingsAnimationFrame.current);
      }
    };
  }, []);
  
  // State for address text scaling
  const [addressScale, setAddressScale] = React.useState(1);
  const textRef = React.useRef<SVGTextElement>(null);
  
  // Calculate dynamic box widths based on text length
  const calculateTextWidth = (text: string, fontSize: number = 14): number => {
    // More accurate character widths for different characters
    let width = 0;
    for (const char of text) {
      if (char === ' ') width += fontSize * 0.25;
      else if (char === '.' || char === 'i' || char === 'l') width += fontSize * 0.3;
      else if (char.toUpperCase() === char && char !== ' ') width += fontSize * 0.7; // Uppercase
      else width += fontSize * 0.5; // Lowercase
    }
    return width;
  };
  
  const dynamicDistrictWidth = Math.max(
    100, // Minimum width
    Math.ceil(calculateTextWidth(districtName) + 52) // text width + icon (36px) + padding (16px)
  );

  // Use the display text for width calculation
  const displayBuildingTypeName =
    buildingTypeName === 'Store boligbygg' ? 'Blokk' : buildingTypeName;
  const dynamicBuildingTypeWidth =
    displayBuildingTypeName === 'Blokk'
      ? 80 // Manuell bredde for "Blokk" - endre denne verdien
      : Math.max(
          100, // Minimum width
          Math.ceil(calculateTextWidth(displayBuildingTypeName) + 43) // 14 (left padding) + 15 (icon) + 7 (gap) + text + 7 (right padding)
        );

  const [savedByggeaar, setSavedByggeaar] = React.useState(
    String(buildingData?.byggeaar || '')
  );
  const [savedAreal, setSavedAreal] = React.useState(
    String(buildingData?.bruksarealM2 || '')
  );
  const [savedArealLeilighet, setSavedArealLeilighet] = React.useState(
    String(buildingData?.arealLeilighet || '')
  );
  // Calculate estimated energy consumption based on TEK or energy rating
  // Use saved values if available (they might have been edited)
  const estimatedConsumption = React.useMemo(() => {
    const rawByggeaar = savedByggeaar || buildingData?.byggeaar?.toString() || buildingData?.csvData?.byggeaar;
    const parsedByggeaar = rawByggeaar ? Number(rawByggeaar) : undefined;

    const rawBruksareal =
      savedAreal ||
      (typeof buildingData?.bruksarealM2 === 'number'
        ? buildingData.bruksarealM2.toString()
        : undefined) ||
      buildingData?.csvData?.bruksareal_totalt;

    const bruksareal = rawBruksareal ? Number(rawBruksareal) : undefined;
    const buildingType = determineBuildingType(
      buildingData?.bygningstypeKode,
      buildingTypeName
    );
    
    // If building is apartment/large building and has energy rating, estimate based on that
    if ((buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && 
        buildingData?.energiattest?.energikarakter && bruksareal && bruksareal > 0) {
      const energikarakter = buildingData.energiattest.energikarakter;
      
      // Get energy intensity thresholds from JSON file for apartments
      const thresholds: Record<string, number> = {
        'A': 85 + 600 / bruksareal,
        'B': 95 + 1000 / bruksareal,
        'C': 100 + 1500 / bruksareal,
        'D': 135 + 2200 / bruksareal,
        'E': 160 + 3000 / bruksareal,
        'F': 200 + 4000 / bruksareal,
        'G': 250 + 5000 / bruksareal // Use higher value for G
      };
      
      // Use the threshold for the current rating as the estimated intensity
      const estimatedIntensity = thresholds[energikarakter] || thresholds['E'];
      
      // Calculate total consumption: intensity * area
      return Math.round(estimatedIntensity * bruksareal);
    }
    
    // Otherwise use TEK-based calculation
    return calculateAnnualEnergyConsumption(parsedByggeaar, bruksareal, buildingType);
  }, [savedByggeaar, savedAreal, buildingData, buildingTypeName]);
  
  const [savedEnergiforbruk, setSavedEnergiforbruk] = React.useState(
    String(buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh || estimatedConsumption)
  );
  const [editedByggeaar, setEditedByggeaar] = React.useState(savedByggeaar);
  const [editedAreal, setEditedAreal] = React.useState(savedAreal);
  const [editedArealLeilighet, setEditedArealLeilighet] = React.useState(savedArealLeilighet);
  const [editedEnergiforbruk, setEditedEnergiforbruk] = React.useState(savedEnergiforbruk);
  
  // Track if user has manually edited energy consumption
  const [hasUserEditedEnergy, setHasUserEditedEnergy] = React.useState(false);
  const savedEnergyDisplayValue = React.useMemo(() => {
    const numeric = Number(savedEnergiforbruk || '0');
    if (!Number.isFinite(numeric)) {
      return '0';
    }
    if (hasEnovaRating && !isApartmentBuilding) {
      return roundToNearestThousand(numeric);
    }
    return formatNumberWithSpaces(Math.round(numeric));
  }, [savedEnergiforbruk, hasEnovaRating, isApartmentBuilding]);
  
  // Update saved energy consumption when estimated value changes (only if user hasn't edited it)
  React.useEffect(() => {
    // For apartments/large buildings with energy rating, always use our estimate
    if ((buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && 
        buildingData?.energiattest?.energikarakter && !hasUserEditedEnergy) {
      setSavedEnergiforbruk(String(estimatedConsumption));
      setEditedEnergiforbruk(String(estimatedConsumption));
    } 
    // For other cases, only update if no Enova data exists
    else if (!buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh && !hasUserEditedEnergy) {
      setSavedEnergiforbruk(String(estimatedConsumption));
      setEditedEnergiforbruk(String(estimatedConsumption));
    }
  }, [estimatedConsumption, buildingData, buildingTypeName, hasUserEditedEnergy]);
  
  // Recalculate energy consumption when building year or area changes in edit mode (only if user hasn't edited it)
  React.useEffect(() => {
    if (isEditMode && !buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh && !hasUserEditedEnergy) {
      const buildingType = determineBuildingType(
        buildingData?.bygningstypeKode,
        buildingTypeName
      );
      const newEstimate = calculateAnnualEnergyConsumption(editedByggeaar, editedAreal, buildingType);
      setEditedEnergiforbruk(String(newEstimate));
    }
  }, [editedByggeaar, editedAreal, isEditMode, buildingData, buildingTypeName, hasUserEditedEnergy]);
  
  // Calculate input width based on content
  const calculateInputWidth = (value: string) => {
    const minWidth = 60; // Increased min width for better appearance
    const charWidth = 10; // Increased for 18px font to prevent scrolling
    const padding = 20; // Extra padding for cursor and breathing room
    return Math.max(minWidth, value.length * charWidth + padding);
  };

  const energyBlockHeight = isEditMode ? 80 : 60;
  const trimmedApartmentArea = (savedArealLeilighet || '').trim();
  const hasApartmentAreaValue = trimmedApartmentArea.length > 0;
  const shouldShowApartmentAreaRow = isBlockBuilding && (isEditMode || hasApartmentAreaValue);

  const infoLayout = React.useMemo(() => {
    let cursor = BASE_INFO_Y;
    const byggeaarY = cursor;
    cursor += INFO_ROW_GAP;

    const arealY = cursor;
    cursor += INFO_ROW_GAP;

    let eierTypeY: number | null = null;
    if (isBlockBuilding) {
      eierTypeY = cursor;
      cursor += INFO_ROW_GAP;
    }

    let vernestatusY: number | null = null;
    if (shouldShowYellowBox) {
      vernestatusY = cursor;
      cursor += INFO_ROW_GAP;
    }

    let apartmentAreaY: number | null = null;
    if (shouldShowApartmentAreaRow) {
      apartmentAreaY = cursor;
      cursor += INFO_ROW_GAP;
    }

    const lastInfoBaseline =
      (shouldShowApartmentAreaRow && apartmentAreaY !== null)
        ? apartmentAreaY
        : shouldShowYellowBox && vernestatusY !== null
          ? vernestatusY
          : isBlockBuilding && eierTypeY !== null
            ? eierTypeY
            : arealY;

    return {
      byggeaarY,
      arealY,
      eierTypeY,
      vernestatusY,
      apartmentAreaY,
      lastInfoBaseline
    };
  }, [isBlockBuilding, shouldShowYellowBox, shouldShowApartmentAreaRow]);

  const {
    byggeaarY,
    arealY,
    eierTypeY,
    vernestatusY,
    apartmentAreaY,
    lastInfoBaseline
  } = infoLayout;

  const energyInfoTop = (lastInfoBaseline ?? arealY) + INFO_ROW_GAP;
  const energyBlockBottom = energyInfoTop + energyBlockHeight;
  const precedingContentBottom = energyBlockBottom;
  const anchoredCardTop = MAP_TOP_Y - SAVINGS_CARD_HEIGHT - SAVINGS_CARD_BOTTOM_GAP;
  const minimumCardTop = precedingContentBottom + MIN_CONTENT_TO_CARD_GAP;
  const maxCardTopBeforeMap = MAP_TOP_Y - SAVINGS_CARD_HEIGHT - MIN_MAP_CLEARANCE;
  let savingsCardY: number;

  if (maxCardTopBeforeMap <= minimumCardTop) {
    savingsCardY = maxCardTopBeforeMap;
  } else {
    savingsCardY = Math.min(Math.max(anchoredCardTop, minimumCardTop), maxCardTopBeforeMap);
  }
  const shouldAnimateSavingsCardIntro =
    shouldShowSavingsCard && !hasShownSavings && animateSavings && !prefersReducedMotion;

  // Call the callback with initial values when component mounts or when savedEnergiforbruk changes
  React.useEffect(() => {
    if (!onUpdateBuildingData) {
      return;
    }
    onUpdateBuildingData(savedByggeaar, savedAreal, savedArealLeilighet, savedEnergiforbruk);
  }, [
    onUpdateBuildingData,
    savedAreal,
    savedArealLeilighet,
    savedByggeaar,
    savedEnergiforbruk,
  ]); // Update when energy consumption changes
  
  // Calculate address text scaling
  React.useEffect(() => {
    if (textRef.current && addressOnly) {
      // Temporarily set to default size to measure
      textRef.current.setAttribute('font-size', '36');
      const bbox = textRef.current.getBBox();
      const naturalWidth = bbox.width;
      
      // Calculate scale to fit within box with 30px margins
      const availableWidth = 336 - 60; // 30px margin on each side
      const scale = Math.min(1, availableWidth / naturalWidth);
      
      setAddressScale(scale);
    }
  }, [addressOnly]);

  React.useEffect(() => {
    if (isDropdownExpanded) {
      const timer = setTimeout(() => {
        setShowDropdownContent(true);
      }, 300);
      return () => clearTimeout(timer);
    }
    setShowDropdownContent(false);
  }, [isDropdownExpanded]);
  
  // Handle sequential animation - expand height after width
  React.useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        setExpandHeight(true);
      }, 800);
      return () => clearTimeout(timer);
    }

    setExpandHeight(false);
    return undefined;
  }, [isExpanded]);
  
  // Calculate expanded height to fill screen with equal margins
  // Total container height is 900px, current bottom is 55px
  const expandedBottom = 55; // Keep same bottom position
  
  // Get the component for the selected solution
  const getSolutionComponent = () => {
    if (!selectedSolution) return null;
    
  const componentMap: Record<string, React.ComponentType<EnergySolutionProps>> = {
    'Varmepumpe': (shouldShowYellowBox ? EnergySolutions.VarmepumpeGul : EnergySolutions.Varmepumpe) as React.ComponentType<EnergySolutionProps>,
    'Solenergi': (shouldShowYellowBox ? EnergySolutions.SolenergiGul : EnergySolutions.Solenergi) as React.ComponentType<EnergySolutionProps>,
    'Tetting': (shouldShowYellowBox ? EnergySolutions.TettingGul : EnergySolutions.Tetting) as React.ComponentType<EnergySolutionProps>,
    'Temperaturstyring': (shouldShowYellowBox ? EnergySolutions.TemperaturstyringGul : EnergySolutions.Temperaturstyring) as React.ComponentType<EnergySolutionProps>,
    'Oppgradering av vindu': (shouldShowYellowBox ? EnergySolutions.UtskiftningAvVinduGul : EnergySolutions.UtskiftningAvVindu) as React.ComponentType<EnergySolutionProps>,
    'Isolering av kjeller og loft': (shouldShowYellowBox ? EnergySolutions.IsoleringAvKjellerOgLoftGul : EnergySolutions.IsoleringAvKjellerOgLoft) as React.ComponentType<EnergySolutionProps>,
    'Etterisolering av yttervegg': (shouldShowYellowBox ? EnergySolutions.EtterisoleringYtterveggGul : EnergySolutions.EtterisoleringYttervegg) as React.ComponentType<EnergySolutionProps>,
    'Ventilasjon': (shouldShowYellowBox ? EnergySolutions.VentilasjonGul : EnergySolutions.Ventilasjon) as React.ComponentType<EnergySolutionProps>
  };
    
    const Component = componentMap[selectedSolution];
    if (!Component) return null;
    
    // Pass onBack prop to Tetting, Temperaturstyring, Solenergi, Oppgradering av vindu, Etterisolering av yttervegg, Isolering av kjeller og loft, Ventilasjon, and Varmepumpe
    if (selectedSolution === 'Tetting' || selectedSolution === 'Temperaturstyring' || selectedSolution === 'Solenergi' || selectedSolution === 'Oppgradering av vindu' || selectedSolution === 'Etterisolering av yttervegg' || selectedSolution === 'Isolering av kjeller og loft' || selectedSolution === 'Ventilasjon' || selectedSolution === 'Varmepumpe') {
      return <Component onBack={() => onExpand && onExpand(false)} buildingType={buildingTypeName} buildingData={buildingData} />;
    }
    
    return <Component />;
  };
  
  return (
    <div
      style={{
        position: 'absolute',
        left: 'calc(50% - 235.5px - 74px - 336px)',
        bottom: `${expandedBottom}px`,
        width: 840,
        height: 790,
        clipPath: expandHeight 
          ? 'inset(0 0 0 0)'  // Fully expanded
          : isExpanded 
            ? 'inset(90px 0 0 0)'  // Width expanded, height not
            : 'inset(90px 504px 0 0)',  // Fully collapsed
        opacity: showHeader ? 1 : 0,
        transition: `opacity 1s ease-in-out 0.5s, clip-path ${
          expandHeight && isExpanded ? '0.6s' : '0.8s'
        } ease-in-out ${
          expandHeight && isExpanded ? '0s' : '0s'
        }`,
        zIndex: 1000,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <svg
          width="840"
          height="790"
          viewBox={`0 -90 840 790`}
          preserveAspectRatio="xMinYMin meet"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
          }}
        >
      <rect width="840" height="790" y="-90" fill="white"/>
      <g clipPath="url(#clip0_325_12689)">
        <g style={{ opacity: isExpanded ? 0 : 1, transition: isExpanded ? 'opacity 0.3s ease-in-out' : 'opacity 0.5s ease-in-out 0.5s' }}>
        {/* Address text with proportional scaling */}
        <text 
          ref={textRef}
          x="30" 
          y="72" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="500"
          fontStyle="normal"
          fontSize={36 * addressScale} 
          letterSpacing="-0.2"
          fill="#2A2859"
          textAnchor="start"
        >
          {addressOnly}
        </text>
        <rect width={dynamicDistrictWidth} height="30" transform="translate(30 94)" fill="#C7F6C9"/>
        <path d="M44.7913 104.75C44.7913 105.302 45.2393 105.75 45.7913 105.75C46.3433 105.75 46.7913 105.302 46.7913 104.75C46.7913 104.198 46.3433 103.75 45.7913 103.75C45.2393 103.75 44.7913 104.198 44.7913 104.75Z" fill="#2A2859"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M42.32 104.804C42.32 102.886 43.874 101.332 45.7915 101.332C47.7086 101.332 49.263 102.887 49.263 104.804C49.263 105.421 49.1009 106.016 48.7931 106.547L53.7838 110.112L51.0298 113.416L47.8308 113.873L45.3703 116.825L38.1543 111.671L40.9083 108.366L43.7566 107.959L42.8624 106.668C42.51 106.116 42.32 105.473 42.32 104.804ZM46.997 109.218L48.239 107.38L52.3253 110.299L50.9016 112.007L46.997 109.218ZM45.8276 110.948L46.4369 110.047L49.9548 112.559L47.4959 112.911L42.2737 109.181L44.3935 108.878L45.8276 110.948ZM48.263 104.804C48.263 103.439 47.1563 102.332 45.7915 102.332C44.4263 102.332 43.32 103.439 43.32 104.804C43.32 105.281 43.4549 105.737 43.6949 106.114L45.8173 109.177L47.8769 106.13C48.1027 105.776 48.2348 105.371 48.2589 104.946L48.263 104.804ZM46.7501 113.607L41.1662 109.618L39.6123 111.483L45.1958 115.471L46.7501 113.607Z" fill="#2A2859"/>
        <text 
          x="66" 
          y="114" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="400"
          fontStyle="normal"
          fontSize="14" 
          letterSpacing="-0.2"
          fill="#2A2859"
        >
          {districtName}
        </text>
        
        <rect width={dynamicBuildingTypeWidth} height="30" transform={`translate(${30 + dynamicDistrictWidth + 8} 94)`} fill="#D1F9FF"/>
        {/* Building type icon */}
        <g transform={`translate(${30 + dynamicDistrictWidth + 8 + 14} 101)`}>
          <path fillRule="evenodd" clipRule="evenodd" d="M13.5 14.43V0.429993H5.5V2.92999H1V14.43H0V15.43H15V14.43H13.5ZM5.5 14.43H4V11.43H5.5V14.43ZM7.5 14.43H6.5V10.43H3V14.43H2V3.92999H7.5V14.43ZM12.5 14.43H8.5V13.43H11.5V12.43H8.5V11.43H11.5V10.43H8.5V9.42999H11.5V8.42999H8.5V7.42999H11.5V6.42999H8.5V5.42999H11.5V4.42999H8.5V3.42999H11.5V2.42999H7.5V2.92999H6.5V1.42999H12.5V14.43Z" fill="#2A2859"/>
          <path d="M3 7.86499H4V8.93499H3V7.86499ZM5.5 7.86499H6.5V8.93499H5.5V7.86499ZM3 5.35999H4V6.42999H3V5.35999ZM5.5 5.35999H6.5V6.42999H5.5V5.35999Z" fill="#2A2859"/>
        </g>
        <text 
          x={30 + dynamicDistrictWidth + 8 + 36} 
          y="114" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="400"
          fontStyle="normal"
          fontSize="14" 
          letterSpacing="-0.2"
          fill="#2A2859"
        >
          {displayBuildingTypeName}
        </text>
        
        {/* Nøkkelinformasjon text */}
        <text 
          x="30" 
          y="160" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="500"
          fontStyle="normal"
          fontSize="20" 
          letterSpacing="-0.2"
          fill="#2A2859"
        >
          Nøkkelinformasjon
        </text>
        
        {/* Edit text and icon next to title */}
        <g 
          style={{ cursor: 'pointer' }}
          onClick={() => {
            if (isEditMode) {
              // Save changes
              setSavedByggeaar(editedByggeaar);
              setSavedAreal(editedAreal);
              setSavedArealLeilighet(editedArealLeilighet);
              setSavedEnergiforbruk(editedEnergiforbruk);
              setIsEditMode(false);
              // Call the callback to update parent component
              if (onUpdateBuildingData) {
                onUpdateBuildingData(editedByggeaar, editedAreal, editedArealLeilighet, editedEnergiforbruk);
              }
            } else {
              // Enter edit mode
              setEditedByggeaar(savedByggeaar);
              setEditedAreal(savedAreal);
              setEditedArealLeilighet(savedArealLeilighet);
              setEditedEnergiforbruk(savedEnergiforbruk);
              setIsEditMode(true);
              setHasUserEditedEnergy(false); // Reset when entering edit mode
            }
          }}
        >
          <rect x="218" y="138" width="120" height="32" fill="transparent" />
          <text 
            x="230" 
            y="160" 
            fontFamily="Oslo Sans, sans-serif" 
            fontWeight="400"
            fontStyle="normal"
            fontSize="16" 
              letterSpacing="-0.2"
            fill="#2A2859"
          >
            ({isEditMode ? 'Lagre' : 'Rediger'}
          </text>
          <svg x="300" y="148" width="16" height="20" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M19.5517 5.91012L16.0242 2.38184L5.73471 12.6705L4.51004 17.4114L9.25105 16.1875L9.97883 15.4598L16.982 8.47811L16.9828 8.47895L17.5252 7.93657L17.8668 7.59598L17.8663 7.59546L19.5517 5.91012ZM16.0237 4.14888L17.7837 5.9095L16.9825 6.71075L15.2225 4.95075L16.0237 4.14888ZM7.90938 12.2626L9.65959 14.0124L16.0975 7.5945L14.3381 5.8345L7.90938 12.2626ZM7.02558 13.1464L8.77476 14.8953L8.60808 15.062L6.24995 15.6708L6.85933 13.3126L7.02558 13.1464Z" fill="#2A2859"/>
            <path d="M8.43789 4.51525V3.26525H0.00976562V20.7503H19.9969L19.9935 13.1931L18.7435 13.1937L18.7462 19.5001H1.25933V4.51513L8.43789 4.51525Z" fill="#2A2859"/>
          </svg>
          <text 
            x="318" 
            y="160" 
            fontFamily="Oslo Sans, sans-serif" 
            fontWeight="400"
            fontStyle="normal"
            fontSize="16" 
              letterSpacing="-0.2"
            fill="#2A2859"
          >
            )
          </text>
        </g>
        
        {/* Building info under Nøkkelinformasjon */}
        {!isEditMode ? (
          <>
            <text 
              x="30" 
              y={byggeaarY} 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Byggeår: </tspan>
              <tspan fontWeight="500">{savedByggeaar || 'Ukjent'}</tspan>
            </text>
            <text 
              x="30" 
              y={arealY} 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Areal: </tspan>
              <tspan fontWeight="500">{savedAreal || 'Ukjent'} m²</tspan>
            </text>
            {isBlockBuilding && eierTypeY !== null && (
              <text 
                x="30" 
                y={eierTypeY} 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Eiertype: </tspan>
                <tspan fontWeight="500">Borettslag</tspan>
              </text>
            )}
            {shouldShowYellowBox && vernestatusY !== null && renderVernestatusRow(vernestatusY)}
            {shouldShowApartmentAreaRow && apartmentAreaY !== null && (
              <text 
                x="30" 
                y={apartmentAreaY} 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Areal Leilighet: </tspan>
                <tspan fontWeight="500">{savedArealLeilighet || 'Ukjent'} m²</tspan>
              </text>
            )}
            {renderEnergyBlock(energyInfoTop, {
              displayValue: savedEnergyDisplayValue
            })}
          </>
        ) : (
          <>
            {/* Edit mode - show input fields */}
            <text 
              x="30" 
              y={byggeaarY} 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Byggeår: </tspan>
            </text>
            <foreignObject x="106" y={byggeaarY - INPUT_BASELINE_OFFSET} width={calculateInputWidth(editedByggeaar)} height="24">
              <input
                xmlns="http://www.w3.org/1999/xhtml"
                type="text"
                value={editedByggeaar}
                onChange={(e) => setEditedByggeaar(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderBottom: '1px solid #2A2859',
                  padding: '0',
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  fontWeight: '500',
                  color: '#2A2859',
                  background: 'transparent',
                  outline: 'none'
                }}
              />
            </foreignObject>
            
            <text 
              x="30" 
              y={arealY} 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Areal: </tspan>
            </text>
            <foreignObject x="83" y={arealY - INPUT_BASELINE_OFFSET} width={calculateInputWidth(editedAreal)} height="24">
              <input
                xmlns="http://www.w3.org/1999/xhtml"
                type="text"
                value={editedAreal}
                onChange={(e) => setEditedAreal(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderBottom: '1px solid #2A2859',
                  padding: '0',
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  fontWeight: '500',
                  color: '#2A2859',
                  background: 'transparent',
                  outline: 'none'
                }}
              />
            </foreignObject>
            <text 
              x={83 + calculateInputWidth(editedAreal) + 3}
              y={arealY} 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
              fontWeight="500"
            >
              m²
            </text>
            
            {isBlockBuilding && eierTypeY !== null && (
              <text 
                x="30" 
                y={eierTypeY} 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Eiertype: </tspan>
                <tspan fontWeight="500">Borettslag</tspan>
              </text>
            )}
            
            {shouldShowYellowBox && vernestatusY !== null && renderVernestatusRow(vernestatusY)}
            
            
            {shouldShowApartmentAreaRow && apartmentAreaY !== null && (
              <>
                <text 
                  x="30" 
                  y={apartmentAreaY} 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                          letterSpacing="-0.2"
                  fill="#2A2859"
                >
                  <tspan fontWeight="300">Areal Leilighet: </tspan>
                </text>
                <foreignObject
                  x="153"
                  y={apartmentAreaY - INPUT_BASELINE_OFFSET}
                  width={calculateInputWidth(editedArealLeilighet)}
                  height="24"
                >
                  <input
                    xmlns="http://www.w3.org/1999/xhtml"
                    type="text"
                    value={editedArealLeilighet}
                    onChange={(e) => setEditedArealLeilighet(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderBottom: '1px solid #2A2859',
                      padding: '0',
                      fontFamily: 'Oslo Sans, sans-serif',
                      fontSize: '18px',
                      lineHeight: '28px',
                      letterSpacing: '-0.2px',
                      fontWeight: '500',
                      color: '#2A2859',
                      background: 'transparent',
                      outline: 'none'
                    }}
                  />
                </foreignObject>
                <text 
                  x={153 + calculateInputWidth(editedArealLeilighet) + 3}
                  y={apartmentAreaY} 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                          letterSpacing="-0.2"
                  fill="#2A2859"
                  fontWeight="500"
                >
                  m²
                </text>
              </>
            )}
            
            {renderEnergyBlock(energyInfoTop, {
              displayValue: savedEnergyDisplayValue,
              editable: true,
              editableValue: editedEnergiforbruk,
              onChange: (value) => {
                setEditedEnergiforbruk(value);
                setHasUserEditedEnergy(true);
              }
            })}
          </>
        )}
        {shouldShowSavingsCard && (
          <foreignObject
            x="30"
            y={savingsCardY}
            width="276"
            height={SAVINGS_CARD_HEIGHT}
            aria-label={`Estimert besparelse ${formattedSavingsCurrency}`}
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
                height: '100%',
                padding: '18px 22px',
                borderRadius: 0,
                background: '#C7F6C9',
                boxShadow: '0px 18px 38px rgba(17, 59, 50, 0.15)',
                fontFamily: 'Oslo Sans, sans-serif',
                color: '#113B32',
                opacity: shouldAnimateSavingsCardIntro ? 0 : 1,
                transform: shouldAnimateSavingsCardIntro ? 'scale(0.96)' : 'scale(1)',
                transition: prefersReducedMotion
                  ? 'opacity 200ms ease-out'
                  : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease-out',
                transformOrigin: 'left center',
                border: '1px solid rgba(17, 59, 50, 0.08)'
              }}
            >
              <span
                style={{
                  textTransform: 'uppercase',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  color: '#1B5145'
                }}
              >
                Estimert besparelse
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px',
                  color: '#102C2C',
                  flexWrap: 'nowrap',
                  width: '100%'
                }}
              >
                <div
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    display: 'flex',
                    marginRight: '4px'
                  }}
                >
                  <RollingDigitsDisplay
                    value={displayedSavings}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </div>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    lineHeight: '24px',
                    paddingBottom: '6px',
                    color: '#164136',
                    flex: '0 0 auto',
                    paddingRight: '2px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  kr/år
                </span>
              </div>
              <div
                style={{
                  fontSize: '14px',
                  lineHeight: '20px'
                }}
              >
                <div style={{ fontWeight: 500, color: '#1E4C43' }}>
                  ≈ {formattedSavingsKwh} kWh/år
                </div>
              </div>
            </div>
          </foreignObject>
        )}

        {/* Map placeholder rectangle */}
        <rect x="0" y={MAP_TOP_Y} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#E5E5E5" stroke="#D0D0D0" strokeWidth="1"/>
        
        {/* Map image if coordinates are available */}
        {mapCoordinates && (() => {
          const zoom = 17;
          const n = Math.pow(2, zoom);
          const x = n * ((mapCoordinates.lng + 180) / 360);
          const y = n * (1 - (Math.log(Math.tan(mapCoordinates.lat * Math.PI / 180) + 1 / Math.cos(mapCoordinates.lat * Math.PI / 180)) / Math.PI)) / 2;
          
          // Calculate position within the tile (0-1)
          const xOffset = x - Math.floor(x);
          const yOffset = y - Math.floor(y);
          
          // Calculate how much to offset the map so the location is centered
          // Map is 336x204, we want the location at center (168, 102)
          const mapOffsetX = MAP_WIDTH / 2 - (xOffset * 256);
          const mapOffsetY = MAP_HEIGHT / 2 - (yOffset * 256);
          
          // Get the center tile coordinates
          const centerTileX = Math.floor(x);
          const centerTileY = Math.floor(y);
          
          // Create a 3x3 grid of tiles to ensure full coverage
          const tiles = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              tiles.push({
                x: centerTileX + dx,
                y: centerTileY + dy,
                offsetX: mapOffsetX + (dx * 256),
                offsetY: MAP_TOP_Y + mapOffsetY + (dy * 256)
              });
            }
          }
          
          return (
            <>
              <clipPath id="mapClip">
                <rect x="0" y={MAP_TOP_Y} width={MAP_WIDTH} height={MAP_HEIGHT} />
              </clipPath>
              <g clipPath="url(#mapClip)">
                {tiles.map((tile, index) => (
                  <image
                    key={index}
                    x={tile.offsetX}
                    y={tile.offsetY}
                    width="256"
                    height="256"
                    href={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
                    preserveAspectRatio="none"
                  />
                ))}
              </g>
              {/* Location pin centered on map */}
              <g transform={`translate(${MAP_WIDTH / 2 - 14} ${MAP_TOP_Y + MAP_HEIGHT / 2 - 32})`}>
                <LocationPin />
              </g>
            </>
          );
        })()}
        
        {/* Map loading text */}
        {!mapCoordinates && (
          <text
            x={MAP_WIDTH / 2}
            y={MAP_TOP_Y + MAP_HEIGHT / 2}
            fontFamily="Oslo Sans, sans-serif"
            fontSize="14"
            fill="#666666"
            textAnchor="middle"
          >
            Laster kart...
          </text>
        )}
        </g>

        {/* Gul liste info overlay */}
        {shouldShowYellowBox && isGulListeInfoOpen && (
          <g
            style={{
              opacity: 1,
              transition: 'all 0.4s ease-in-out',
              pointerEvents: 'auto'
            }}
          >
            <rect 
              x="0" 
              y="0" 
              width="336" 
              height="760" 
              fill="#FFE7BC"
            />
            
            <g 
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setIsGulListeInfoOpen(false);
                setIsDropdownExpanded(false);
                setShowDropdownContent(false);
                setShowByantikvarTooltip(false);
                setShowKommunaltTooltip(false);
                setShowVernetTooltip(false);
                setShowFredetTooltip(false);
              }}
            >
              <rect 
                x="274" 
                y="16" 
                width="32" 
                height="32" 
                fill="transparent"
              />
              <svg x="274" y="16" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M14.5333 16L5 6.46667L6.46667 5L16 14.5333L25.5333 5L27 6.46667L17.4667 16L27 25.5333L25.5333 27L16 17.4667L6.46667 27L5 25.5333L14.5333 16Z" fill="#2A2859"/>
              </svg>
            </g>
            
            <text 
              x="30" 
              y={80} 
              fontFamily="Oslo Sans, sans-serif" 
              fontWeight="500"
              fontStyle="normal"
              fontSize="26" 
              letterSpacing="-0.2"
              fill="#000000"
              dominantBaseline="middle"
            >
              Hva er Gul liste?
            </text>
            
            <foreignObject x="30" y={112} width="276" height="250" style={{ overflow: 'visible' }}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                fontFamily: 'Oslo Sans, sans-serif',
                fontWeight: 300,
                fontSize: '14px',
                lineHeight: '22px',
                letterSpacing: '0px',
                color: '#000000'
              }}>
                Gul liste er <span 
                  style={{ 
                    textDecoration: 'underline', 
                    textDecorationStyle: 'dotted', 
                    textUnderlineOffset: '4px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={() => setShowByantikvarTooltip(true)}
                  onMouseLeave={() => setShowByantikvarTooltip(false)}
                >
                  Byantikvarens
                </span> oversikt over verneverdige bygninger og kulturmiljøer i Oslo. Den inneholder blant annet bolighus, hager, parker, broer og veier med kulturhistorisk verdi. Listen brukes som et verktøy i arbeidet med å ta vare på viktige deler av byens historie. Gul liste oppdateres jevnlig, men er ikke en fullstendig oversikt over alle kulturminner i Oslo. Kulturminnene på Gul liste er delt inn i tre grupper: De kan være <span 
                  style={{ 
                    textDecoration: 'underline', 
                    textDecorationStyle: 'dotted', 
                    textUnderlineOffset: '4px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={() => setShowKommunaltTooltip(true)}
                  onMouseLeave={() => setShowKommunaltTooltip(false)}
                >
                  kommunalt listeført
                </span>, <span 
                  style={{ 
                    textDecoration: 'underline', 
                    textDecorationStyle: 'dotted', 
                    textUnderlineOffset: '4px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={() => setShowVernetTooltip(true)}
                  onMouseLeave={() => setShowVernetTooltip(false)}
                >
                  vernet etter plan- og bygningsloven
                </span> eller <span 
                  style={{ 
                    textDecoration: 'underline', 
                    textDecorationStyle: 'dotted', 
                    textUnderlineOffset: '4px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={() => setShowFredetTooltip(true)}
                  onMouseLeave={() => setShowFredetTooltip(false)}
                >
                  fredet
                </span>.
                <br/><br/>
                <a 
                  href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/kulturminner-og-vern/gul-liste/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: '#000000', 
                    textDecoration: 'underline',
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px'
                  }}
                >
                  Les mer om Gul liste her.
                </a>
              </div>
            </foreignObject>
            
            {showByantikvarTooltip && (
              <foreignObject 
                x="30" 
                y={160} 
                width="200" 
                height="60"
                style={{ pointerEvents: 'none' }}
              >
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  padding: '8px',
                  border: '1px solid rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  Oslo Byantikvar er kommunens faginstans for kulturminnevern.
                </div>
              </foreignObject>
            )}
            
            {showKommunaltTooltip && (
              <foreignObject 
                x="30" 
                y={200} 
                width="200" 
                height="80"
                style={{ pointerEvents: 'none' }}
              >
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  padding: '8px',
                  border: '1px solid rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  Kommunalt listeført betyr at bygget er registrert i Gul liste og vurdert som verneverdig av Oslo kommune.
                </div>
              </foreignObject>
            )}
            
            {showVernetTooltip && (
              <foreignObject 
                x="30" 
                y={240} 
                width="210" 
                height="80"
                style={{ pointerEvents: 'none' }}
              >
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  padding: '8px',
                  border: '1px solid rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  Vernet etter plan- og bygningsloven betyr at bygget er sikret gjennom kommuneplanen eller reguleringsplan.
                </div>
              </foreignObject>
            )}
            
            {showFredetTooltip && (
              <foreignObject 
                x="30" 
                y={280} 
                width="220" 
                height="80"
                style={{ pointerEvents: 'none' }}
              >
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontSize: '12px',
                  backgroundColor: 'white',
                  padding: '8px',
                  border: '1px solid rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  Fredet betyr at bygget er vernet av Riksantikvaren eller fylkeskommunen. Endringer må godkjennes av myndighetene.
                </div>
              </foreignObject>
            )}
            
            <rect 
              x="30" 
              y={isDropdownExpanded ? 305 : 425} 
              width="276" 
              height="98" 
              fill="#2A2859"
              style={{ transition: 'transform 0.3s ease' }}
            />
            
            <foreignObject x="46" y={isDropdownExpanded ? 321 : 441} width="244" height="66">
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                fontFamily: 'Oslo Sans, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '22px',
                letterSpacing: '-0.2px',
                color: 'white'
              }}>
                Du kan absolutt gjøre tiltak for å energieffektivisere det verneverdige bygget ditt!
              </div>
            </foreignObject>
            
            <g
              onClick={() => setIsDropdownExpanded(!isDropdownExpanded)}
              style={{ cursor: 'pointer' }}
            >
              <rect 
                x="30" 
                y={isDropdownExpanded ? (163 - DROPDOWN_EXPANSION_ADJUSTMENT) : 547} 
                width="276" 
                height={isDropdownExpanded ? (440 + DROPDOWN_EXPANSION_ADJUSTMENT) : 56} 
                fill="#2A2859"
                style={{ transition: 'all 0.3s ease' }}
              />
            
              <text 
                x="46" 
                y={isDropdownExpanded ? (191 - DROPDOWN_EXPANSION_ADJUSTMENT) : 575} 
                fontFamily="Oslo Sans, sans-serif" 
                fontWeight="400"
                fontSize="14" 
                letterSpacing="-0.2"
                fill="white"
                dominantBaseline="middle"
                style={{ 
                  pointerEvents: 'none',
                  opacity: isDropdownExpanded ? (showDropdownContent ? 1 : 0) : 1,
                  transition: 'opacity 0.3s ease-in-out'
                }}
              >
                Hvorfor ta vare på kulturminner
              </text>
            
              <svg x="266" y={isDropdownExpanded ? (179 - DROPDOWN_EXPANSION_ADJUSTMENT) : 563} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ 
                pointerEvents: 'none', 
                transform: isDropdownExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                transformOrigin: `278px ${isDropdownExpanded ? (191 - DROPDOWN_EXPANSION_ADJUSTMENT) : 575}px`, 
                transition: 'all 0.3s ease',
                opacity: isDropdownExpanded ? (showDropdownContent ? 1 : 0) : 1
              }}>
                <path fillRule="evenodd" clipRule="evenodd" d="M12 14.56L4.7466 7.5L3.75 8.47002L12 16.5L20.25 8.47002L19.2534 7.5L12 14.56Z" fill="white"/>
              </svg>
            </g>
            
            {isDropdownExpanded && (
              <foreignObject x="46" y={210 - DROPDOWN_EXPANSION_ADJUSTMENT} width="244" height={365 + DROPDOWN_EXPANSION_ADJUSTMENT}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: '0px',
                  color: 'white',
                  opacity: showDropdownContent ? 1 : 0,
                  transition: 'opacity 0.3s ease-in-out'
                }}>
                  Kulturminner gir oss kunnskap om historien vår og hvordan tidligere generasjoner levde. De forteller om samfunnsutvikling, byggetradisjoner og arkitektoniske løsninger, og er en viktig del av vår identitet og felles hukommelse. Ved å bevare kulturminner tar vi vare på en ressurs som ikke kan erstattes – og som kan være både miljøvennlig og bærekraftig i bruk.
                  <br/><br/>
                  Gamle bygninger er ofte oppført i materialer og håndverk av høy kvalitet, og med riktige tiltak kan de tilpasses moderne behov uten å miste sitt særpreg. Bevaring gir ikke bare verdi til enkeltbygg, men styrker også byens mangfold og karakter.
                  <br/><br/>
                  Kulturminner er ikke bare fortiden – de er også en del av fremtidens løsninger.
                  <br/><br/>
                  <a href="#" style={{ color: 'white', textDecoration: 'underline' }}>Les mer fra Kulturminnefondet her.</a>
                </div>
              </foreignObject>
            )}
            
            <foreignObject x="30" y="640" width="276" height="30">
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                fontFamily: 'Oslo Sans, sans-serif',
                fontSize: '14px',
                lineHeight: '22px'
              }}>
                <a 
                  href="https://www.oslo.kommune.no/getfile.php/1315758-1611237956/Tjenester%20og%20tilbud/Plan%2C%20bygg%20og%20eiendom/Byggesaksveiledere%2C%20normer%20og%20skjemaer/Gul%20liste%20-%20Byantikvarens%20informasjonsark.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#000000',
                    textDecoration: 'underline',
                    display: 'block'
                  }}
                >
                  Les mer om Gul liste
                </a>
              </div>
            </foreignObject>
          </g>
        )}
        
      </g>
      
      {/* Tiltak content that appears when expanded */}
      {selectedSolution !== 'Tetting' && selectedSolution !== 'Solenergi' && selectedSolution !== 'Temperaturstyring' && selectedSolution !== 'Oppgradering av vindu' && selectedSolution !== 'Etterisolering av yttervegg' && selectedSolution !== 'Isolering av kjeller og loft' && selectedSolution !== 'Ventilasjon' && selectedSolution !== 'Varmepumpe' && (
        <g style={{ 
          opacity: isExpanded && selectedSolution ? 1 : 0, 
          transition: isExpanded ? 'opacity 0.5s ease-in-out 1s' : 'opacity 0.2s ease-out',
          pointerEvents: isExpanded ? 'auto' : 'none'
        }}>
          {getSolutionComponent()}
        </g>
      )}
        
      <defs>
        <clipPath id="clip0_325_12689">
          <rect width="336" height="760" fill="white"/>
        </clipPath>
      </defs>
    </svg>
      </div>
      
      {/* Render Tetting, Temperaturstyring, Solenergi, Oppgradering av vindu, Etterisolering av yttervegg, Isolering av kjeller og loft, Ventilasjon, and Varmepumpe outside SVG */}
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: isExpanded && selectedSolution ? 1 : 0, 
        transition: isExpanded ? 'opacity 0.5s ease-in-out 1s' : 'opacity 0.3s ease-in-out',
        pointerEvents: isExpanded ? 'auto' : 'none',
        visibility: (selectedSolution === 'Tetting' || 
          selectedSolution === 'Temperaturstyring' ||
          selectedSolution === 'Solenergi' ||
          selectedSolution === 'Oppgradering av vindu' ||
          selectedSolution === 'Etterisolering av yttervegg' ||
          selectedSolution === 'Isolering av kjeller og loft' ||
          selectedSolution === 'Ventilasjon' ||
          selectedSolution === 'Varmepumpe') ? 'visible' : 'hidden'
      }}>
        {getSolutionComponent()}
      </div>
    </div>
  );
};

const DIGITS = Array.from({ length: 10 }, (_, index) => index);
const DIGIT_HEIGHT_EM = 1.05;

interface RollingDigitProps {
  digit: string;
  prefersReducedMotion: boolean;
}

const RollingDigit: React.FC<RollingDigitProps> = ({ digit, prefersReducedMotion }) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    width: '0.9ch',
    minWidth: '0.9ch',
    justifyContent: 'center',
    height: `${DIGIT_HEIGHT_EM}em`,
    overflow: 'hidden',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: `${DIGIT_HEIGHT_EM}em`,
    padding: '0 0.5px'
  };

  if (!/^\d$/.test(digit) || prefersReducedMotion) {
    return (
      <span style={baseStyles}>
        <span style={{ lineHeight: '1.1em' }}>{digit}</span>
      </span>
    );
  }

  const numericDigit = Number(digit);

  return (
    <span style={baseStyles}>
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(calc(-1 * ${numericDigit} * ${DIGIT_HEIGHT_EM}em))`,
          transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        {DIGITS.map((stackDigit) => (
          <span
            key={stackDigit}
            style={{
              height: `${DIGIT_HEIGHT_EM}em`,
              lineHeight: `${DIGIT_HEIGHT_EM}em`,
              textAlign: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {stackDigit}
          </span>
        ))}
      </span>
    </span>
  );
};

interface RollingDigitsDisplayProps {
  value: number;
  prefersReducedMotion: boolean;
}

const RollingDigitsDisplay: React.FC<RollingDigitsDisplayProps> = ({
  value,
  prefersReducedMotion
}) => {
  const formattedValue = React.useMemo(
    () => value.toLocaleString('nb-NO').replace(/\u00A0/g, ' '),
    [value]
  );

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap: '0.2ch',
        fontSize: '38px',
        fontWeight: 700,
        lineHeight: 1,
        color: '#102C2C',
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {formattedValue.split('').map((character, index) => {
        if (/^\d$/.test(character)) {
          return (
            <RollingDigit
            key={index}
              digit={character}
              prefersReducedMotion={prefersReducedMotion}
            />
          );
        }

        return (
          <span
            key={`separator-${index}`}
            style={{ display: 'inline-block', minWidth: '0.5ch', textAlign: 'center' }}
          >
            {character}
          </span>
        );
      })}
    </span>
  );
};

const usePrefersReducedMotion = () => {
  const [prefers, setPrefers] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefers(event.matches);
    };

    setPrefers(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return prefers;
};

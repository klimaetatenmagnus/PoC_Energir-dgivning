import React from 'react';
import { getTileUrl } from '../utils/calculations';
import { LocationPin } from './LocationPin';
import * as EnergySolutions from './Tiltak/index';
import { calculateAnnualEnergyConsumption, determineBuildingType } from '../../../utils/tekEnergyCalculations';

interface WhiteInfoBoxProps {
  showHeader: boolean;
  isExpanded: boolean;
  selectedSolution: string | null;
  addressOnly: string;
  fontSize: number;
  districtName: string;
  districtNameWidth: number;
  buildingTypeName: string;
  buildingTypeWidth: number;
  blocksStartX: number;
  mapCoordinates: { lat: number; lng: number } | null;
  buildingData: any;
  onExpand?: (expanded: boolean) => void;
  showYellowBox?: boolean;
  onUpdateBuildingData?: (byggeaar: string, areal: string, arealLeilighet: string, energiforbruk: string) => void;
  onCloseYellowBox?: () => void;
  isYellowBoxExpanded?: boolean;
  onYellowBoxExpandedChange?: (expanded: boolean) => void;
  totalEnergySavings?: number;
}

export const WhiteInfoBox: React.FC<WhiteInfoBoxProps> = ({
  showHeader,
  isExpanded,
  selectedSolution,
  addressOnly,
  fontSize,
  districtName,
  districtNameWidth,
  buildingTypeName,
  buildingTypeWidth,
  blocksStartX,
  mapCoordinates,
  buildingData,
  onExpand,
  showYellowBox = true,
  onUpdateBuildingData,
  onCloseYellowBox,
  isYellowBoxExpanded: externalIsYellowBoxExpanded,
  onYellowBoxExpandedChange,
  totalEnergySavings = 0
}) => {
  // Calculate expanded width to reach where the energy solutions list ends
  const expandedWidth = isExpanded ? 840 : 336; // Expanded to 840px
  
  // State for delayed height expansion
  const [expandHeight, setExpandHeight] = React.useState(false);
  // Separate states for smooth transitions
  const [currentWidth, setCurrentWidth] = React.useState(336);
  
  // State for yellow box expansion - use external state if provided
  const [localIsYellowBoxExpanded, setLocalIsYellowBoxExpanded] = React.useState(false);
  const isYellowBoxExpanded = externalIsYellowBoxExpanded !== undefined ? externalIsYellowBoxExpanded : localIsYellowBoxExpanded;
  const setIsYellowBoxExpanded = onYellowBoxExpandedChange || setLocalIsYellowBoxExpanded;
  
  // State for dropdown expansion
  const [isDropdownExpanded, setIsDropdownExpanded] = React.useState(false);
  const [showDropdownContent, setShowDropdownContent] = React.useState(false);
  
  // ADJUST THIS VALUE TO CHANGE DROPDOWN EXPANSION SIZE
  // Positive values = expand more upward, Negative values = expand less upward
  const DROPDOWN_EXPANSION_ADJUSTMENT = 50; // Try values like -20, 0, 20, 40, 60, etc.
  
  // State for tooltip visibility
  const [showByantikvarTooltip, setShowByantikvarTooltip] = React.useState(false);
  const [showKommunaltTooltip, setShowKommunaltTooltip] = React.useState(false);
  const [showVernetTooltip, setShowVernetTooltip] = React.useState(false);
  const [showFredetTooltip, setShowFredetTooltip] = React.useState(false);
  
  // Check if building has Enova energy certificate
  const hasEnovaRating = buildingData?.energiattest?.energikarakter ? true : false;
  
  // Helper function to round to nearest thousand
  const roundToNearestThousand = (value: number): string => {
    const rounded = Math.round(value / 1000) * 1000;
    return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  
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
  const displayBuildingTypeName = buildingTypeName === "Store boligbygg" ? "Blokk" : buildingTypeName;
  const dynamicBuildingTypeWidth = displayBuildingTypeName === "Blokk" 
    ? 80 // Manuell bredde for "Blokk" - endre denne verdien
    : Math.max(
        100, // Minimum width  
        Math.ceil(calculateTextWidth(displayBuildingTypeName) + 43) // 14 (left padding) + 15 (icon) + 7 (gap) + text + 7 (right padding)
      );
  
  // State for edit mode
  const [isEditMode, setIsEditMode] = React.useState(false);
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
    const byggeaar = savedByggeaar || buildingData?.byggeaar;
    const bruksareal = savedAreal || buildingData?.bruksarealM2;
    const buildingType = determineBuildingType(
      buildingData?.bygningstypeKode,
      buildingTypeName
    );
    
    // If building is apartment/large building and has energy rating, estimate based on that
    if ((buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && 
        buildingData?.energiattest?.energikarakter && bruksareal) {
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
      
      // Log the calculation details
      console.log(`🏢 Estimerer energiforbruk for blokk med energikarakter ${energikarakter}:`, {
        energikarakter,
        bruksareal: `${bruksareal} m²`,
        grenseverdi: `${estimatedIntensity.toFixed(1)} kWh/m²/år`,
        beregning: `${estimatedIntensity.toFixed(1)} × ${bruksareal} = ${(estimatedIntensity * bruksareal).toFixed(0)} kWh/år`,
        resultat: Math.round(estimatedIntensity * bruksareal)
      });
      
      // Calculate total consumption: intensity * area
      return Math.round(estimatedIntensity * bruksareal);
    }
    
    // Otherwise use TEK-based calculation
    return calculateAnnualEnergyConsumption(byggeaar, bruksareal, buildingType);
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
  
  // Call the callback with initial values when component mounts or when savedEnergiforbruk changes
  React.useEffect(() => {
    if (onUpdateBuildingData) {
      onUpdateBuildingData(savedByggeaar, savedAreal, savedArealLeilighet, savedEnergiforbruk);
    }
  }, [savedEnergiforbruk]); // Update when energy consumption changes
  
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
  
  // Handle dropdown content delay
  React.useEffect(() => {
    if (isDropdownExpanded) {
      // Show content after dropdown animation completes
      const timer = setTimeout(() => {
        setShowDropdownContent(true);
      }, 300); // 300ms delay for smooth animation
      return () => clearTimeout(timer);
    } else {
      // Hide content immediately when closing
      setShowDropdownContent(false);
    }
  }, [isDropdownExpanded]);
  
  
  // Handle sequential animation - expand height after width
  React.useEffect(() => {
    if (isExpanded) {
      // Expansion: width first, then height
      setCurrentWidth(840);
      const timer = setTimeout(() => {
        setExpandHeight(true);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      // Collapse: height first, then width
      setExpandHeight(false);
      const timer = setTimeout(() => {
        setCurrentWidth(336);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);
  
  // Calculate expanded height to fill screen with equal margins
  // Total container height is 900px, current bottom is 55px
  // To center vertically: expandedHeight = 900 - (2 * 55) = 790px
  const expandedHeight = expandHeight ? 790 : 700;
  const expandedBottom = expandHeight ? 55 : 55; // Keep same bottom position
  const topExpansion = expandHeight ? 90 : 0; // 790 - 700 = 90px expansion upward
  
  // Get the component for the selected solution
  const getSolutionComponent = () => {
    if (!selectedSolution) return null;
    
    const componentMap: { [key: string]: React.ComponentType<any> } = {
      'Varmepumpe': showYellowBox ? EnergySolutions.VarmepumpeGul : EnergySolutions.Varmepumpe,
      'Solenergi': showYellowBox ? EnergySolutions.SolenergiGul : EnergySolutions.Solenergi,
      'Tetting': showYellowBox ? EnergySolutions.TettingGul : EnergySolutions.Tetting,
      'Temperaturstyring': showYellowBox ? EnergySolutions.TemperaturstyringGul : EnergySolutions.Temperaturstyring,
      'Oppgradering av vindu': showYellowBox ? EnergySolutions.UtskiftningAvVinduGul : EnergySolutions.UtskiftningAvVindu,
      'Isolering av kjeller og loft': showYellowBox ? EnergySolutions.IsoleringAvKjellerOgLoftGul : EnergySolutions.IsoleringAvKjellerOgLoft,
      'Etterisolering av yttervegg': showYellowBox ? EnergySolutions.EtterisoleringYtterveggGul : EnergySolutions.EtterisoleringYttervegg,
      'Ventilasjon': showYellowBox ? EnergySolutions.VentilasjonGul : EnergySolutions.Ventilasjon
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
              y="204" 
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
              y="232" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Areal: </tspan>
              <tspan fontWeight="500">{savedAreal || 'Ukjent'} m²</tspan>
            </text>
            {hasEnovaRating && !(buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && (
              <>
                <text 
                  x="30" 
                  y="288" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                        letterSpacing="-0.2"
                  fill="#2A2859"
                >
                  <tspan fontWeight="300">Energiforbruk: </tspan>
                  <tspan fontWeight="500">{roundToNearestThousand(Number(savedEnergiforbruk || '300000'))} kWh/år</tspan>
                </text>
                {totalEnergySavings > 0 && (
                  <>
                    <text 
                      x="30" 
                      y="320" 
                      fontFamily="Oslo Sans, sans-serif" 
                      fontSize="16" 
                            letterSpacing="-0.2"
                      fill="#2A2859"
                      fontWeight="400"
                    >
                      Estimerte verdier:
                    </text>
                    <text 
                      x="30" 
                      y="348" 
                      fontFamily="Oslo Sans, sans-serif" 
                      fontSize="18" 
                            letterSpacing="-0.2"
                      fill="#2A2859"
                    >
                      <tspan fontWeight="300">Mulig besparelse: </tspan>
                      <tspan fontWeight="500">{roundToNearestThousand(totalEnergySavings)} kWh/år</tspan>
                    </text>
                  </>
                )}
              </>
            )}
            {buildingTypeName.toLowerCase() === 'blokk' && (
              <text 
                x="30" 
                y={hasEnovaRating ? (totalEnergySavings > 0 ? "316" : "288") : "260"} 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Eiertype: </tspan>
                <tspan fontWeight="500">Borettslag</tspan>
              </text>
            )}
            {showYellowBox && (
              <text 
                x="30" 
                y={buildingTypeName.toLowerCase() === 'blokk' ? "288" : "260"} 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Vernestatus: </tspan>
                <tspan fontWeight="500">Gul liste</tspan>
              </text>
            )}
            {(!hasEnovaRating || ((buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && buildingData?.energiattest?.energikarakter)) && (
              <text 
                x="30" 
                y="320" 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="16" 
                      letterSpacing="-0.2"
                fill="#2A2859"
                fontWeight="400"
              >
                Estimerte verdier:
              </text>
            )}
            {buildingTypeName.toLowerCase() === 'blokk' && (
              <text 
                x="30" 
                y="376" 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Areal Leilighet: </tspan>
                <tspan fontWeight="500">{savedArealLeilighet || 'Ukjent'} m²</tspan>
              </text>
            )}
            {(!hasEnovaRating || ((buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && buildingData?.energiattest?.energikarakter)) && (
              <>
                <text 
                  x="30" 
                  y="348" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                        letterSpacing="-0.2"
                  fill="#2A2859"
                >
                  <tspan fontWeight="300">Energiforbruk: </tspan>
                  <tspan fontWeight="500">{Math.round(Number(savedEnergiforbruk || '300000')).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kWh/år</tspan>
                </text>
                {totalEnergySavings > 0 && (
                  <text 
                    x="30" 
                    y="376" 
                    fontFamily="Oslo Sans, sans-serif" 
                    fontSize="18" 
                          letterSpacing="-0.2"
                    fill="#2A2859"
                  >
                    <tspan fontWeight="300">Mulig besparelse: </tspan>
                    <tspan fontWeight="500">{roundToNearestThousand(totalEnergySavings)} kWh/år</tspan>
                  </text>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Edit mode - show input fields */}
            <text 
              x="30" 
              y="204" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Byggeår: </tspan>
            </text>
            <foreignObject x="106" y="186" width={calculateInputWidth(editedByggeaar)} height="24">
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
              y="232" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Areal: </tspan>
            </text>
            <foreignObject x="83" y="214" width={calculateInputWidth(editedAreal)} height="24">
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
              y="232" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
                  letterSpacing="-0.2"
              fill="#2A2859"
              fontWeight="500"
            >
              m²
            </text>
            
            {hasEnovaRating && !(buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && (
              <>
                <text 
                  x="30" 
                  y="288" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                          letterSpacing="-0.2"
                  fill="#2A2859"
                >
                  <tspan fontWeight="300">Energiforbruk: </tspan>
                </text>
                <foreignObject x="155" y="270" width={calculateInputWidth(editedEnergiforbruk)} height="24">
                  <input
                    xmlns="http://www.w3.org/1999/xhtml"
                    type="text"
                    value={editedEnergiforbruk}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setEditedEnergiforbruk(value);
                      setHasUserEditedEnergy(true);
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderBottom: '1px solid #2A2859',
                      padding: '0 2px',
                      fontFamily: 'Oslo Sans, sans-serif',
                      fontSize: '18px',
                      lineHeight: '28px',
                      letterSpacing: '-0.2px',
                      fontWeight: '500',
                      color: '#2A2859',
                      background: 'transparent',
                      outline: 'none',
                      textAlign: 'left'
                    }}
                  />
                </foreignObject>
                <text 
                  x={155 + calculateInputWidth(editedEnergiforbruk) + 3}
                  y="288" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                          letterSpacing="-0.2"
                  fill="#2A2859"
                  fontWeight="500"
                >
                  kWh/år
                </text>
                {totalEnergySavings > 0 && (
                  <>
                    <text 
                      x="30" 
                      y="320" 
                      fontFamily="Oslo Sans, sans-serif" 
                      fontSize="16" 
                            letterSpacing="-0.2"
                      fill="#2A2859"
                      fontWeight="400"
                    >
                      Estimerte verdier:
                    </text>
                    <text 
                      x="30" 
                      y="348" 
                      fontFamily="Oslo Sans, sans-serif" 
                      fontSize="18" 
                            letterSpacing="-0.2"
                      fill="#2A2859"
                    >
                      <tspan fontWeight="300">Mulig besparelse: </tspan>
                      <tspan fontWeight="500">{roundToNearestThousand(totalEnergySavings)} kWh/år</tspan>
                    </text>
                  </>
                )}
              </>
            )}
            
            {buildingTypeName.toLowerCase() === 'blokk' && (
              <text 
                x="30" 
                y="260" 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Eiertype: </tspan>
                <tspan fontWeight="500">Borettslag</tspan>
              </text>
            )}
            
            {showYellowBox && (
              <text 
                x="30" 
                y={hasEnovaRating ? "260" : (buildingTypeName.toLowerCase() === 'blokk' ? "288" : "260")} 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
              >
                <tspan fontWeight="300">Vernestatus: </tspan>
                <tspan fontWeight="500">Gul liste</tspan>
              </text>
            )}
            
            {(!hasEnovaRating || ((buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && buildingData?.energiattest?.energikarakter)) && (
              <text 
                x="30" 
                y={showYellowBox ? "320" : (buildingTypeName.toLowerCase() === 'blokk' ? "288" : "260")} 
                fontFamily="Oslo Sans, sans-serif" 
                fontSize="16" 
                      letterSpacing="-0.2"
                fill="#2A2859"
                fontWeight="400"
              >
                Estimerte verdier:
              </text>
            )}
            
            {buildingTypeName.toLowerCase() === 'blokk' && (
              <>
                <text 
                  x="30" 
                  y={showYellowBox ? "348" : "288"} 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                          letterSpacing="-0.2"
                  fill="#2A2859"
                >
                  <tspan fontWeight="300">Areal Leilighet: </tspan>
                </text>
                <foreignObject x="153" y={showYellowBox ? "330" : "270"} width={calculateInputWidth(editedArealLeilighet)} height="24">
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
                  y={showYellowBox ? "348" : "288"} 
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
            
            {(!hasEnovaRating || ((buildingTypeName === "Blokk" || buildingTypeName === "Store boligbygg") && buildingData?.energiattest?.energikarakter)) && (
              <>
                <text 
                  x="30" 
                  y="348" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                      letterSpacing="-0.2"
                  fill="#2A2859"
                >
                  <tspan fontWeight="300">Energiforbruk: </tspan>
                </text>
                <foreignObject x="155" y={buildingTypeName.toLowerCase() === 'blokk' ? "386" : (showYellowBox && buildingTypeName.toLowerCase() !== 'blokk' ? "330" : "358")} width={calculateInputWidth(editedEnergiforbruk)} height="24">
              <input
                xmlns="http://www.w3.org/1999/xhtml"
                type="text"
                value={editedEnergiforbruk}
                onChange={(e) => {
                  // Only allow numbers
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setEditedEnergiforbruk(value);
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderBottom: '1px solid #2A2859',
                  padding: '0 2px',
                  fontFamily: 'Oslo Sans, sans-serif',
                  fontSize: '18px',
                  lineHeight: '28px',
                  letterSpacing: '-0.2px',
                  fontWeight: '500',
                  color: '#2A2859',
                  background: 'transparent',
                  outline: 'none',
                  textAlign: 'left'
                }}
              />
            </foreignObject>
                <text 
                  x={155 + calculateInputWidth(editedEnergiforbruk) + 3}
                  y="348" 
                  fontFamily="Oslo Sans, sans-serif" 
                  fontSize="18" 
                      letterSpacing="-0.2"
                  fill="#2A2859"
                  fontWeight="500"
                >
                  kWh/år
                </text>
                {totalEnergySavings > 0 && (
                  <text 
                    x="30" 
                    y="376" 
                    fontFamily="Oslo Sans, sans-serif" 
                    fontSize="18" 
                          letterSpacing="-0.2"
                    fill="#2A2859"
                  >
                    <tspan fontWeight="300">Mulig besparelse: </tspan>
                    <tspan fontWeight="500">{roundToNearestThousand(totalEnergySavings)} kWh/år</tspan>
                  </text>
                )}
              </>
            )}
          </>
        )}
        
        {/* Yellow box above dark box - conditional rendering */}
        {showYellowBox && (
          <>
            {/* Yellow box button */}
            <g 
              style={{ cursor: 'pointer' }}
              onClick={() => setIsYellowBoxExpanded(true)}
            >
              <rect 
                x="30" 
                y="432" 
                width="235" 
                height="46" 
                fill="#FFE7BC"
                style={{ 
                  transition: 'all 0.3s ease-in-out',
                  opacity: isYellowBoxExpanded ? 0 : 1,
                  pointerEvents: isYellowBoxExpanded ? 'none' : 'auto'
                }}
              />
              
              {/* Text inside yellow box */}
              <text 
                x="46" 
                y="455" 
                fontFamily="Oslo Sans, sans-serif" 
                fontWeight="500"
                fontStyle="normal"
                fontSize="18" 
                      letterSpacing="-0.2"
                fill="#2A2859"
                dominantBaseline="middle"
                style={{ 
                  transition: 'opacity 0.3s ease-in-out',
                  opacity: isYellowBoxExpanded ? 0 : 1
                }}
              >
                Hva betyr Gul liste?
              </text>
              
              {/* Arrow icon inside yellow box */}
              <svg 
                x="225" 
                y="441" 
                width="24" 
                height="28" 
                viewBox="0 0 24 28" 
                fill="none"
                style={{ 
                  transition: 'opacity 0.3s ease-in-out',
                  opacity: isYellowBoxExpanded ? 0 : 1
                }}
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M14.56 14L7.5 21.2534L8.47002 22.25L16.5 14L8.47002 5.75L7.5 6.7466L14.56 14Z" fill="#2A2859"/>
              </svg>
            </g>
            
            {/* Removed expanded overlay from here - moved to end for proper layering */}
          </>
        )}
        
        
        {/* Map placeholder rectangle */}
        <rect x="0" y="496" width="336" height="204" fill="#E5E5E5" stroke="#D0D0D0" strokeWidth="1"/>
        
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
          const mapOffsetX = 168 - (xOffset * 256);
          const mapOffsetY = 102 - (yOffset * 256);
          
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
                offsetY: 496 + mapOffsetY + (dy * 256)
              });
            }
          }
          
          return (
            <>
              <clipPath id="mapClip">
                <rect x="0" y="496" width="336" height="204" />
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
              <g transform={`translate(${168 - 14} ${598 - 32})`}>
                <LocationPin />
              </g>
            </>
          );
        })()}
        
        {/* Map loading text */}
        {!mapCoordinates && (
          <text
            x="168"
            y="598"
            fontFamily="Oslo Sans, sans-serif"
            fontSize="14"
            fill="#666666"
            textAnchor="middle"
          >
            Laster kart...
          </text>
        )}
        </g>
        
        {/* Yellow box expanded overlay - moved to end for proper layering */}
        {showYellowBox && isYellowBoxExpanded && (
          <g
            style={{
              opacity: 1,
              transition: 'all 0.4s ease-in-out',
              pointerEvents: 'auto'
            }}
          >
            {/* Expanded background */}
            <rect 
              x="0" 
              y="0" 
              width="336" 
              height="760" 
              fill="#FFE7BC"
            />
            
            {/* Close button */}
            <g 
              style={{ cursor: 'pointer' }}
              onClick={() => setIsYellowBoxExpanded(false)}
            >
              {/* Button background square */}
              <rect 
                x="274" 
                y="16" 
                width="32" 
                height="32" 
                fill="transparent"
              />
              {/* Close icon */}
              <svg x="274" y="16" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M14.5333 16L5 6.46667L6.46667 5L16 14.5333L25.5333 5L27 6.46667L17.4667 16L27 25.5333L25.5333 27L16 17.4667L6.46667 27L5 25.5333L14.5333 16Z" fill="#2A2859"/>
              </svg>
            </g>
            
            {/* Overskrift */}
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
            
            {/* Beskrivelsestekst */}
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
            
            {/* Render tooltips outside text flow for consistent positioning */}
            {showByantikvarTooltip && (
              <foreignObject x="30" y="133" width="280" height="250" 
                onMouseEnter={() => setShowByantikvarTooltip(true)}
                onMouseLeave={() => setShowByantikvarTooltip(false)}
              >
                <div 
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    padding: '16px',
                    paddingTop: '24px',
                    backgroundColor: '#D1F9FF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    width: '280px'
                  }}
                >
                  <h4 style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '24px',
                    letterSpacing: '-0.2px',
                    color: '#000000',
                    margin: '0 0 8px 0'
                  }}>
                    Ordforklaring
                  </h4>
                  <p style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#000000',
                    margin: 0
                  }}>
                    Byantikvaren (BYA) Byantikvaren (BYA) er Oslo kommunes faglige rådgiver i alle spørsmål som gjelder bevaring av arkitektoniske og kulturhistoriske verdifulle bygninger, anlegg og miljøer og arkeologiske kulturminner.
                    <br/><br/>
                    <a 
                      href="https://www.oslo.kommune.no/etater-foretak-og-ombud/byantikvaren/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#000000', 
                        textDecoration: 'underline',
                        fontFamily: 'Oslo Sans',
                        fontWeight: 300,
                        fontSize: '14px',
                        pointerEvents: 'all'
                      }}
                    >
                      Les mer om Byantikvaren
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle' }}>
                        <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#000000"/>
                        <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#000000"/>
                      </svg>
                    </a>
                  </p>
                </div>
              </foreignObject>
            )}
            
            {showKommunaltTooltip && (
              <foreignObject x="30" y="183" width="280" height="150" 
                onMouseEnter={() => setShowKommunaltTooltip(true)}
                onMouseLeave={() => setShowKommunaltTooltip(false)}
              >
                <div 
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    padding: '16px',
                    paddingTop: '24px',
                    backgroundColor: '#D1F9FF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    width: '280px'
                  }}
                >
                  <h4 style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '24px',
                    letterSpacing: '-0.2px',
                    color: '#000000',
                    margin: '0 0 8px 0'
                  }}>
                    Ordforklaring
                  </h4>
                  <p style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#000000',
                    margin: 0
                  }}>
                    Bygning eller område som er vurdert som verneverdig, men som ikke har juridisk vern. Endringer krever ofte vurdering fra Byantikvaren.
                  </p>
                </div>
              </foreignObject>
            )}
            
            {showVernetTooltip && (
              <foreignObject x="30" y="205" width="280" height="150" 
                onMouseEnter={() => setShowVernetTooltip(true)}
                onMouseLeave={() => setShowVernetTooltip(false)}
              >
                <div 
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    padding: '16px',
                    paddingTop: '24px',
                    backgroundColor: '#D1F9FF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    width: '280px'
                  }}
                >
                  <h4 style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '24px',
                    letterSpacing: '-0.2px',
                    color: '#000000',
                    margin: '0 0 8px 0'
                  }}>
                    Ordforklaring
                  </h4>
                  <p style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#000000',
                    margin: 0
                  }}>
                    Bygning eller område som er bevart gjennom regler bestemt av kommunen. Reglene sier noe om hva som kan gjøres med bygget.
                  </p>
                </div>
              </foreignObject>
            )}
            
            {showFredetTooltip && (
              <foreignObject x="30" y="226" width="280" height="150" 
                onMouseEnter={() => setShowFredetTooltip(true)}
                onMouseLeave={() => setShowFredetTooltip(false)}
              >
                <div 
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    padding: '16px',
                    paddingTop: '24px',
                    backgroundColor: '#D1F9FF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    width: '280px'
                  }}
                >
                  <h4 style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '24px',
                    letterSpacing: '-0.2px',
                    color: '#000000',
                    margin: '0 0 8px 0'
                  }}>
                    Ordforklaring
                  </h4>
                  <p style={{
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#000000',
                    margin: 0
                  }}>
                    Bygning, område eller anlegg med nasjonal verdi som er fredet etter kulturminneloven. Har strengt vern – ofte både innvendig og utvendig.
                  </p>
                </div>
              </foreignObject>
            )}
            
            {/* Mørk blå boks med hvit tekst */}
            <rect 
              x="30" 
              y={isDropdownExpanded ? 305 : 425} 
              width="276" 
              height="98" 
              fill="#2A2859"
              style={{ transition: 'transform 0.3s ease' }}
            />
            
            {/* Hvit tekst inni boksen */}
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
            
            {/* Ny boks med dropdown-meny */}
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
            
              {/* Tekst i ny boks */}
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
            
              {/* Dropdown ikon */}
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
            
            {/* Ekspandert innhold for dropdown */}
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
            
            {/* Link under dropdown-boksen */}
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
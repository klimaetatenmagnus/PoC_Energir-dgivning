
import React from 'react';
import { AddressLookupResponse } from '../services/buildingApi';
import { useAddressCoordinates } from './FigmaBlokk/hooks/useAddressCoordinates';
import { calculateFontSize, calculateBoxWidth, getTileUrl } from './FigmaBlokk/utils/calculations';
import { ENERGY_SOLUTIONS, BOX_MIN_WIDTHS } from './FigmaBlokk/constants';
import { getLayoutStyles, getTitleStyles, getButtonTextStyles } from './FigmaBlokk/styles';
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

interface FigmaBlokkProps {
  searchAddress: string;
  buildingData: AddressLookupResponse;
  stotteordninger?: any;
  onBack: () => void;
}

export const FigmaMainScript: React.FC<FigmaBlokkProps> = ({ searchAddress, buildingData, stotteordninger, onBack }) => {
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
  const [isYellowBoxExpanded, setIsYellowBoxExpanded] = React.useState(false);
  
  // State for updated building data
  const [updatedBuildingData, setUpdatedBuildingData] = React.useState(buildingData);
  
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
  const [enebolig1Opacity, setEnebolig1Opacity] = React.useState(1);
  const enebolig1Ref = React.useRef<SVGSVGElement>(null);
  const enebolig2ContainerRef = React.useRef<HTMLDivElement>(null);
  
  // State for blokk animation
  const [animateBlokk, setAnimateBlokk] = React.useState(false);
  const [blokk1Opacity, setBlokk1Opacity] = React.useState(1);
  const blokk1Ref = React.useRef<SVGSVGElement>(null);
  const blokk2ContainerRef = React.useRef<HTMLDivElement>(null);
  
  // State for process slide animation
  const [showProcess, setShowProcess] = React.useState(false);
  
  // State for total energy savings
  const [totalEnergySavings, setTotalEnergySavings] = React.useState<number>(0);
  
  // Enebolig animation function - disabled
  // Animation has been removed - Enebolig2 is shown immediately without animation

  // Handle building data updates from WhiteInfoBox
  const handleUpdateBuildingData = (byggeaar: string, areal: string, arealLeilighet: string, energiforbruk: string) => {
    setUpdatedBuildingData({
      ...updatedBuildingData,
      byggeaar: byggeaar,
      bruksarealM2: areal,
      csvData: {
        ...updatedBuildingData.csvData,
        byggeaar: byggeaar,
        bruksareal_totalt: areal
      }
    });
    setEnergiforbruk(energiforbruk);
  };
  
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
      
      const params: any = {
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

  // Handle building animation based on type
  React.useEffect(() => {
    // Start animation immediately
    if (isEnebolig) {
      setAnimateHouse(true);
      // Delay fading out enebolig1 to let it reach position first
      setTimeout(() => {
        setEnebolig1Opacity(0);
      }, 1000); // Start fading after 1 second
    } else {
      setAnimateBlokk(true);
      // Delay fading out blokk1 to let it reach position first
      setTimeout(() => {
        setBlokk1Opacity(0);
      }, 1000); // Start fading after 1 second
    }
  }, [isEnebolig]);
  
  // Calculate scale factor for responsive design
  const [scaleFactor, setScaleFactor] = React.useState(() => {
    // Calculate initial scale immediately
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const baseWidth = 1728;
    const baseHeight = 900;
    const maxWidth = viewportWidth - 10;
    const maxHeight = viewportHeight - 10;
    const scaleX = maxWidth / baseWidth;
    const scaleY = maxHeight / baseHeight;
    return Math.min(scaleX, scaleY, 1);
  });
  
  React.useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const baseWidth = 1728;
      const baseHeight = 900;
      const maxWidth = viewportWidth - 10;
      const maxHeight = viewportHeight - 10;
      const scaleX = maxWidth / baseWidth;
      const scaleY = maxHeight / baseHeight;
      const scale = Math.min(scaleX, scaleY, 1);
      setScaleFactor(scale);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty dependency array - only run once on mount
  
  // Calculate dynamic font size based on address length
  const addressOnly = searchAddress.split(',')[0];
  const fontSize = calculateFontSize(addressOnly);
  
  // Calculate district name width for green box
  const districtName = buildingData.csvData?.bydelsnavn || 'Bydel';
  const districtNameWidth = calculateBoxWidth(districtName, BOX_MIN_WIDTHS.district);
  
  // Get building type name and calculate width for blue box
  const defaultBuildingType = isEnebolig ? 'Enebolig' : 'Blokk';
  const buildingTypeName = buildingData.csvData?.bygningstypeNavn || buildingData.bygningstypeNavn || defaultBuildingType;
  const buildingTypeWidth = calculateBoxWidth(buildingTypeName, BOX_MIN_WIDTHS.buildingType);
  const blocksStartX = (336 - districtNameWidth - 8 - buildingTypeWidth) / 2; // Center the blocks

  // Get styles
  const layoutStyles = getLayoutStyles();
  const titleStyles = getTitleStyles();
  const buttonTextStyles = getButtonTextStyles();

  const [activeTiltak, setActiveTiltak] = React.useState<string[]>([]);
  
  // Added by W 2
  const ENERGY_RATING_COLORS: Record<string, string> = {
    A:'#097E3E', B:'#32A548', C:'#96C133', D:'#EFE61E',
    E:'#F7AD24', F:'#EA6927', G:'#E31829'
  };
  const getColor = (rating?: string | null) =>
    rating ? ENERGY_RATING_COLORS[rating.toUpperCase()] ?? '#32A548' : '#32A548';
  const [arrowColor, setArrowColor] = React.useState(
    getColor(buildingData?.energiattest?.energikarakter)
  );
  //added by W 1
  const [arrowState, setArrowState] = React.useState<'add' | 'remove' | null>(null);
  const prevTiltak = React.useRef(new Set<string>());

  const handleSelectionChange = React.useCallback((nextList: string[], finalRating?: string | null) => {
  const next = new Set(nextList);
  const prev = prevTiltak.current;

  let mode: 'add' | 'remove' | null = null;
  for (const tiltak of next) {
    if (!prev.has(tiltak)) { mode = 'add'; break; }
  }
  if (!mode) {
    for (const tiltak of prev) {
      if (!next.has(tiltak)) { mode = 'remove'; break; }
    }
  }
  setArrowColor(getColor(finalRating));
  setActiveTiltak(nextList);
  if (mode) {
    setArrowState(mode);
  }
  prevTiltak.current = next;
}, []);

  React.useEffect(() => {
    if (!arrowState) return;
    const timer = setTimeout(() => setArrowState(null), 900);
    return () => clearTimeout(timer);
  }, [arrowState]);
  // added by W end

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
        transition: 'transform 0.8s ease-in-out'
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
              console.log('Tilbake button clicked!');
              // Remove any animated clones before going back
              const clones = document.querySelectorAll('div[style*="z-index: 9999"]');
              clones.forEach(clone => clone.remove());
              console.log('Calling onBack function...');
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
        onExpand={(expanded: boolean) => {
          setIsExpanded(expanded);
          // Close yellow box when any "les mer" button is clicked
          if (expanded && isYellowBoxExpanded) {
            setIsYellowBoxExpanded(false);
          }
        }}
        onSelectSolution={setSelectedSolution}
        buildingData={{...updatedBuildingData, filteredSolarEnergy: solarData?.filteredSolarEnergy}}
        showYellowBox={showYellowBox}
        onToggleYellowBox={setShowYellowBox}
        yearlyConsumption={energiforbruk}
        onProcessClick={() => setShowProcess(true)}
        onCloseYellowBox={() => {
          setIsYellowBoxExpanded(false);
        }}
        onTotalSavingsChange={setTotalEnergySavings}
        onSelectionChange={handleSelectionChange}
      />
      
      {/* Enebolig1 - initial small house that animates to Enebolig2 */}
      {isEnebolig && (
        <div 
          ref={enebolig1Ref}
          style={{
            position: 'absolute',
            bottom: animateHouse ? '55px' : '0px', // Start at bottom 0, end at 55px
            left: animateHouse ? '50%' : '289px', // Start at absolute position (matching Enebolig1 in skyline), end at center
            transform: animateHouse 
              ? 'translateX(calc(235.5px + 74px)) scale(5)' // End position (same as Enebolig2)
              : 'translateX(0) scale(1)', // Start position (no translation needed when using absolute left)
            transformOrigin: 'bottom left',
            opacity: enebolig1Opacity,
            transition: 'transform 2s ease-in-out, opacity 2s ease-in-out, bottom 2s ease-in-out, left 2s ease-in-out',
            zIndex: 3
          }}
        >
          <svg width="94" height="87" viewBox="0 0 135.846 128.614">
            <g id="blokk2-01"><rect x="90.532" y="55.007" width="45.266" height="72.602" fill="#f8f0dd" /><polygon points="45.266 9.798 0 55.007 0 127.609 90.532 127.609 90.532 55.007 45.266 9.798" fill="#d0bfae" /><polygon points="90.532 55.007 135.799 55.007 90.561 9.769 45.266 9.798 90.532 55.007" fill="#2a2959" /><rect x="36.185" y="109.446" width="18.162" height="18.162" fill="#2a2959" /><rect x="39.419" y="55.007" width="13.04" height="13.04" fill="#2a2959" /><rect x="106.646" y="79.177" width="13.04" height="26.182" fill="#2a2959" /></g><g className={`tiltak-shape tiltak-ventilasjon ${activeTiltak.includes('Ventilasjon') ? 'tiltak--visible' : ''}`}><rect x="28.958" y="28.789" width="32.006" height="20.74" fill="#fff" /><path d="M59.612,30.141v18.036h-29.303v-18.036h29.303M62.315,27.438H27.606v23.443h34.709v-23.443h0Z" fill="#43f8b6" /><rect x="33.183" y="32.372" width="23.818" height="2.802" fill="#2a2859" /><rect x="33.183" y="37.922" width="23.818" height="2.802" fill="#2a2859" /><rect x="33.183" y="43.471" width="23.818" height="2.802" fill="#2a2859" /></g><g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-01 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`}><polygon points="58.188 12.434 58.188 22.649 55.594 20.119 55.594 12.434 58.188 12.434" fill="#bcbec0" /><polygon points="91.858 48.001 54.239 9.866 85.022 9.866 122.641 48.001 91.858 48.001" fill="#fff" /><path d="M84.174,11.893l33.619,34.08h-25.087L59.087,11.893h25.087M85.87,7.838h-36.479l6.809,6.903,33.619,34.08,1.191,1.207h36.479l-6.809-6.903L87.061,9.046l-1.191-1.207h0Z" fill="#42f8b5" /><polygon points="117.793 45.973 92.706 45.973 59.087 11.893 84.174 11.893 117.793 45.973" fill="#2a2959" /><path d="M120.702,47.19h-28.504L56.178,10.677h28.504l36.02,36.513ZM93.215,44.757h21.669l-31.219-31.647h-21.669l31.219,31.647Z" fill="#fff" /><rect x="70.72" y="22.097" width="24.353" height="2.433" fill="#fff" /><rect x="81.808" y="33.337" width="24.353" height="2.433" fill="#fff" /><rect x="82.962" y="5.251" width="2.433" height="47.365" transform="translate(3.932 67.452) rotate(-44.61)" fill="#fff" /><rect x="91.485" y="5.251" width="2.433" height="47.365" transform="translate(6.388 73.438) rotate(-44.61)" fill="#fff" /></g><g className={`tiltak-shape tiltak-etterisolering_kjeller_loft ${activeTiltak.includes('Isolering av kjeller og loft') ? 'tiltak--visible' : ''}`}><path d="M90.621,60.761L45.266,15.462C30.178,30.34,15.089,45.217,0,60.095v-5.809c15.089-14.852,30.178-29.703,45.266-44.555l45.392,45.333-.037,5.697Z" fill="#42f8b5" /><rect x="0" y="123.621" width="36.185" height="4.055" fill="#42f8b5" /><rect x="54.347" y="123.621" width="81.451" height="4.055" fill="#42f8b5" /></g><g className={`tiltak-shape tiltak-etterisolering_yttervegger ${activeTiltak.includes('Etterisolering av yttervegg') ? 'tiltak--visible' : ''}`}><path d="M4.102,127.618H.047V55.021c1.352-1.352,2.703-2.703,4.055-4.055v76.652Z" fill="#43f8b6" /><rect x="131.791" y="55.016" width="4.055" height="72.602" fill="#43f8b6" /></g><g className={`tiltak-shape tiltak-temperaturstyring enebolig ${activeTiltak.includes('Temperaturstyring') ? 'tiltak--visible' : ''}`}><path d="M97.138,4.055c2.566,0,4.647,2.49,4.647,5.562v38.641c3.972,1.778,6.741,5.763,6.741,10.396,0,6.289-5.099,11.388-11.388,11.388s-11.388-5.099-11.388-11.388c0-4.634,2.769-8.618,6.741-10.396v-2.943h-.001v-1.364h.001v-6.44h-.001v-1.364h.001v-6.439h-.001v-1.364h.001v-6.439h-.001v-1.364h.001v-6.44h-.001v-1.364h.001v-3.12c0-3.072,2.08-5.562,4.647-5.562h0M97.138,0c-4.513,0-8.234,3.817-8.661,8.682h-.041v4.055s-.001,1.364-.001,1.364v4.055h0v2.385s0,1.364,0,1.364v4.055h0v2.384s0,1.364,0,1.364v4.055h0v2.384s0,1.364,0,1.364v4.055h0v2.385s0,1.364,0,1.364v.584c-4.164,2.845-6.74,7.605-6.74,12.755,0,8.515,6.928,15.443,15.443,15.443s15.443-6.928,15.443-15.443c0-5.151-2.576-9.911-6.741-12.756V9.617c0-5.303-3.904-9.617-8.702-9.617h0Z" fill="#42f8b5" /><path d="M92.492,48.258v-17.446h9.294v17.446c3.972,1.778,6.741,5.763,6.741,10.396,0,6.289-5.099,11.388-11.388,11.388s-11.388-5.099-11.388-11.388c0-4.634,2.769-8.618,6.741-10.396Z" fill="#ff8274" /><path d="M92.492,9.617c0-3.072,2.08-5.562,4.647-5.562h0c2.566,0,4.647,2.49,4.647,5.562v21.195h-9.294V9.617Z" fill="#fff" /><path d="M92.49,43.951h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,36.148h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,28.344h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,20.541h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,12.737h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M88.883,62.227c0-2.256,1.037-4.085,2.316-4.085s2.316,1.829,2.316,4.085-1.037,4.085-2.316,4.085-2.316-1.829-2.316-4.085Z" fill="#fff" /></g><g className={`tiltak-shape tiltak-tetting_vinduer_dorer ${activeTiltak.includes('Tetting') ? 'tiltak--visible' : ''}`}><path d="M52.459,54.953v13.04h-13.04v-13.04h13.04M55.162,52.249h-18.446v18.446h18.446v-18.446h0Z" fill="#43f8b6" /><polygon points="54.347 106.81 36.185 106.81 33.482 106.81 33.482 109.514 33.482 127.676 36.185 127.676 36.185 109.514 54.347 109.514 54.347 127.676 57.051 127.676 57.051 109.514 57.051 106.81 54.347 106.81" fill="#43f8b6" /><path d="M119.685,79.162v26.182h-13.04v-26.182h13.04M122.389,76.458h-18.446v31.589h18.446v-31.589h0Z" fill="#43f8b6" /></g><g className={`tiltak-shape tiltak-oppgradering_vinduer ${activeTiltak.includes('Oppgradering av vindu') ? 'tiltak--visible' : ''}`}><path d="M52.821,54.441v14.025h-14.025v-14.025h14.025M55.525,51.737h-19.432v19.432h19.432v-19.432h0Z" fill="#43f8b6" /><rect x="40.418" y="56.063" width="10.781" height="4.861" fill="#6a688b" /><path d="M52.821,68.466h-14.025v-14.025h14.025v14.025ZM40.418,66.844h10.781v-10.781h-10.781v10.781Z" fill="#fff" /><path d="M120.722,78.294v28.975h-15.374v-28.975h15.374M123.426,75.591h-20.781v34.382h20.781v-34.382h0Z" fill="#42f8b5" /><rect x="107.126" y="80.073" width="11.818" height="10.104" fill="#6a688b" /><path d="M120.722,107.265h-15.374v-28.971h15.374v28.971ZM107.126,105.487h11.818v-25.415h-11.818v25.415Z" fill="#fff" /><path d="M32.258,53.252c3.931-.724,4.518-1.31,5.242-5.242.724,3.931,1.31,4.518,5.242,5.242-3.931.724-4.518,1.31-5.242,5.242-.724-3.931-1.31-4.518-5.242-5.242Z" fill="#fff" /><path d="M117.215,109.373c3.931-.724,4.518-1.31,5.242-5.242.724,3.931,1.31,4.518,5.242,5.242-3.931.724-4.518,1.31-5.242,5.242-.724-3.931-1.31-4.518-5.242-5.242Z" fill="#fff" /></g><g className={`tiltak-shape tiltak-varmepumpe ${activeTiltak.includes('Varmepumpe') ? 'tiltak--visible' : ''}`}><rect x="66.343" y="105.361" width="35.668" height="21.226" fill="#43f8b6" /><path d="M104.039,128.614h-39.723v-25.281h39.723v25.281ZM68.371,124.559h31.613v-17.171h-31.613v17.171Z" fill="#43f8b6" /><path d="M108.377,117.335c-.102-3.404-2.938-6.17-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.365-.478,2.673-1.46,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.747,4.522-1.989,1.223-1.255,1.895-2.956,1.843-4.666Z" fill="#43f8b6" /><path d="M99.984,126.074v-5.398l1.958-.067c.834-.029,1.585-.362,2.171-.965.596-.612.911-1.395.886-2.207-.048-1.588-1.419-2.926-3.057-2.982l-1.958-.067v-5.398l2.082.056c4.54.122,8.202,3.737,8.337,8.228h0c.068,2.256-.813,4.495-2.418,6.142-1.574,1.616-3.677,2.54-5.919,2.601l-2.082.056Z" fill="#43f8b6" /><path d="M108.377,114.219c-.102-3.404-2.938-6.174-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.366-.478,2.673-1.461,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.746,4.522-1.989,1.223-1.256,1.895-2.956,1.843-4.666Z" fill="#43f8b6" /><path d="M99.984,122.957v-5.398l1.958-.067c.834-.029,1.585-.362,2.171-.964.596-.612.911-1.396.887-2.207-.048-1.588-1.419-2.926-3.057-2.982l-1.958-.067v-5.397l2.08.054c4.541.119,8.204,3.733,8.339,8.229h0c.068,2.256-.813,4.495-2.417,6.142-1.575,1.617-3.677,2.54-5.92,2.601l-2.082.056Z" fill="#43f8b6" /><path d="M108.377,117.336c-.102-3.404-2.938-6.17-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.365-.478,2.673-1.46,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.747,4.522-1.989,1.223-1.255,1.895-2.956,1.843-4.666Z" fill="#2a2859" /><rect x="102.799" y="114.801" width="2.333" height="2.333" fill="#43f8b6" /><path d="M108.377,114.22c-.102-3.404-2.938-6.174-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.366-.478,2.673-1.461,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.746,4.522-1.989,1.223-1.256,1.895-2.956,1.843-4.666Z" fill="#fff" /><rect x="92.075" y="107.57" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,108.963v-1.799h9.226s0,1.799,0,1.799h-9.226ZM92.481,107.976v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="92.075" y="112.843" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,114.237v-1.799h9.226s0,1.798,0,1.798h-9.226ZM92.481,113.249v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="92.075" y="118.116" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,119.51v-1.799h9.226s0,1.799,0,1.799h-9.226ZM92.481,118.522v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="92.075" y="123.389" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,124.783v-1.799h9.226s0,1.799,0,1.799h-9.226ZM92.481,123.795v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="66.343" y="105.36" width="24.212" height="21.226" transform="translate(156.898 231.946) rotate(180)" fill="#fff" /><circle cx="78.708" cy="115.974" r="8.183" fill="#43f8b6" /><path d="M79.374,108.824v5.975l5.14-3.046c-1.211-1.664-3.098-2.739-5.14-2.929Z" fill="#2a2859" /><path d="M72.902,111.753l5.14,3.047v-5.975c-2.042.19-3.929,1.265-5.14,2.929Z" fill="#2a2859" /><path d="M72.223,119.037l5.18-3.07-5.18-3.07c-.451.953-.689,2.009-.689,3.07s.237,2.116.689,3.07Z" fill="#2a2859" /><path d="M85.194,112.897l-5.18,3.07,5.18,3.07c.451-.953.689-2.009.689-3.07s-.237-2.116-.689-3.07Z" fill="#2a2859" /><path d="M78.043,123.111v-5.975l-5.14,3.047c1.211,1.663,3.098,2.738,5.14,2.929Z" fill="#2a2859" /><path d="M84.514,120.182l-5.14-3.047v5.975c2.042-.19,3.929-1.265,5.14-2.929Z" fill="#2a2859" /><circle cx="78.708" cy="115.974" r="1.993" fill="#2a2859" /></g>

            
          </svg>

        </div>
      )}

      {/* Enebolig2 - fades in as Enebolig1 fades out */}
      {isEnebolig && (
        <div 
          ref={enebolig2ContainerRef}
          style={{
            position: 'absolute',
            bottom: '55px',
            left: '50%',
            transform: 'translateX(calc(235.5px + 74px)) scale(5)',
            transformOrigin: 'bottom left',
            opacity: animateHouse ? 1 : 0,
            transition: 'opacity 2s ease-in-out 1s', // Delay opacity transition
            zIndex: 2
          }}
        >

          <svg className="enebolig2_layer" width="94" height="87" id="enebolig2_layer" viewBox="0 0 135.846 128.614">
            
              <polygon 
                id="ARROW_ADD" 
                className={`tiltak-arrow ${arrowState === 'add' ? 'tiltak-arrow--add' : ''}`}
                points="12.53 3.816 8.714 3.816 8.714 0 3.816 0 3.816 3.816 0 3.816 0 8.714 3.816 8.714 3.816 12.53 8.714 12.53 8.714 8.714 12.53 8.714 12.53 3.816" fill={arrowColor}
              />
              
              <rect 
                id="ARROW_SUBTRACT" 
                className={`tiltak-arrow ${arrowState === 'remove' ? 'tiltak-arrow--remove' : ''}`}
                y="3.816" width="12.53" height="4.898" fill={arrowColor}
              />

            <g id="blokk2-01"><rect x="90.532" y="55.007" width="45.266" height="72.602" fill="#f8f0dd" /><polygon points="45.266 9.798 0 55.007 0 127.609 90.532 127.609 90.532 55.007 45.266 9.798" fill="#d0bfae" /><polygon points="90.532 55.007 135.799 55.007 90.561 9.769 45.266 9.798 90.532 55.007" fill="#2a2959" /><rect x="36.185" y="109.446" width="18.162" height="18.162" fill="#2a2959" /><rect x="39.419" y="55.007" width="13.04" height="13.04" fill="#2a2959" /><rect x="106.646" y="79.177" width="13.04" height="26.182" fill="#2a2959" /></g><g className={`tiltak-shape tiltak-ventilasjon ${activeTiltak.includes('Ventilasjon') ? 'tiltak--visible' : ''}`}><rect x="28.958" y="28.789" width="32.006" height="20.74" fill="#fff" /><path d="M59.612,30.141v18.036h-29.303v-18.036h29.303M62.315,27.438H27.606v23.443h34.709v-23.443h0Z" fill="#43f8b6" /><rect x="33.183" y="32.372" width="23.818" height="2.802" fill="#2a2859" /><rect x="33.183" y="37.922" width="23.818" height="2.802" fill="#2a2859" /><rect x="33.183" y="43.471" width="23.818" height="2.802" fill="#2a2859" /></g><g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-01 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`}><polygon points="58.188 12.434 58.188 22.649 55.594 20.119 55.594 12.434 58.188 12.434" fill="#bcbec0" /><polygon points="91.858 48.001 54.239 9.866 85.022 9.866 122.641 48.001 91.858 48.001" fill="#fff" /><path d="M84.174,11.893l33.619,34.08h-25.087L59.087,11.893h25.087M85.87,7.838h-36.479l6.809,6.903,33.619,34.08,1.191,1.207h36.479l-6.809-6.903L87.061,9.046l-1.191-1.207h0Z" fill="#42f8b5" /><polygon points="117.793 45.973 92.706 45.973 59.087 11.893 84.174 11.893 117.793 45.973" fill="#2a2959" /><path d="M120.702,47.19h-28.504L56.178,10.677h28.504l36.02,36.513ZM93.215,44.757h21.669l-31.219-31.647h-21.669l31.219,31.647Z" fill="#fff" /><rect x="70.72" y="22.097" width="24.353" height="2.433" fill="#fff" /><rect x="81.808" y="33.337" width="24.353" height="2.433" fill="#fff" /><rect x="82.962" y="5.251" width="2.433" height="47.365" transform="translate(3.932 67.452) rotate(-44.61)" fill="#fff" /><rect x="91.485" y="5.251" width="2.433" height="47.365" transform="translate(6.388 73.438) rotate(-44.61)" fill="#fff" /></g><g className={`tiltak-shape tiltak-etterisolering_kjeller_loft ${activeTiltak.includes('Isolering av kjeller og loft') ? 'tiltak--visible' : ''}`}><path d="M90.621,60.761L45.266,15.462C30.178,30.34,15.089,45.217,0,60.095v-5.809c15.089-14.852,30.178-29.703,45.266-44.555l45.392,45.333-.037,5.697Z" fill="#42f8b5" /><rect x="0" y="123.621" width="36.185" height="4.055" fill="#42f8b5" /><rect x="54.347" y="123.621" width="81.451" height="4.055" fill="#42f8b5" /></g><g className={`tiltak-shape tiltak-etterisolering_yttervegger ${activeTiltak.includes('Etterisolering av yttervegg') ? 'tiltak--visible' : ''}`}><path d="M4.102,127.618H.047V55.021c1.352-1.352,2.703-2.703,4.055-4.055v76.652Z" fill="#43f8b6" /><rect x="131.791" y="55.016" width="4.055" height="72.602" fill="#43f8b6" /></g><g className={`tiltak-shape tiltak-temperaturstyring enebolig ${activeTiltak.includes('Temperaturstyring') ? 'tiltak--visible' : ''}`}><path d="M97.138,4.055c2.566,0,4.647,2.49,4.647,5.562v38.641c3.972,1.778,6.741,5.763,6.741,10.396,0,6.289-5.099,11.388-11.388,11.388s-11.388-5.099-11.388-11.388c0-4.634,2.769-8.618,6.741-10.396v-2.943h-.001v-1.364h.001v-6.44h-.001v-1.364h.001v-6.439h-.001v-1.364h.001v-6.439h-.001v-1.364h.001v-6.44h-.001v-1.364h.001v-3.12c0-3.072,2.08-5.562,4.647-5.562h0M97.138,0c-4.513,0-8.234,3.817-8.661,8.682h-.041v4.055s-.001,1.364-.001,1.364v4.055h0v2.385s0,1.364,0,1.364v4.055h0v2.384s0,1.364,0,1.364v4.055h0v2.384s0,1.364,0,1.364v4.055h0v2.385s0,1.364,0,1.364v.584c-4.164,2.845-6.74,7.605-6.74,12.755,0,8.515,6.928,15.443,15.443,15.443s15.443-6.928,15.443-15.443c0-5.151-2.576-9.911-6.741-12.756V9.617c0-5.303-3.904-9.617-8.702-9.617h0Z" fill="#42f8b5" /><path d="M92.492,48.258v-17.446h9.294v17.446c3.972,1.778,6.741,5.763,6.741,10.396,0,6.289-5.099,11.388-11.388,11.388s-11.388-5.099-11.388-11.388c0-4.634,2.769-8.618,6.741-10.396Z" fill="#ff8274" /><path d="M92.492,9.617c0-3.072,2.08-5.562,4.647-5.562h0c2.566,0,4.647,2.49,4.647,5.562v21.195h-9.294V9.617Z" fill="#fff" /><path d="M92.49,43.951h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,36.148h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,28.344h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,20.541h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M92.49,12.737h3.402c.217,0,.393.305.393.682h0c0,.377-.176.682-.393.682h-3.402v-1.364Z" fill="#2a2859" /><path d="M88.883,62.227c0-2.256,1.037-4.085,2.316-4.085s2.316,1.829,2.316,4.085-1.037,4.085-2.316,4.085-2.316-1.829-2.316-4.085Z" fill="#fff" /></g><g className={`tiltak-shape tiltak-tetting_vinduer_dorer ${activeTiltak.includes('Tetting') ? 'tiltak--visible' : ''}`}><path d="M52.459,54.953v13.04h-13.04v-13.04h13.04M55.162,52.249h-18.446v18.446h18.446v-18.446h0Z" fill="#43f8b6" /><polygon points="54.347 106.81 36.185 106.81 33.482 106.81 33.482 109.514 33.482 127.676 36.185 127.676 36.185 109.514 54.347 109.514 54.347 127.676 57.051 127.676 57.051 109.514 57.051 106.81 54.347 106.81" fill="#43f8b6" /><path d="M119.685,79.162v26.182h-13.04v-26.182h13.04M122.389,76.458h-18.446v31.589h18.446v-31.589h0Z" fill="#43f8b6" /></g><g className={`tiltak-shape tiltak-oppgradering_vinduer ${activeTiltak.includes('Oppgradering av vindu') ? 'tiltak--visible' : ''}`}><path d="M52.821,54.441v14.025h-14.025v-14.025h14.025M55.525,51.737h-19.432v19.432h19.432v-19.432h0Z" fill="#43f8b6" /><rect x="40.418" y="56.063" width="10.781" height="4.861" fill="#6a688b" /><path d="M52.821,68.466h-14.025v-14.025h14.025v14.025ZM40.418,66.844h10.781v-10.781h-10.781v10.781Z" fill="#fff" /><path d="M120.722,78.294v28.975h-15.374v-28.975h15.374M123.426,75.591h-20.781v34.382h20.781v-34.382h0Z" fill="#42f8b5" /><rect x="107.126" y="80.073" width="11.818" height="10.104" fill="#6a688b" /><path d="M120.722,107.265h-15.374v-28.971h15.374v28.971ZM107.126,105.487h11.818v-25.415h-11.818v25.415Z" fill="#fff" /><path d="M32.258,53.252c3.931-.724,4.518-1.31,5.242-5.242.724,3.931,1.31,4.518,5.242,5.242-3.931.724-4.518,1.31-5.242,5.242-.724-3.931-1.31-4.518-5.242-5.242Z" fill="#fff" /><path d="M117.215,109.373c3.931-.724,4.518-1.31,5.242-5.242.724,3.931,1.31,4.518,5.242,5.242-3.931.724-4.518,1.31-5.242,5.242-.724-3.931-1.31-4.518-5.242-5.242Z" fill="#fff" /></g><g className={`tiltak-shape tiltak-varmepumpe ${activeTiltak.includes('Varmepumpe') ? 'tiltak--visible' : ''}`}><rect x="66.343" y="105.361" width="35.668" height="21.226" fill="#43f8b6" /><path d="M104.039,128.614h-39.723v-25.281h39.723v25.281ZM68.371,124.559h31.613v-17.171h-31.613v17.171Z" fill="#43f8b6" /><path d="M108.377,117.335c-.102-3.404-2.938-6.17-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.365-.478,2.673-1.46,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.747,4.522-1.989,1.223-1.255,1.895-2.956,1.843-4.666Z" fill="#43f8b6" /><path d="M99.984,126.074v-5.398l1.958-.067c.834-.029,1.585-.362,2.171-.965.596-.612.911-1.395.886-2.207-.048-1.588-1.419-2.926-3.057-2.982l-1.958-.067v-5.398l2.082.056c4.54.122,8.202,3.737,8.337,8.228h0c.068,2.256-.813,4.495-2.418,6.142-1.574,1.616-3.677,2.54-5.919,2.601l-2.082.056Z" fill="#43f8b6" /><path d="M108.377,114.219c-.102-3.404-2.938-6.174-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.366-.478,2.673-1.461,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.746,4.522-1.989,1.223-1.256,1.895-2.956,1.843-4.666Z" fill="#43f8b6" /><path d="M99.984,122.957v-5.398l1.958-.067c.834-.029,1.585-.362,2.171-.964.596-.612.911-1.396.887-2.207-.048-1.588-1.419-2.926-3.057-2.982l-1.958-.067v-5.397l2.08.054c4.541.119,8.204,3.733,8.339,8.229h0c.068,2.256-.813,4.495-2.417,6.142-1.575,1.617-3.677,2.54-5.92,2.601l-2.082.056Z" fill="#43f8b6" /><path d="M108.377,117.336c-.102-3.404-2.938-6.17-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.365-.478,2.673-1.46,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.747,4.522-1.989,1.223-1.255,1.895-2.956,1.843-4.666Z" fill="#2a2859" /><rect x="102.799" y="114.801" width="2.333" height="2.333" fill="#43f8b6" /><path d="M108.377,114.22c-.102-3.404-2.938-6.174-6.365-6.263v1.356c2.703.092,4.933,2.268,5.014,4.947.041,1.366-.478,2.673-1.461,3.682-.953.979-2.209,1.53-3.554,1.576v1.356c1.713-.046,3.312-.746,4.522-1.989,1.223-1.256,1.895-2.956,1.843-4.666Z" fill="#fff" /><rect x="92.075" y="107.57" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,108.963v-1.799h9.226s0,1.799,0,1.799h-9.226ZM92.481,107.976v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="92.075" y="112.843" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,114.237v-1.799h9.226s0,1.798,0,1.798h-9.226ZM92.481,113.249v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="92.075" y="118.116" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,119.51v-1.799h9.226s0,1.799,0,1.799h-9.226ZM92.481,118.522v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="92.075" y="123.389" width="8.415" height=".988" fill="#2a2859" /><path d="M91.67,124.783v-1.799h9.226s0,1.799,0,1.799h-9.226ZM92.481,123.795v.177h7.604v-.177h-7.604Z" fill="#2a2959" /><rect x="66.343" y="105.36" width="24.212" height="21.226" transform="translate(156.898 231.946) rotate(180)" fill="#fff" /><circle cx="78.708" cy="115.974" r="8.183" fill="#43f8b6" /><path d="M79.374,108.824v5.975l5.14-3.046c-1.211-1.664-3.098-2.739-5.14-2.929Z" fill="#2a2859" /><path d="M72.902,111.753l5.14,3.047v-5.975c-2.042.19-3.929,1.265-5.14,2.929Z" fill="#2a2859" /><path d="M72.223,119.037l5.18-3.07-5.18-3.07c-.451.953-.689,2.009-.689,3.07s.237,2.116.689,3.07Z" fill="#2a2859" /><path d="M85.194,112.897l-5.18,3.07,5.18,3.07c.451-.953.689-2.009.689-3.07s-.237-2.116-.689-3.07Z" fill="#2a2859" /><path d="M78.043,123.111v-5.975l-5.14,3.047c1.211,1.663,3.098,2.738,5.14,2.929Z" fill="#2a2859" /><path d="M84.514,120.182l-5.14-3.047v5.975c2.042-.19,3.929-1.265,5.14-2.929Z" fill="#2a2859" /><circle cx="78.708" cy="115.974" r="1.993" fill="#2a2859" /></g>
            </svg>
        </div>
      )}

      {/* Blokk1 - initial block that animates to same position as Enebolig2 */}
      {!isEnebolig && (
        <div 
          ref={blokk1Ref}
          style={{
            position: 'absolute',
            bottom: animateBlokk ? '55px' : '0px', // Start at bottom 0, end at 55px
            left: animateBlokk ? '50%' : '1051px', // Start at absolute position, end at center
            transform: animateBlokk 
              ? 'translateX(calc(235.5px + 74px)) scale(3)' // End position (same as Enebolig2's bottom left corner)
              : 'translateX(0) scale(1)', // Start position
            transformOrigin: 'bottom left',
            opacity: blokk1Opacity,
            transition: 'transform 2s ease-in-out, opacity 2s ease-in-out, bottom 2s ease-in-out, left 2s ease-in-out',
            zIndex: 3
          }}
        >
          <svg width="136" height="204" viewBox="0 0 136 204" fill="none">
            {/* <path d="M86.73 0L99.03 12.326H111.34V24.652H123.65V36.977H135.96V49.303H123.65H86.73V36.977H49.8V0H86.73Z" fill="#2A2859"/>
            <path d="M99.03 49.302H135.96V203.374H99.03V49.302Z" fill="#F8F0DD"/>
            <path d="M12.87 36.977V24.651H25.17V12.325H37.48L49.79 0L62.1 12.325H74.41V24.651H86.72V36.977H99.03V49.303V203.375H0.57V49.303V36.977H12.87Z" fill="#D0BFAE"/>
            <path d="M43.64 191.049H55.95V203.375H43.64V191.049Z" fill="#2A2859"/>
            <path d="M68.25 61.628H80.56V73.954H68.25V61.628Z" fill="#2A2859"/>
            <path d="M43.64 61.628H55.95V73.954H43.64V61.628Z" fill="#2A2859"/>
            <path d="M19.02 61.628H31.33V73.954H19.02V61.628Z" fill="#2A2859"/>
            <path d="M68.25 86.279H80.56V98.604H68.25V86.279Z" fill="#2A2859"/>
            <path d="M43.64 86.279H55.95V98.604H43.64V86.279Z" fill="#2A2859"/>
            <path d="M19.02 86.279H31.33V98.604H19.02V86.279Z" fill="#2A2859"/>
            <path d="M68.25 110.93H80.56V123.256H68.25V110.93Z" fill="#2A2859"/>
            <path d="M43.64 110.93H55.95V123.256H43.64V110.93Z" fill="#2A2859"/>
            <path d="M19.02 110.93H31.33V123.256H19.02V110.93Z" fill="#2A2859"/> */}

            <g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-03 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`}><polygon points="7.771 41.726 35.687 1.917 61.872 1.917 33.955 41.726 7.771 41.726" fill="#fff" /><path d="M58.186,3.834l-25.228,35.975H11.456L36.684,3.834h21.501M65.557,0h-30.867l-1.145,1.633L8.317,37.607l-4.232,6.035h30.867l1.145-1.633L61.325,6.035l4.232-6.035h0Z" fill="#42f8b5" /><polygon points="36.684 3.834 58.186 3.834 32.958 39.809 11.456 39.809 36.684 3.834" fill="#2a2959" stroke="#2a2959" strokeMiterlimit="10" strokeWidth="2.556" /><rect x="39.578" y="5.931" width="2.452" height="13.837" transform="translate(78.744 -6.917) rotate(135)" fill="#bcbec0" /></g><path id="blokk2-02" d="M120.744,41.319v-12.023h-12.1v-12.023h-12.544c-3.42-3.489-6.839-6.979-10.259-10.468h-35.318c3.65,3.65,7.299,7.299,10.949,10.949h12.269v11.542h12.1v12.023h11.434v12.023h34.902v-12.023h-11.434Z" fill="#2a2959" /><rect x="62.858" y="2.48" width="2.452" height="15.367" transform="translate(25.957 -42.337) rotate(45)" fill="#bcbec0" className={`tiltak-shape tiltak-solenergi tiltak-solenergi-02 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`} /><g id="blokk2-01"><rect x="97.276" y="53.342" width="34.902" height="145.509" fill="#f8f0dd" /><polygon points="85.842 41.319 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.217 29.296 15.217 41.319 3.783 41.319 3.783 53.342 3.783 198.851 97.276 198.851 97.276 53.342 97.276 41.319 85.842 41.319" fill="#d0bfae" /><rect x="44.967" y="111.844" width="11.126" height="11.126" fill="#2a2959" /><rect x="44.967" y="187.725" width="11.126" height="11.126" fill="#2a2959" /><rect x="44.967" y="88.439" width="11.126" height="11.126" fill="#2a2959" /><rect x="44.967" y="65.034" width="11.126" height="11.126" fill="#2a2959" /><rect x="68.158" y="111.844" width="11.126" height="11.126" fill="#2a2959" /><rect x="68.158" y="88.439" width="11.126" height="11.126" fill="#2a2959" /><rect x="68.158" y="65.034" width="11.126" height="11.126" fill="#2a2959" /><rect x="21.775" y="111.844" width="11.126" height="11.126" fill="#2a2959" /><rect x="21.775" y="88.439" width="11.126" height="11.126" fill="#2a2959" /><rect x="21.775" y="65.034" width="11.126" height="11.126" fill="#2a2959" /><rect x="63.66" y="186.829" width="14.57" height="3.975" transform="translate(-117.872 259.761) rotate(-90)" fill="#d0bfae" /></g><g className={`tiltak-shape tiltak-etterisolering_kjeller_loft ${activeTiltak.includes('Isolering av kjeller og loft') ? 'tiltak--visible' : ''}`}><polygon points="19.051 45.153 19.051 41.32 19.051 33.13 27.317 33.13 31.151 33.13 31.151 29.296 31.151 21.588 39.575 21.588 41.163 21.588 42.286 20.465 50.524 12.227 58.762 20.465 59.885 21.588 61.473 21.588 69.908 21.588 69.908 29.296 69.908 33.13 73.742 33.13 82.008 33.13 82.008 41.32 82.008 45.153 85.842 45.153 97.276 45.153 97.276 41.32 85.842 41.32 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.218 29.296 15.218 41.32 3.783 41.32 3.783 45.153 15.218 45.153 19.051 45.153" fill="#42f8b5" /><rect x="56.092" y="195.017" width="76.086" height="3.834" fill="#42f8b5" /><rect x="3.783" y="195.017" width="41.184" height="3.834" fill="#42f8b5" /></g><g className={`tiltak-shape tiltak-varmepumpe ${activeTiltak.includes('Varmepumpe') ? 'tiltak--visible' : ''}`}><rect x="74.425" y="178.783" width="33.724" height="20.069" fill="#43f8b6" /><path d="M110.066,200.769h-37.558v-23.903h37.558v23.903ZM76.342,196.935h29.89v-16.235h-29.89v16.235Z" fill="#43f8b6" /><path d="M114.167,190.105c-.097-3.218-2.778-5.834-6.018-5.921v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.881,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#43f8b6" /><path d="M106.232,198.367v-5.104l1.851-.064c.788-.027,1.498-.342,2.053-.912.564-.579.861-1.32.838-2.086-.045-1.502-1.342-2.767-2.89-2.82l-1.852-.063v-5.104l1.969.053c4.292.116,7.754,3.533,7.883,7.78h0c.064,2.133-.769,4.25-2.286,5.807-1.489,1.528-3.476,2.402-5.597,2.459l-1.969.053Z" fill="#43f8b6" /><path d="M114.167,187.159c-.097-3.218-2.777-5.837-6.018-5.922v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.88,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#43f8b6" /><path d="M106.232,195.42v-5.104l1.851-.064c.788-.027,1.498-.342,2.053-.912.563-.578.861-1.319.838-2.086-.045-1.502-1.342-2.767-2.89-2.82l-1.852-.063v-5.103l1.967.051c4.293.112,7.756,3.53,7.885,7.78h0c.064,2.133-.769,4.25-2.286,5.807-1.489,1.528-3.477,2.402-5.597,2.459l-1.969.053Z" fill="#43f8b6" /><path d="M114.167,190.105c-.097-3.218-2.778-5.834-6.018-5.921v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.881,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#2a2859" /><rect x="108.893" y="187.708" width="2.206" height="2.206" fill="#43f8b6" /><path d="M114.167,187.159c-.097-3.218-2.777-5.837-6.018-5.922v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.88,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#fff" /><rect x="98.754" y="180.872" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,182.189v-1.701h8.723s0,1.7,0,1.7h-8.723ZM99.138,181.255v.167h7.19v-.168h-7.19Z" fill="#2a2959" /><rect x="98.754" y="185.857" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,187.175v-1.701h8.723s0,1.701,0,1.701h-8.723ZM99.138,186.241v.167h7.19v-.167h-7.19Z" fill="#2a2959" /><rect x="98.754" y="190.843" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,192.161v-1.701h8.723s0,1.701,0,1.701h-8.723ZM99.138,191.227v.167h7.19v-.167h-7.19Z" fill="#2a2959" /><rect x="98.754" y="195.829" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,197.146v-1.701h8.723s0,1.7,0,1.7h-8.723ZM99.138,196.212v.167h7.19v-.168h-7.19Z" fill="#2a2959" /><rect x="74.425" y="178.782" width="22.892" height="20.069" transform="translate(171.741 377.633) rotate(180)" fill="#fff" /><circle cx="86.116" cy="188.817" r="7.737" fill="#43f8b6" /><path d="M86.745,182.057v5.649l4.86-2.88c-1.145-1.573-2.929-2.589-4.86-2.769Z" fill="#2a2859" /><path d="M80.627,184.826l4.86,2.88v-5.65c-1.931.18-3.715,1.196-4.86,2.769Z" fill="#2a2859" /><path d="M79.984,191.714l4.898-2.902-4.898-2.903c-.427.901-.651,1.899-.651,2.903s.225,2.001.651,2.902Z" fill="#2a2859" /><path d="M92.248,185.909l-4.898,2.903,4.898,2.902c.427-.901.651-1.899.651-2.902s-.225-2.001-.651-2.903Z" fill="#2a2859" /><path d="M85.487,195.565v-5.649l-4.86,2.88c1.145,1.573,2.929,2.589,4.86,2.769Z" fill="#2a2859" /><path d="M91.605,192.796l-4.86-2.88v5.649c1.931-.18,3.715-1.196,4.86-2.769Z" fill="#2a2859" /><circle cx="86.116" cy="188.817" r="1.885" fill="#2a2859" /></g><g className={`tiltak-shape tiltak-ventilasjon ${activeTiltak.includes('Ventilasjon') ? 'tiltak--visible' : ''}`}><rect x="35.331" y="31.715" width="30.261" height="19.609" fill="#fff" /><path d="M64.314,32.993v17.053h-27.705v-17.053h27.705M66.87,30.437h-32.817v22.165h32.817v-22.165h0Z" fill="#43f8b6" /><rect x="39.327" y="35.103" width="22.519" height="2.649" fill="#2a2859" /><rect x="39.327" y="40.349" width="22.519" height="2.649" fill="#2a2859" /><rect x="39.327" y="45.596" width="22.519" height="2.649" fill="#2a2859" /></g><g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-01 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`}><polygon points="98.517 41.755 64.135 1.947 95.682 1.947 130.065 41.755 98.517 41.755" fill="#fff" /><path d="M94.805,3.864l31.071,35.975h-26.481L68.323,3.864h26.481M96.559.03h-36.613l5.476,6.34,31.071,35.975,1.147,1.328h36.613l-5.476-6.34L97.706,1.358l-1.147-1.328h0Z" fill="#42f8b5" /><polygon points="125.876 39.838 99.395 39.838 68.323 3.864 94.805 3.864 125.876 39.838" fill="#2a2959" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="79.123" y1="15.919" x2="104.829" y2="15.919" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="89.37" y1="27.783" x2="115.077" y2="27.783" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="77.23" y1="4.054" x2="107.973" y2="39.648" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="86.227" y1="4.054" x2="116.969" y2="39.648" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /></g><g className={`tiltak-shape tiltak-etterisolering_yttervegger ${activeTiltak.includes('Etterisolering av yttervegg') ? 'tiltak--visible' : ''}`}><rect x="130.928" y="41.296" width="3.834" height="157.576" fill="#42f8b5" /><rect x=".001" y="41.296" width="3.834" height="157.578" fill="#42f8b5" /></g><g className={`tiltak-shape tiltak-temperaturstyring ${activeTiltak.includes('Temperaturstyring') ? 'tiltak--visible' : ''}`}><path d="M96.5,60.937c0-2.905,1.967-5.259,4.394-5.259h0c2.426,0,4.394,2.355,4.394,5.259v20.039h-8.787v-20.039Z" fill="#fff" /><path d="M100.893,55.677c2.426,0,4.394,2.355,4.394,5.259v36.534c3.756,1.681,6.374,5.448,6.374,9.829,0,5.947-4.821,10.767-10.767,10.767s-10.767-4.821-10.767-10.767c0-4.381,2.618-8.148,6.374-9.829v-2.782h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.089h-.001v-1.29h.001v-2.95c0-2.905,1.967-5.259,4.394-5.259h0M100.893,51.843c-4.267,0-7.785,3.608-8.189,8.209h-.039v3.834s-.001,1.29-.001,1.29v3.834h0v2.255s0,1.29,0,1.29v3.834h0v2.254s0,1.29,0,1.29v3.834h0v2.254s0,1.29,0,1.29v3.834h0v2.255s0,1.29,0,1.29v.552c-3.937,2.69-6.373,7.19-6.373,12.06,0,8.051,6.55,14.601,14.601,14.601s14.601-6.55,14.601-14.601c0-4.87-2.436-9.37-6.374-12.06v-34.303c0-5.014-3.691-9.093-8.227-9.093h0Z" fill="#42f8b5" /><path d="M96.5,97.471v-16.495h8.787v16.495c3.756,1.681,6.374,5.448,6.374,9.829,0,5.947-4.821,10.767-10.767,10.767s-10.767-4.821-10.767-10.767c0-4.381,2.618-8.148,6.374-9.829Z" fill="#ff8274" /><path d="M96.499,93.399h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,86.021h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,78.642h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,71.264h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,63.886h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M93.088,110.678c0-2.133.98-3.862,2.19-3.862s2.19,1.729,2.19,3.862-.98,3.862-2.19,3.862-2.19-1.729-2.19-3.862Z" fill="#fff" /></g><g className={`tiltak-shape tiltak-tetting_vinduer_dorer ${activeTiltak.includes('Tetting') ? 'tiltak--visible' : ''}`}><path d="M56.149,111.858v11.126h-11.126v-11.126h11.126M58.705,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><polygon points="56.149 185.183 45.024 185.183 42.468 185.183 42.468 187.739 42.468 198.865 45.024 198.865 45.024 187.739 56.149 187.739 56.149 198.865 58.705 198.865 58.705 187.739 58.705 185.183 56.149 185.183" fill="#43f8b6" /><path d="M56.149,88.453v11.126h-11.126v-11.126h11.126M58.705,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M56.149,65.048v11.126h-11.126v-11.126h11.126M58.705,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M79.341,111.858v11.126h-11.126v-11.126h11.126M81.896,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M79.341,88.453v11.126h-11.126v-11.126h11.126M81.896,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M79.341,65.048v11.126h-11.126v-11.126h11.126M81.896,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M32.958,111.858v11.126h-11.126v-11.126h11.126M35.514,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M32.958,88.453v11.126h-11.126v-11.126h11.126M35.514,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M32.958,65.048v11.126h-11.126v-11.126h11.126M35.514,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /></g><g className={`tiltak-shape tiltak-oppgradering_vinduer ${activeTiltak.includes('Oppgradering av vindu') ? 'tiltak--visible' : ''}`}><path d="M80.712,111.384v13.261h-13.261v-13.261h13.261M83.268,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="68.985" y="112.917" width="10.194" height="4.596" transform="translate(148.164 230.43) rotate(180)" fill="#6a688b" /><path d="M67.452,124.644h13.261v-13.261h-13.261v13.261ZM79.179,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M57.516,111.384v13.261h-13.261v-13.261h13.261M60.072,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="45.788" y="112.917" width="10.194" height="4.596" transform="translate(101.77 230.43) rotate(180)" fill="#6a688b" /><path d="M44.255,124.644h13.261v-13.261h-13.261v13.261ZM55.982,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M34.33,111.384v13.261h-13.261v-13.261h13.261M36.886,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="22.603" y="112.917" width="10.194" height="4.596" transform="translate(55.399 230.43) rotate(180)" fill="#6a688b" /><path d="M21.069,124.644h13.261v-13.261h-13.261v13.261ZM32.796,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M80.707,87.978v13.261h-13.261v-13.261h13.261M83.263,85.423h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="68.98" y="89.512" width="10.194" height="4.596" transform="translate(148.153 183.62) rotate(180)" fill="#6a688b" /><path d="M67.446,101.239h13.261v-13.261h-13.261v13.261ZM79.173,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M57.51,87.978v13.261h-13.261v-13.261h13.261M60.066,85.422h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="45.783" y="89.512" width="10.194" height="4.596" transform="translate(101.759 183.619) rotate(180)" fill="#6a688b" /><path d="M44.249,101.239h13.261v-13.261h-13.261v13.261ZM55.976,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M34.324,87.978v13.261h-13.261v-13.261h13.261M36.88,85.422h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="22.597" y="89.512" width="10.194" height="4.596" transform="translate(55.388 183.62) rotate(180)" fill="#6a688b" /><path d="M21.064,101.239h13.261v-13.261h-13.261v13.261ZM32.791,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M80.712,64.573v13.261h-13.261v-13.261h13.261M83.268,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="68.985" y="66.107" width="10.194" height="4.596" transform="translate(148.164 136.809) rotate(180)" fill="#6a688b" /><path d="M67.452,77.834h13.261v-13.261h-13.261v13.261ZM79.179,76.301h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M57.516,64.573v13.261h-13.261v-13.261h13.261M60.072,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="45.788" y="66.107" width="10.194" height="4.596" transform="translate(101.77 136.809) rotate(180)" fill="#6a688b" /><path d="M44.255,77.834h13.261v-13.261h-13.261v13.261ZM55.982,76.3h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M34.33,64.573v13.261h-13.261v-13.261h13.261M36.886,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="22.603" y="66.107" width="10.194" height="4.596" transform="translate(55.399 136.809) rotate(180)" fill="#6a688b" /><path d="M21.069,77.834h13.261v-13.261h-13.261v13.261ZM32.796,76.301h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M11.895,63.304c5.924-1.091,6.809-1.975,7.899-7.899,1.091,5.924,1.975,6.809,7.899,7.899-5.924,1.091-6.809,1.975-7.899,7.899-1.091-5.924-1.975-6.809-7.899-7.899Z" fill="#fff" /><path d="M77.659,126.704c3.717-.684,4.272-1.239,4.956-4.956.684,3.717,1.239,4.272,4.956,4.956-3.717.684-4.272,1.239-4.956,4.956-.684-3.717-1.239-4.272-4.956-4.956Z" fill="#fff" /></g>


          </svg>
        </div>
      )}

      {/* Blokk2 - fades in as Blokk1 fades out */}
      {!isEnebolig && (
        <div 
          ref={blokk2ContainerRef}
          style={{
            position: 'absolute',
            bottom: '55px',
            left: '50%',
            transform: 'translateX(calc(235.5px + 74px)) scale(3)',
            transformOrigin: 'bottom left',
            opacity: animateBlokk ? 1 : 0,
            transition: 'opacity 2s ease-in-out 1s', // Delay opacity transition
            zIndex: 2
          }}
        >
          
          <svg width="136" height="204" viewBox="0 0 136 204" id="blokk2_layer" >
            
              <polygon 
                id="ARROW_ADD" 
                className={`tiltak-arrow ${arrowState === 'add' ? 'tiltak-arrow--add' : ''}`}
                points="12.53 3.816 8.714 3.816 8.714 0 3.816 0 3.816 3.816 0 3.816 0 8.714 3.816 8.714 3.816 12.53 8.714 12.53 8.714 8.714 12.53 8.714 12.53 3.816" fill={arrowColor}
              />
              
              <rect 
                id="ARROW_SUBTRACT" 
                className={`tiltak-arrow ${arrowState === 'remove' ? 'tiltak-arrow--remove' : ''}`}
                y="3.816" width="12.53" height="4.898" fill={arrowColor}
              />


            <g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-03 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`}><polygon points="7.771 41.726 35.687 1.917 61.872 1.917 33.955 41.726 7.771 41.726" fill="#fff" /><path d="M58.186,3.834l-25.228,35.975H11.456L36.684,3.834h21.501M65.557,0h-30.867l-1.145,1.633L8.317,37.607l-4.232,6.035h30.867l1.145-1.633L61.325,6.035l4.232-6.035h0Z" fill="#42f8b5" /><polygon points="36.684 3.834 58.186 3.834 32.958 39.809 11.456 39.809 36.684 3.834" fill="#2a2959" stroke="#2a2959" strokeMiterlimit="10" strokeWidth="2.556" /><rect x="39.578" y="5.931" width="2.452" height="13.837" transform="translate(78.744 -6.917) rotate(135)" fill="#bcbec0" /></g><path id="blokk2-02" d="M120.744,41.319v-12.023h-12.1v-12.023h-12.544c-3.42-3.489-6.839-6.979-10.259-10.468h-35.318c3.65,3.65,7.299,7.299,10.949,10.949h12.269v11.542h12.1v12.023h11.434v12.023h34.902v-12.023h-11.434Z" fill="#2a2959" /><rect x="62.858" y="2.48" width="2.452" height="15.367" transform="translate(25.957 -42.337) rotate(45)" fill="#bcbec0" className={`tiltak-shape tiltak-solenergi tiltak-solenergi-02 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`} /><g id="blokk2-01"><rect x="97.276" y="53.342" width="34.902" height="145.509" fill="#f8f0dd" /><polygon points="85.842 41.319 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.217 29.296 15.217 41.319 3.783 41.319 3.783 53.342 3.783 198.851 97.276 198.851 97.276 53.342 97.276 41.319 85.842 41.319" fill="#d0bfae" /><rect x="44.967" y="111.844" width="11.126" height="11.126" fill="#2a2959" /><rect x="44.967" y="187.725" width="11.126" height="11.126" fill="#2a2959" /><rect x="44.967" y="88.439" width="11.126" height="11.126" fill="#2a2959" /><rect x="44.967" y="65.034" width="11.126" height="11.126" fill="#2a2959" /><rect x="68.158" y="111.844" width="11.126" height="11.126" fill="#2a2959" /><rect x="68.158" y="88.439" width="11.126" height="11.126" fill="#2a2959" /><rect x="68.158" y="65.034" width="11.126" height="11.126" fill="#2a2959" /><rect x="21.775" y="111.844" width="11.126" height="11.126" fill="#2a2959" /><rect x="21.775" y="88.439" width="11.126" height="11.126" fill="#2a2959" /><rect x="21.775" y="65.034" width="11.126" height="11.126" fill="#2a2959" /><rect x="63.66" y="186.829" width="14.57" height="3.975" transform="translate(-117.872 259.761) rotate(-90)" fill="#d0bfae" /></g><g className={`tiltak-shape tiltak-etterisolering_kjeller_loft ${activeTiltak.includes('Isolering av kjeller og loft') ? 'tiltak--visible' : ''}`}><polygon points="19.051 45.153 19.051 41.32 19.051 33.13 27.317 33.13 31.151 33.13 31.151 29.296 31.151 21.588 39.575 21.588 41.163 21.588 42.286 20.465 50.524 12.227 58.762 20.465 59.885 21.588 61.473 21.588 69.908 21.588 69.908 29.296 69.908 33.13 73.742 33.13 82.008 33.13 82.008 41.32 82.008 45.153 85.842 45.153 97.276 45.153 97.276 41.32 85.842 41.32 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.218 29.296 15.218 41.32 3.783 41.32 3.783 45.153 15.218 45.153 19.051 45.153" fill="#42f8b5" /><rect x="56.092" y="195.017" width="76.086" height="3.834" fill="#42f8b5" /><rect x="3.783" y="195.017" width="41.184" height="3.834" fill="#42f8b5" /></g><g className={`tiltak-shape tiltak-varmepumpe ${activeTiltak.includes('Varmepumpe') ? 'tiltak--visible' : ''}`}><rect x="74.425" y="178.783" width="33.724" height="20.069" fill="#43f8b6" /><path d="M110.066,200.769h-37.558v-23.903h37.558v23.903ZM76.342,196.935h29.89v-16.235h-29.89v16.235Z" fill="#43f8b6" /><path d="M114.167,190.105c-.097-3.218-2.778-5.834-6.018-5.921v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.881,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#43f8b6" /><path d="M106.232,198.367v-5.104l1.851-.064c.788-.027,1.498-.342,2.053-.912.564-.579.861-1.32.838-2.086-.045-1.502-1.342-2.767-2.89-2.82l-1.852-.063v-5.104l1.969.053c4.292.116,7.754,3.533,7.883,7.78h0c.064,2.133-.769,4.25-2.286,5.807-1.489,1.528-3.476,2.402-5.597,2.459l-1.969.053Z" fill="#43f8b6" /><path d="M114.167,187.159c-.097-3.218-2.777-5.837-6.018-5.922v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.88,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#43f8b6" /><path d="M106.232,195.42v-5.104l1.851-.064c.788-.027,1.498-.342,2.053-.912.563-.578.861-1.319.838-2.086-.045-1.502-1.342-2.767-2.89-2.82l-1.852-.063v-5.103l1.967.051c4.293.112,7.756,3.53,7.885,7.78h0c.064,2.133-.769,4.25-2.286,5.807-1.489,1.528-3.477,2.402-5.597,2.459l-1.969.053Z" fill="#43f8b6" /><path d="M114.167,190.105c-.097-3.218-2.778-5.834-6.018-5.921v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.881,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#2a2859" /><rect x="108.893" y="187.708" width="2.206" height="2.206" fill="#43f8b6" /><path d="M114.167,187.159c-.097-3.218-2.777-5.837-6.018-5.922v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.88,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#fff" /><rect x="98.754" y="180.872" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,182.189v-1.701h8.723s0,1.7,0,1.7h-8.723ZM99.138,181.255v.167h7.19v-.168h-7.19Z" fill="#2a2959" /><rect x="98.754" y="185.857" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,187.175v-1.701h8.723s0,1.701,0,1.701h-8.723ZM99.138,186.241v.167h7.19v-.167h-7.19Z" fill="#2a2959" /><rect x="98.754" y="190.843" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,192.161v-1.701h8.723s0,1.701,0,1.701h-8.723ZM99.138,191.227v.167h7.19v-.167h-7.19Z" fill="#2a2959" /><rect x="98.754" y="195.829" width="7.957" height=".934" fill="#2a2859" /><path d="M98.371,197.146v-1.701h8.723s0,1.7,0,1.7h-8.723ZM99.138,196.212v.167h7.19v-.168h-7.19Z" fill="#2a2959" /><rect x="74.425" y="178.782" width="22.892" height="20.069" transform="translate(171.741 377.633) rotate(180)" fill="#fff" /><circle cx="86.116" cy="188.817" r="7.737" fill="#43f8b6" /><path d="M86.745,182.057v5.649l4.86-2.88c-1.145-1.573-2.929-2.589-4.86-2.769Z" fill="#2a2859" /><path d="M80.627,184.826l4.86,2.88v-5.65c-1.931.18-3.715,1.196-4.86,2.769Z" fill="#2a2859" /><path d="M79.984,191.714l4.898-2.902-4.898-2.903c-.427.901-.651,1.899-.651,2.903s.225,2.001.651,2.902Z" fill="#2a2859" /><path d="M92.248,185.909l-4.898,2.903,4.898,2.902c.427-.901.651-1.899.651-2.902s-.225-2.001-.651-2.903Z" fill="#2a2859" /><path d="M85.487,195.565v-5.649l-4.86,2.88c1.145,1.573,2.929,2.589,4.86,2.769Z" fill="#2a2859" /><path d="M91.605,192.796l-4.86-2.88v5.649c1.931-.18,3.715-1.196,4.86-2.769Z" fill="#2a2859" /><circle cx="86.116" cy="188.817" r="1.885" fill="#2a2859" /></g><g className={`tiltak-shape tiltak-ventilasjon ${activeTiltak.includes('Ventilasjon') ? 'tiltak--visible' : ''}`}><rect x="35.331" y="31.715" width="30.261" height="19.609" fill="#fff" /><path d="M64.314,32.993v17.053h-27.705v-17.053h27.705M66.87,30.437h-32.817v22.165h32.817v-22.165h0Z" fill="#43f8b6" /><rect x="39.327" y="35.103" width="22.519" height="2.649" fill="#2a2859" /><rect x="39.327" y="40.349" width="22.519" height="2.649" fill="#2a2859" /><rect x="39.327" y="45.596" width="22.519" height="2.649" fill="#2a2859" /></g><g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-01 ${activeTiltak.includes('Solenergi') ? 'tiltak--visible' : ''}`}><polygon points="98.517 41.755 64.135 1.947 95.682 1.947 130.065 41.755 98.517 41.755" fill="#fff" /><path d="M94.805,3.864l31.071,35.975h-26.481L68.323,3.864h26.481M96.559.03h-36.613l5.476,6.34,31.071,35.975,1.147,1.328h36.613l-5.476-6.34L97.706,1.358l-1.147-1.328h0Z" fill="#42f8b5" /><polygon points="125.876 39.838 99.395 39.838 68.323 3.864 94.805 3.864 125.876 39.838" fill="#2a2959" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="79.123" y1="15.919" x2="104.829" y2="15.919" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="89.37" y1="27.783" x2="115.077" y2="27.783" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="77.23" y1="4.054" x2="107.973" y2="39.648" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /><line x1="86.227" y1="4.054" x2="116.969" y2="39.648" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" /></g><g className={`tiltak-shape tiltak-etterisolering_yttervegger ${activeTiltak.includes('Etterisolering av yttervegg') ? 'tiltak--visible' : ''}`}><rect x="130.928" y="41.296" width="3.834" height="157.576" fill="#42f8b5" /><rect x=".001" y="41.296" width="3.834" height="157.578" fill="#42f8b5" /></g><g className={`tiltak-shape tiltak-temperaturstyring ${activeTiltak.includes('Temperaturstyring') ? 'tiltak--visible' : ''}`}><path d="M96.5,60.937c0-2.905,1.967-5.259,4.394-5.259h0c2.426,0,4.394,2.355,4.394,5.259v20.039h-8.787v-20.039Z" fill="#fff" /><path d="M100.893,55.677c2.426,0,4.394,2.355,4.394,5.259v36.534c3.756,1.681,6.374,5.448,6.374,9.829,0,5.947-4.821,10.767-10.767,10.767s-10.767-4.821-10.767-10.767c0-4.381,2.618-8.148,6.374-9.829v-2.782h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.089h-.001v-1.29h.001v-2.95c0-2.905,1.967-5.259,4.394-5.259h0M100.893,51.843c-4.267,0-7.785,3.608-8.189,8.209h-.039v3.834s-.001,1.29-.001,1.29v3.834h0v2.255s0,1.29,0,1.29v3.834h0v2.254s0,1.29,0,1.29v3.834h0v2.254s0,1.29,0,1.29v3.834h0v2.255s0,1.29,0,1.29v.552c-3.937,2.69-6.373,7.19-6.373,12.06,0,8.051,6.55,14.601,14.601,14.601s14.601-6.55,14.601-14.601c0-4.87-2.436-9.37-6.374-12.06v-34.303c0-5.014-3.691-9.093-8.227-9.093h0Z" fill="#42f8b5" /><path d="M96.5,97.471v-16.495h8.787v16.495c3.756,1.681,6.374,5.448,6.374,9.829,0,5.947-4.821,10.767-10.767,10.767s-10.767-4.821-10.767-10.767c0-4.381,2.618-8.148,6.374-9.829Z" fill="#ff8274" /><path d="M96.499,93.399h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,86.021h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,78.642h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,71.264h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M96.499,63.886h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" /><path d="M93.088,110.678c0-2.133.98-3.862,2.19-3.862s2.19,1.729,2.19,3.862-.98,3.862-2.19,3.862-2.19-1.729-2.19-3.862Z" fill="#fff" /></g><g className={`tiltak-shape tiltak-tetting_vinduer_dorer ${activeTiltak.includes('Tetting') ? 'tiltak--visible' : ''}`}><path d="M56.149,111.858v11.126h-11.126v-11.126h11.126M58.705,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><polygon points="56.149 185.183 45.024 185.183 42.468 185.183 42.468 187.739 42.468 198.865 45.024 198.865 45.024 187.739 56.149 187.739 56.149 198.865 58.705 198.865 58.705 187.739 58.705 185.183 56.149 185.183" fill="#43f8b6" /><path d="M56.149,88.453v11.126h-11.126v-11.126h11.126M58.705,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M56.149,65.048v11.126h-11.126v-11.126h11.126M58.705,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M79.341,111.858v11.126h-11.126v-11.126h11.126M81.896,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M79.341,88.453v11.126h-11.126v-11.126h11.126M81.896,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M79.341,65.048v11.126h-11.126v-11.126h11.126M81.896,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M32.958,111.858v11.126h-11.126v-11.126h11.126M35.514,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M32.958,88.453v11.126h-11.126v-11.126h11.126M35.514,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /><path d="M32.958,65.048v11.126h-11.126v-11.126h11.126M35.514,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" /></g><g className={`tiltak-shape tiltak-oppgradering_vinduer ${activeTiltak.includes('Oppgradering av vindu') ? 'tiltak--visible' : ''}`}><path d="M80.712,111.384v13.261h-13.261v-13.261h13.261M83.268,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="68.985" y="112.917" width="10.194" height="4.596" transform="translate(148.164 230.43) rotate(180)" fill="#6a688b" /><path d="M67.452,124.644h13.261v-13.261h-13.261v13.261ZM79.179,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M57.516,111.384v13.261h-13.261v-13.261h13.261M60.072,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="45.788" y="112.917" width="10.194" height="4.596" transform="translate(101.77 230.43) rotate(180)" fill="#6a688b" /><path d="M44.255,124.644h13.261v-13.261h-13.261v13.261ZM55.982,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M34.33,111.384v13.261h-13.261v-13.261h13.261M36.886,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="22.603" y="112.917" width="10.194" height="4.596" transform="translate(55.399 230.43) rotate(180)" fill="#6a688b" /><path d="M21.069,124.644h13.261v-13.261h-13.261v13.261ZM32.796,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M80.707,87.978v13.261h-13.261v-13.261h13.261M83.263,85.423h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="68.98" y="89.512" width="10.194" height="4.596" transform="translate(148.153 183.62) rotate(180)" fill="#6a688b" /><path d="M67.446,101.239h13.261v-13.261h-13.261v13.261ZM79.173,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M57.51,87.978v13.261h-13.261v-13.261h13.261M60.066,85.422h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="45.783" y="89.512" width="10.194" height="4.596" transform="translate(101.759 183.619) rotate(180)" fill="#6a688b" /><path d="M44.249,101.239h13.261v-13.261h-13.261v13.261ZM55.976,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M34.324,87.978v13.261h-13.261v-13.261h13.261M36.88,85.422h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="22.597" y="89.512" width="10.194" height="4.596" transform="translate(55.388 183.62) rotate(180)" fill="#6a688b" /><path d="M21.064,101.239h13.261v-13.261h-13.261v13.261ZM32.791,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M80.712,64.573v13.261h-13.261v-13.261h13.261M83.268,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="68.985" y="66.107" width="10.194" height="4.596" transform="translate(148.164 136.809) rotate(180)" fill="#6a688b" /><path d="M67.452,77.834h13.261v-13.261h-13.261v13.261ZM79.179,76.301h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M57.516,64.573v13.261h-13.261v-13.261h13.261M60.072,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="45.788" y="66.107" width="10.194" height="4.596" transform="translate(101.77 136.809) rotate(180)" fill="#6a688b" /><path d="M44.255,77.834h13.261v-13.261h-13.261v13.261ZM55.982,76.3h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M34.33,64.573v13.261h-13.261v-13.261h13.261M36.886,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" /><rect x="22.603" y="66.107" width="10.194" height="4.596" transform="translate(55.399 136.809) rotate(180)" fill="#6a688b" /><path d="M21.069,77.834h13.261v-13.261h-13.261v13.261ZM32.796,76.301h-10.194v-10.194h10.194v10.194Z" fill="#fff" /><path d="M11.895,63.304c5.924-1.091,6.809-1.975,7.899-7.899,1.091,5.924,1.975,6.809,7.899,7.899-5.924,1.091-6.809,1.975-7.899,7.899-1.091-5.924-1.975-6.809-7.899-7.899Z" fill="#fff" /><path d="M77.659,126.704c3.717-.684,4.272-1.239,4.956-4.956.684,3.717,1.239,4.272,4.956,4.956-3.717.684-4.272,1.239-4.956,4.956-.684-3.717-1.239-4.272-4.956-4.956Z" fill="#fff" /></g>
          
      
          </svg>
        </div>
      )}

      {/* White info box */}
      <WhiteInfoBox
        showHeader={showHeader}
        isExpanded={isExpanded}
        selectedSolution={selectedSolution}
        addressOnly={addressOnly}
        fontSize={fontSize}
        districtName={districtName}
        districtNameWidth={districtNameWidth}
        buildingTypeName={buildingTypeName}
        buildingTypeWidth={buildingTypeWidth}
        blocksStartX={blocksStartX}
        mapCoordinates={mapCoordinates}
        buildingData={updatedBuildingData}
        onExpand={setIsExpanded}
        showYellowBox={showYellowBox}
        gulListeLoading={gulListeLoading}
        onUpdateBuildingData={handleUpdateBuildingData}
        isYellowBoxExpanded={isYellowBoxExpanded}
        onYellowBoxExpandedChange={setIsYellowBoxExpanded}
        onCloseYellowBox={() => {
          setIsYellowBoxExpanded(false);
        }}
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
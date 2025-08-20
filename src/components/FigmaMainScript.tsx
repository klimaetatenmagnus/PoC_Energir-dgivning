
import React from 'react';
import { AddressLookupResponse } from '../services/buildingApi';
import { useAnimation } from './FigmaBlokk/hooks/useAnimation';
import { useAddressCoordinates } from './FigmaBlokk/hooks/useAddressCoordinates';
import { calculateFontSize, calculateBoxWidth, getTileUrl } from './FigmaBlokk/utils/calculations';
import { ENERGY_SOLUTIONS, BOX_MIN_WIDTHS } from './FigmaBlokk/constants';
import { getAnimationStyles, getLayoutStyles, getTitleStyles, getButtonTextStyles } from './FigmaBlokk/styles';
import { OsloSkyline } from './FigmaBlokk/components/OsloSkyline';
import { EnergySolutionButtons } from './FigmaBlokk/components/EnergySolutionButtons';
import { WhiteInfoBox } from './FigmaBlokk/components/WhiteInfoBox';
import { OsloLogo } from './FigmaBlokk/components/OsloLogo';
import { ProsessenVidere } from './FigmaBlokk/components/ProsessenVidere';
import { fetchSolarData, SolarEnergyData } from '../services/solarEnergyService';
import { sjekkGulListeMedGnrBnr } from '../services/gul-liste-service';
import { LYSEVEIEN_3_DATA } from '../testData/lyseveien3';
import { THERESES_11A_DATA } from '../testData/theresegate11a';
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

  // Use custom hooks for animations and coordinates
  const { fadeOpacity, blockTransform, showHeader } = useAnimation();
  const mapCoordinates = useAddressCoordinates(searchAddress);
  
  // State for expanded mode
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [selectedSolution, setSelectedSolution] = React.useState<string | null>(null);
  const [solarData, setSolarData] = React.useState<SolarEnergyData | null>(null);
  const [showYellowBox, setShowYellowBox] = React.useState(false);
  const [gulListeLoading, setGulListeLoading] = React.useState(true);
  const [isYellowBoxExpanded, setIsYellowBoxExpanded] = React.useState(false);
  
  // State for updated building data
  const [updatedBuildingData, setUpdatedBuildingData] = React.useState(buildingData);
  const [energiforbruk, setEnergiforbruk] = React.useState<string>(
    String(buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh || '300000')
  );

  // State for enebolig animation
  const [animateHouse, setAnimateHouse] = React.useState(false);
  const [enebolig1Opacity, setEnebolig1Opacity] = React.useState(1);
  const enebolig1Ref = React.useRef<SVGSVGElement>(null);
  const enebolig2ContainerRef = React.useRef<HTMLDivElement>(null);
  
  // State for process slide animation
  const [showProcess, setShowProcess] = React.useState(false);
  
  // Enebolig animation function
  const performHouseAnimation = () => {
    if (!enebolig1Ref.current || !enebolig2ContainerRef.current) return;

    // Get the paths from the first SVG
    const paths = enebolig1Ref.current.querySelectorAll('path');
    if (paths.length === 0) return;

    // Calculate house position in skyline SVG
    const svgRect = enebolig1Ref.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const svgViewBoxWidth = 1728;
    const svgScale = screenWidth / svgViewBoxWidth;
    
    // House position in SVG coordinates - more precise coordinates
    const houseX = 289.247; // leftmost x from the viewBox
    const houseY = 271.883; // topmost y from the viewBox
    const houseWidth = 92.307; // width from viewBox
    const houseHeight = 80.117; // height from viewBox

    // Calculate actual position on screen
    const actualLeft = svgRect.left + (houseX * svgScale);
    const actualTop = svgRect.top + (houseY * svgScale);
    const actualWidth = houseWidth * svgScale;
    const actualHeight = houseHeight * svgScale;

    // Create clone
    const clone = document.createElement('div');
    clone.style.cssText = `
      position: fixed;
      left: ${actualLeft}px;
      top: ${actualTop}px;
      width: ${actualWidth}px;
      height: ${actualHeight}px;
      z-index: 9999;
      pointer-events: none;
    `;

    // Create SVG for clone
    const svgClone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgClone.setAttribute('viewBox', '289.247 271.883 92.307 80.117');
    svgClone.style.width = '100%';
    svgClone.style.height = '100%';
    
    // Clone the house paths
    paths.forEach(path => {
      svgClone.appendChild(path.cloneNode(true));
    });
    
    clone.appendChild(svgClone);
    document.body.appendChild(clone);

    // Get target position
    const targetEl = enebolig2ContainerRef.current.querySelector('svg');
    if (!targetEl) return;
    
    // Calculate the final position of Enebolig2
    // The target is positioned with transform: translateX(calc(235.5px + 74px)) scale(5)
    const scale = 5;
    const targetWidth = 93 * scale; // SVG width * scale
    const targetHeight = 81 * scale; // SVG height * scale
    
    // Calculate the actual final position considering the transform
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const translateX = 235.5 + 74; // 309.5px
    const finalLeft = (viewportWidth / 2) + translateX;
    // The target is positioned with bottom: 55px, so we calculate from bottom
    const finalTop = viewportHeight - 55 - targetHeight;

    // Force reflow
    clone.offsetWidth;

    // Hide the original enebolig1 during animation
    setEnebolig1Opacity(0);

    // Add transition after initial positioning
    setTimeout(() => {
      clone.style.transition = 'all 2s ease-in-out';
      
      // Animate to target position
      clone.style.left = finalLeft + 'px';
      clone.style.top = finalTop + 'px';
      clone.style.width = targetWidth + 'px';
      clone.style.height = targetHeight + 'px';
    }, 10);

    // Show Enebolig2 slightly before animation ends
    setTimeout(() => {
      setAnimateHouse(true);
    }, 1800);

    // Remove the clone after animation completes (keep enebolig1 hidden)
    setTimeout(() => {
      if (clone && clone.parentNode) {
        clone.remove();
      }
      // Keep enebolig1 hidden - don't restore visibility
      // setEnebolig1Opacity(1);
    }, 2010); // After the 2s animation + 10ms delay

    // Keep Enebolig2 visible - don't hide it
    // setTimeout(() => {
    //   setAnimateHouse(false);
    // }, 4800); // Commented out - keep enebolig2 visible
  };

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
  
  // Fetch solar data when component mounts
  React.useEffect(() => {
    const loadSolarData = async () => {
      if (!buildingData) return;
      
      // TEST MODE: Check if this is test data
      if (searchAddress === "Lyseveien 3, 0362 OSLO" && buildingData.gnr === 33 && buildingData.bnr === 1139) {
        console.log('🧪 [TEST MODE] Using cached solar data for Lyseveien 3');
        setSolarData(LYSEVEIEN_3_DATA.solarData);
        return;
      } else if (searchAddress === "Thereses gate 11A, 0358 OSLO" && buildingData.gnr === 215 && buildingData.bnr === 156) {
        console.log('🧪 [TEST MODE] Using cached solar data for Thereses gate 11A');
        setSolarData(THERESES_11A_DATA.solarData);
        return;
      } else if (searchAddress === "Thereses gate 44A, 0168 OSLO" && buildingData.gnr === 215 && buildingData.bnr === 278) {
        console.log('🧪 [TEST MODE] Using cached solar data for Thereses gate 44A');
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
      
      console.log('🌞 Fetching solar data with params:', params);
      const data = await fetchSolarData(params);
      if (data) {
        console.log('🌞 Solar data received:', data);
        setSolarData(data);
      }
    };
    
    loadSolarData();
  }, [buildingData]);

  // Check gul liste status when component mounts
  React.useEffect(() => {
    const checkGulListe = async () => {
      if (!buildingData || !buildingData.gnr || !buildingData.bnr) {
        console.log('🏛️ Missing GNR/BNR, skipping gul liste check');
        setGulListeLoading(false);
        return;
      }
      
      try {
        console.log(`🏛️ Checking gul liste for GNR ${buildingData.gnr}, BNR ${buildingData.bnr}`);
        const result = await sjekkGulListeMedGnrBnr(buildingData.gnr, buildingData.bnr);
        
        if (result.erPaaGulListe) {
          console.log('🏛️ Building is on gul liste!', result);
          setShowYellowBox(true);
        } else {
          console.log('🏛️ Building is NOT on gul liste');
          setShowYellowBox(false);
        }
      } catch (error) {
        console.error('🏛️ Error checking gul liste:', error);
        setShowYellowBox(false); // Default to false on error
      } finally {
        setGulListeLoading(false);
      }
    };
    
    checkGulListe();
  }, [buildingData]);

  // Handle enebolig animation if building is enebolig
  React.useEffect(() => {
    if (isEnebolig) {
      // Perform house animation after 2 seconds
      const animTimer = setTimeout(() => {
        performHouseAnimation();
      }, 2000);

      // Fade out Enebolig1 right after animation starts
      const fadeEnebolig1Timer = setTimeout(() => {
        setEnebolig1Opacity(0);
      }, 2001); // 1ms after animation starts

      return () => {
        clearTimeout(animTimer);
        clearTimeout(fadeEnebolig1Timer);
      };
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
  const animationStyles = getAnimationStyles(fadeOpacity, showHeader);
  const layoutStyles = getLayoutStyles();
  const titleStyles = getTitleStyles();
  const buttonTextStyles = getButtonTextStyles();

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
      
      {/* Oslo skyline SVG - positioned outside scaled container */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: '100vh', // Full viewport height to ensure nothing is cut off
        zIndex: 1,
        pointerEvents: 'none',
        overflow: (isExpanded && selectedSolution === 'Tetting') ? 'hidden' : 'visible',
        transform: showProcess ? 'translateY(-100vh)' : 'translateY(0)',
        transition: 'transform 0.8s ease-in-out'
      }}>
        <OsloSkyline 
          fadeOpacity={fadeOpacity}
          blockTransform={blockTransform}
          showHeader={showHeader}
          isExpanded={isExpanded}
          selectedSolution={selectedSolution}
          hideBlockAnimation={isEnebolig}
        />
        
        {/* Enebolig1 - only show if building is enebolig */}
        {isEnebolig && (
          <svg 
            ref={enebolig1Ref}
            className="oslo-skyline"
            viewBox="0 -20 1728 372" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMax slice"
            style={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: 'auto',
              maxHeight: 'none',
              pointerEvents: 'none',
              opacity: enebolig1Opacity,
              transition: 'opacity 0.001s linear'
            }}
          >
            <path d="M320.018 271.883L350.789 302.697V352H320.018H289.247V302.697L320.018 271.883Z" fill="#D0BFAE"/>
            <path d="M350.783 302.697H381.554V352H350.783V302.697Z" fill="#F8F0DD"/>
            <path d="M350.783 302.697H381.554L350.783 271.883H320.013L350.783 302.697Z" fill="#2A2859"/>
            <path d="M313.861 339.674H326.17V351.999H313.861V339.674Z" fill="#2A2859"/>
          </svg>
        )}
      </div>
      
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
      />
      
      {/* Enebolig2 - positioned with WhiteInfoBox at bottom 55px */}
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
            transition: 'opacity 0.5s ease-in-out',
            zIndex: 2
          }}
        >
          <svg 
            width="93" 
            height="81" 
            viewBox="0 0 93 81" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M61.783 31.6973H92.5537V81.0001H61.783V31.6973Z" fill="#F8F0DD"/>
            <path d="M31.0182 0.884766L61.7891 31.699V81.0019H31.0182H0.247322V31.699L31.0182 0.884766Z" fill="#D0BFAE"/>
            <path d="M61.783 31.6991H92.5537L61.783 0.884766H31.0122L61.783 31.6991Z" fill="#2A2859"/>
            <path d="M24.8615 68.6738H37.1699V80.9995H24.8615V68.6738Z" fill="#2A2859"/>
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
        onUpdateBuildingData={handleUpdateBuildingData}
        isYellowBoxExpanded={isYellowBoxExpanded}
        onYellowBoxExpandedChange={setIsYellowBoxExpanded}
        onCloseYellowBox={() => {
          setIsYellowBoxExpanded(false);
        }}
      />
    </div>
    
    {/* Prosessen videre component */}
    <ProsessenVidere 
      showProcess={showProcess}
      scaleFactor={scaleFactor}
      onBack={() => setShowProcess(false)}
    />
    </>
  );
};
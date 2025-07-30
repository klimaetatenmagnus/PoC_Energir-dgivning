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
import { fetchSolarData, SolarEnergyData } from '../services/solarEnergyService';

interface FigmaBlokkProps {
  searchAddress: string;
  buildingData: AddressLookupResponse;
  onBack: () => void;
}

export const FigmaBlokk: React.FC<FigmaBlokkProps> = ({ searchAddress, buildingData, onBack }) => {
  // Use custom hooks for animations and coordinates
  const { fadeOpacity, blockTransform, showHeader } = useAnimation();
  const mapCoordinates = useAddressCoordinates(searchAddress);
  
  // State for expanded mode
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [selectedSolution, setSelectedSolution] = React.useState<string | null>(null);
  const [solarData, setSolarData] = React.useState<SolarEnergyData | null>(null);
  const [showYellowBox, setShowYellowBox] = React.useState(true);
  
  // Fetch solar data when component mounts
  React.useEffect(() => {
    const loadSolarData = async () => {
      if (!buildingData) return;
      
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
  const buildingTypeName = buildingData.csvData?.bygningstypenavn || buildingData.bygningstypeNavn || 'Blokk';
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
        overflow: (isExpanded && selectedSolution === 'Tetting') ? 'hidden' : 'visible'
      }}>
        <OsloSkyline 
          fadeOpacity={fadeOpacity}
          blockTransform={blockTransform}
          showHeader={showHeader}
          isExpanded={isExpanded}
          selectedSolution={selectedSolution}
        />
      </div>
      
      <div className="figma-design-container" style={{ 
        ...layoutStyles.container, 
        overflow: 'visible',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${scaleFactor})`,
        transformOrigin: 'center',
        width: '1728px',
        height: '900px',
        zIndex: 2,
        background: 'transparent'
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
            zIndex: 1000
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
              Energiportalen
            </span>
          </div>
          
          <button
            className="back-button"
            onClick={onBack}
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
              gap: '0'
            }}
          >
            <span style={{ marginRight: 'auto' }}>Klimaoslo</span>
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
      
      {/* Energy solution buttons */}
      <EnergySolutionButtons 
        showHeader={showHeader} 
        isExpanded={isExpanded}
        onExpand={setIsExpanded}
        onSelectSolution={setSelectedSolution}
        buildingData={{...buildingData, filteredSolarEnergy: solarData?.filteredSolarEnergy}}
        showYellowBox={showYellowBox}
        onToggleYellowBox={setShowYellowBox}
      />
      
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
        buildingData={buildingData}
        onExpand={setIsExpanded}
        showYellowBox={showYellowBox}
      />
    </div>
    </>
  );
};
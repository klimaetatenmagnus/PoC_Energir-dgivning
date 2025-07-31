import React from 'react';
import { getTileUrl } from '../utils/calculations';
import { LocationPin } from './LocationPin';
import * as EnergySolutions from './Tiltak';

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
  onUpdateBuildingData
}) => {
  // Calculate expanded width to reach where the energy solutions list ends
  const expandedWidth = isExpanded ? 840 : 336; // Expanded to 840px
  
  // State for delayed height expansion
  const [expandHeight, setExpandHeight] = React.useState(false);
  
  // State for edit mode
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [savedByggeaar, setSavedByggeaar] = React.useState(
    String(buildingData?.csvData?.byggeaar || buildingData?.byggeaar || '')
  );
  const [savedAreal, setSavedAreal] = React.useState(
    String(buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt || '')
  );
  const [savedArealLeilighet, setSavedArealLeilighet] = React.useState(
    String(buildingData?.arealLeilighet || '')
  );
  const [savedEnergiforbruk, setSavedEnergiforbruk] = React.useState(
    String(buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh || '300000')
  );
  const [editedByggeaar, setEditedByggeaar] = React.useState(savedByggeaar);
  const [editedAreal, setEditedAreal] = React.useState(savedAreal);
  const [editedArealLeilighet, setEditedArealLeilighet] = React.useState(savedArealLeilighet);
  const [editedEnergiforbruk, setEditedEnergiforbruk] = React.useState(savedEnergiforbruk);
  
  // Calculate input width based on content
  const calculateInputWidth = (value: string) => {
    const minWidth = 60; // Increased min width for better appearance
    const charWidth = 10; // Increased for 18px font to prevent scrolling
    const padding = 20; // Extra padding for cursor and breathing room
    return Math.max(minWidth, value.length * charWidth + padding);
  };
  
  // Call the callback with initial values when component mounts
  React.useEffect(() => {
    if (onUpdateBuildingData) {
      onUpdateBuildingData(savedByggeaar, savedAreal, savedArealLeilighet, savedEnergiforbruk);
    }
  }, []); // Empty dependency array means this runs once on mount
  
  // Handle sequential animation - expand height after width
  React.useEffect(() => {
    if (isExpanded) {
      // Delay height expansion to happen after width animation (0.8s)
      const timer = setTimeout(() => {
        setExpandHeight(true);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      // Reset height immediately when closing
      setExpandHeight(false);
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
      'Varmepumpe': EnergySolutions.Varmepumpe,
      'Solenergi': EnergySolutions.Solenergi,
      'Tetting': EnergySolutions.Tetting,
      'Temperaturstyring': EnergySolutions.Temperaturstyring,
      'Utskiftning av vindu': EnergySolutions.UtskiftningAvVindu,
      'Isolering av kjeller og loft': EnergySolutions.IsoleringAvKjellerOgLoft,
      'Etterisolering av yttervegg': EnergySolutions.EtterisoleringAvYttervegg,
      'Ventilasjon': EnergySolutions.Ventilasjon
    };
    
    const Component = componentMap[selectedSolution];
    if (!Component) return null;
    
    // Pass onBack prop to Tetting
    if (selectedSolution === 'Tetting') {
      return <Component onBack={() => onExpand && onExpand(false)} />;
    }
    
    return <Component />;
  };
  
  return (
    <div
      style={{
        position: 'absolute',
        left: 'calc(50% - 235.5px - 74px - 336px)',
        bottom: `${expandedBottom}px`,
        width: expandedWidth,
        height: expandedHeight,
        opacity: showHeader ? 1 : 0,
        transition: `opacity 1s ease-in-out 0.5s, width 0.8s ease-in-out ${isExpanded ? '0s' : '0.4s'}, height 0.6s ease-in-out ${expandHeight ? '0s' : '0.2s'}`,
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
          height: '100%'
        }}
      >
        <svg
          width={expandedWidth}
          height={expandedHeight}
          viewBox={`0 ${expandHeight ? -topExpansion : 0} ${expandedWidth} ${expandedHeight}`}
          preserveAspectRatio="xMinYMin meet"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0
          }}
        >
      <rect width={expandedWidth} height={expandedHeight} y={expandHeight ? -topExpansion : 0} fill="white"/>
      <g clipPath="url(#clip0_325_12689)">
        <g style={{ opacity: isExpanded ? 0 : 1, transition: isExpanded ? 'opacity 0.3s ease-in-out' : 'opacity 0.5s ease-in-out 0.5s' }}>
        <text 
          x="30" 
          y="72" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="500"
          fontStyle="normal"
          fontSize={fontSize} 
          lineHeight={fontSize * 1.5}
          letterSpacing="-0.2"
          fill="#2A2859"
          textAnchor="start"
        >
          <tspan x="30" textLength={336 - 60} lengthAdjust="spacingAndGlyphs">
            {addressOnly}
          </tspan>
        </text>
        <rect width={districtNameWidth} height="30" transform="translate(30 94)" fill="#C7F6C9"/>
        <path d="M44.7913 104.75C44.7913 105.302 45.2393 105.75 45.7913 105.75C46.3433 105.75 46.7913 105.302 46.7913 104.75C46.7913 104.198 46.3433 103.75 45.7913 103.75C45.2393 103.75 44.7913 104.198 44.7913 104.75Z" fill="#2A2859"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M42.32 104.804C42.32 102.886 43.874 101.332 45.7915 101.332C47.7086 101.332 49.263 102.887 49.263 104.804C49.263 105.421 49.1009 106.016 48.7931 106.547L53.7838 110.112L51.0298 113.416L47.8308 113.873L45.3703 116.825L38.1543 111.671L40.9083 108.366L43.7566 107.959L42.8624 106.668C42.51 106.116 42.32 105.473 42.32 104.804ZM46.997 109.218L48.239 107.38L52.3253 110.299L50.9016 112.007L46.997 109.218ZM45.8276 110.948L46.4369 110.047L49.9548 112.559L47.4959 112.911L42.2737 109.181L44.3935 108.878L45.8276 110.948ZM48.263 104.804C48.263 103.439 47.1563 102.332 45.7915 102.332C44.4263 102.332 43.32 103.439 43.32 104.804C43.32 105.281 43.4549 105.737 43.6949 106.114L45.8173 109.177L47.8769 106.13C48.1027 105.776 48.2348 105.371 48.2589 104.946L48.263 104.804ZM46.7501 113.607L41.1662 109.618L39.6123 111.483L45.1958 115.471L46.7501 113.607Z" fill="#2A2859"/>
        <text 
          x="66" 
          y="114" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="400"
          fontStyle="normal"
          fontSize="14" 
          lineHeight="22"
          letterSpacing="-0.2"
          fill="#2A2859"
        >
          {districtName}
        </text>
        
        <rect width={buildingTypeWidth} height="30" transform={`translate(${30 + districtNameWidth + 8} 94)`} fill="#D1F9FF"/>
        {/* Building type icon */}
        <g transform={`translate(${30 + districtNameWidth + 8 + 14} 101)`}>
          <path fillRule="evenodd" clipRule="evenodd" d="M13.5 14.43V0.429993H5.5V2.92999H1V14.43H0V15.43H15V14.43H13.5ZM5.5 14.43H4V11.43H5.5V14.43ZM7.5 14.43H6.5V10.43H3V14.43H2V3.92999H7.5V14.43ZM12.5 14.43H8.5V13.43H11.5V12.43H8.5V11.43H11.5V10.43H8.5V9.42999H11.5V8.42999H8.5V7.42999H11.5V6.42999H8.5V5.42999H11.5V4.42999H8.5V3.42999H11.5V2.42999H7.5V2.92999H6.5V1.42999H12.5V14.43Z" fill="#2A2859"/>
          <path d="M3 7.86499H4V8.93499H3V7.86499ZM5.5 7.86499H6.5V8.93499H5.5V7.86499ZM3 5.35999H4V6.42999H3V5.35999ZM5.5 5.35999H6.5V6.42999H5.5V5.35999Z" fill="#2A2859"/>
        </g>
        <text 
          x={30 + districtNameWidth + 8 + 36} 
          y="114" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="400"
          fontStyle="normal"
          fontSize="14" 
          lineHeight="22"
          letterSpacing="-0.2"
          fill="#2A2859"
        >
          {buildingTypeName}
        </text>
        
        {/* Nøkkelinformasjon text */}
        <text 
          x="30" 
          y="160" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="500"
          fontStyle="normal"
          fontSize="20" 
          lineHeight="32"
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
            lineHeight="32"
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
            lineHeight="32"
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
              lineHeight="28"
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
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Areal: </tspan>
              <tspan fontWeight="500">{savedAreal || 'Ukjent'} m²</tspan>
            </text>
            <text 
              x="30" 
              y="260" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Eiertype: </tspan>
              <tspan fontWeight="500">Borettslag</tspan>
            </text>
            <text 
              x="30" 
              y="288" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Areal Leilighet: </tspan>
              <tspan fontWeight="500">{savedArealLeilighet || 'Ukjent'} m²</tspan>
            </text>
            <text 
              x="30" 
              y="316" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Energiforbruk: </tspan>
              <tspan fontWeight="500">{(savedEnergiforbruk || '300000').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kWh/år</tspan>
            </text>
          </>
        ) : (
          <>
            {/* Edit mode - show input fields */}
            <text 
              x="30" 
              y="204" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
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
              lineHeight="28"
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
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
              fontWeight="500"
            >
              m²
            </text>
            
            <text 
              x="30" 
              y="260" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Eiertype: </tspan>
              <tspan fontWeight="500">Borettslag</tspan>
            </text>
            
            <text 
              x="30" 
              y="288" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Areal Leilighet: </tspan>
            </text>
            <foreignObject x="153" y="270" width={calculateInputWidth(editedArealLeilighet)} height="24">
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
              y="288" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
              fontWeight="500"
            >
              m²
            </text>
            
            <text 
              x="30" 
              y="316" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
            >
              <tspan fontWeight="300">Energiforbruk: </tspan>
            </text>
            <foreignObject x="155" y="298" width={calculateInputWidth(editedEnergiforbruk)} height="24">
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
              y="316" 
              fontFamily="Oslo Sans, sans-serif" 
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
              fontWeight="500"
            >
              kWh/år
            </text>
          </>
        )}
        {showYellowBox && (
          <text 
            x="30" 
            y="344" 
            fontFamily="Oslo Sans, sans-serif" 
            fontSize="18" 
            lineHeight="28"
            letterSpacing="-0.2"
            fill="#2A2859"
          >
            <tspan fontWeight="300">Vernestatus: </tspan>
            <tspan fontWeight="500">Gul Liste</tspan>
          </text>
        )}
        
        {/* Yellow box above dark box - conditional rendering */}
        {showYellowBox && (
          <>
            <rect 
              x="30" 
              y="372" 
              width="235" 
              height="46" 
              fill="#FFE7BC"
            />
            
            {/* Text inside yellow box */}
            <text 
              x="46" 
              y="395" 
              fontFamily="Oslo Sans, sans-serif" 
              fontWeight="500"
              fontStyle="normal"
              fontSize="18" 
              lineHeight="28"
              letterSpacing="-0.2"
              fill="#2A2859"
              dominantBaseline="middle"
            >
              Hva betyr gul liste?
            </text>
            
            {/* Arrow icon inside yellow box */}
            <svg x="225" y="381" width="24" height="28" viewBox="0 0 24 28" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M14.56 14L7.5 21.2534L8.47002 22.25L16.5 14L8.47002 5.75L7.5 6.7466L14.56 14Z" fill="#2A2859"/>
            </svg>
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
      </g>
      
      {/* Tiltak content that appears when expanded */}
      {selectedSolution !== 'Tetting' && (
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
          <rect width="336" height="700" fill="white"/>
        </clipPath>
      </defs>
    </svg>
      </div>
      
      {/* Render Tetting outside SVG */}
      {selectedSolution === 'Tetting' && (
        <div style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: isExpanded && selectedSolution ? 1 : 0, 
          transition: isExpanded ? 'opacity 0.5s ease-in-out 1s' : 'opacity 0.2s ease-out',
          pointerEvents: isExpanded ? 'auto' : 'none'
        }}>
          {getSolutionComponent()}
        </div>
      )}
    </div>
  );
};
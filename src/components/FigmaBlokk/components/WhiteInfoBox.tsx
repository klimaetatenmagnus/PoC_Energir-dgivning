import React from 'react';
import { getTileUrl } from '../utils/calculations';
import { LocationPin } from './LocationPin';
import * as EnergySolutions from './EnergySolutions';

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
  onExpand
}) => {
  // Calculate expanded width to reach where the energy solutions list ends
  const expandedWidth = isExpanded ? 840 : 336; // Expanded to 840px
  
  // State for delayed height expansion
  const [expandHeight, setExpandHeight] = React.useState(false);
  
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
      'Tetting': EnergySolutions.TettingWithDropdowns,
      'Temperaturstyring': EnergySolutions.Temperaturstyring,
      'Utskiftning av vindu': EnergySolutions.UtskiftningAvVindu,
      'Isolering av kjeller og loft': EnergySolutions.IsoleringAvKjellerOgLoft,
      'Etterisolering av yttervegg': EnergySolutions.EtterisoleringAvYttervegg,
      'Ventilasjon': EnergySolutions.Ventilasjon
    };
    
    const Component = componentMap[selectedSolution];
    if (!Component) return null;
    
    // Pass onBack prop to TettingWithDropdowns
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
        
        {/* Building info under Nøkkelinformasjon */}
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
          <tspan fontWeight="500">{buildingData.csvData?.byggeaar || buildingData.byggeaar || 'Ukjent'}</tspan>
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
          <tspan fontWeight="500">{buildingData.bruksarealM2 || buildingData.csvData?.bruksareal_totalt || 'Ukjent'} m²</tspan>
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
          <tspan fontWeight="300">Vernestatus: </tspan>
          <tspan fontWeight="500">Gul Liste</tspan>
        </text>
        
        {/* Yellow box above dark box */}
        <rect 
          x="30" 
          y="336" 
          width="235" 
          height="46" 
          fill="#FFE7BC"
        />
        
        {/* Text inside yellow box */}
        <text 
          x="46" 
          y="359" 
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
        <svg x="225" y="345" width="24" height="28" viewBox="0 0 24 28" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M14.56 14L7.5 21.2534L8.47002 22.25L16.5 14L8.47002 5.75L7.5 6.7466L14.56 14Z" fill="#2A2859"/>
        </svg>
        
        {/* Dark box above map */}
        <rect 
          x="30" 
          y="400" 
          width="216" 
          height="46" 
          fill="#2A2859"
        />
        
        {/* Text inside dark box */}
        <text 
          x="46" 
          y="423" 
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="500"
          fontStyle="normal"
          fontSize="18" 
          lineHeight="28"
          letterSpacing="-0.2"
          fill="white"
          dominantBaseline="middle"
        >
          Prosessen videre
        </text>
        
        {/* Arrow icon inside dark box */}
        <svg x="206" y="409" width="24" height="28" viewBox="0 0 24 28" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M14.56 14L7.5 21.2534L8.47002 22.25L16.5 14L8.47002 5.75L7.5 6.7466L14.56 14Z" fill="white"/>
        </svg>
        
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
      
      {/* Energy solution content that appears when expanded */}
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
      
      {/* Render TettingWithDropdowns outside SVG */}
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
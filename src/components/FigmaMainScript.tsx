
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

interface FigmaBlokkProps {
  searchAddress: string;
  buildingData: AddressLookupResponse;
  onBack: () => void;
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
  const [enebolig1Opacity, setEnebolig1Opacity] = React.useState(1);
  const enebolig1Ref = React.useRef<HTMLDivElement>(null);
  const enebolig2ContainerRef = React.useRef<HTMLDivElement>(null);
  
  // State for blokk animation
  const [animateBlokk, setAnimateBlokk] = React.useState(false);
  const [blokk1Opacity, setBlokk1Opacity] = React.useState(1);
  const blokk1Ref = React.useRef<HTMLDivElement>(null);
  const blokk2ContainerRef = React.useRef<HTMLDivElement>(null);
  
  // State for process slide animation
  const [showProcess, setShowProcess] = React.useState(false);
  
  // State for total energy savings
  const [totalEnergySavings, setTotalEnergySavings] = React.useState<number>(0);
  
  // Enebolig animation function - disabled
  // Animation has been removed - Enebolig2 is shown immediately without animation

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
  
  // Calculate district name width for green box
  const districtName = buildingData.csvData?.bydelsnavn || 'Bydel';

  // Get building type name
  const defaultBuildingType = isEnebolig ? 'Enebolig' : 'Blokk';
  const buildingTypeName = buildingData.csvData?.bygningstypeNavn || buildingData.bygningstypeNavn || defaultBuildingType;

  // Get styles
  const layoutStyles = getLayoutStyles();

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
        showYellowBox={showYellowBox}
        onToggleYellowBox={setShowYellowBox}
        yearlyConsumption={energiforbruk}
        onProcessClick={() => setShowProcess(true)}
        onTotalSavingsChange={setTotalEnergySavings}
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
          <svg width="93" height="81" viewBox="0 0 93 81" fill="none">
            <path d="M31.0182 0.884766L61.7891 31.699V81.0019H31.0182H0.247322V31.699L31.0182 0.884766Z" fill="#D0BFAE"/>
            <path d="M61.783 31.699H92.554V81.0019H61.783V31.699Z" fill="#F8F0DD"/>
            <path d="M61.783 31.699H92.554L61.783 0.884766H31.0122L61.783 31.699Z" fill="#2A2859"/>
            <path d="M24.8618 68.6738H37.1702V80.9995H24.8618V68.6738Z" fill="#2A2859"/>
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
            <path d="M86.73 0L99.03 12.326H111.34V24.652H123.65V36.977H135.96V49.303H123.65H86.73V36.977H49.8V0H86.73Z" fill="#2A2859"/>
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
            <path d="M19.02 110.93H31.33V123.256H19.02V110.93Z" fill="#2A2859"/>
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
          <svg width="136" height="204" viewBox="0 0 136 204" fill="none">
            <path d="M86.73 0L99.03 12.326H111.34V24.652H123.65V36.977H135.96V49.303H123.65H86.73V36.977H49.8V0H86.73Z" fill="#2A2859"/>
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
            <path d="M19.02 110.93H31.33V123.256H19.02V110.93Z" fill="#2A2859"/>
          </svg>
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

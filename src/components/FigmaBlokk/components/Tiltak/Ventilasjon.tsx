import React, { useState, useEffect } from 'react';

interface VentilasjonProps {
  onBack?: () => void;
  buildingType?: string;
  buildingData?: any;
}

export const Ventilasjon: React.FC<VentilasjonProps> = ({ onBack, buildingType, buildingData }) => {
  const [isPermitOpen, setIsPermitOpen] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [stotteordninger, setStotteordninger] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hent støtteordninger fra Excel via API
  useEffect(() => {
    const fetchStotteordninger = async () => {
      try {
        const bygningstyperMap: { [key: string]: string } = {
          'enebolig': 'enebolig',
          'rekkehus': 'rekkehus',
          'tomannsbolig': 'rekkehus',
          'leilighet': 'blokk',
          'blokk': 'blokk',
          'store boligbygg': 'blokk'
        };

        const mappedType = bygningstyperMap[buildingType?.toLowerCase() || 'enebolig'] || 'enebolig';
        
        // Kall API endpoint som leser direkte fra Excel
        const url = `http://localhost:3001/api/stotteordninger-live?gulliste=false&tiltak=ventilasjon&bygningstype=${mappedType}`;
        console.log('Fetching støtteordninger from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API response error:', response.status, errorText);
          throw new Error(`Failed to fetch støtteordninger: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setStotteordninger(data);
      } catch (error) {
        console.error('Error fetching støtteordninger:', error);
        // Vis feilmelding i stedet for fallback
        const errorData = [{
          ordning: 'Kunne ikke hente støtteordninger',
          lenke: null,
          belop: 'Sjekk at API-serveren kjører',
          overskrift: 'Feil'
        }];
        setStotteordninger(errorData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStotteordninger();
  }, [buildingType]);


  // Støtteordninger hentes nå via useEffect
  const needsScroll = stotteordninger.length > 4;

  // Farger for overskrifter
  const overskriftFarger: { [key: string]: string } = {
    'Enova': '#C7F6C9',
    'Klima- og energifondet': '#D1F9FF',
    'Oslo kommune': '#D1F9FF',
    'Klimaetaten': '#D1F9FF',
    'Byantikvaren': '#FFE4B5',
    'Riksantikvaren': '#FFB4AC',
    'Kulturminnefondet': '#DDA0DD'
  };

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%'
    }}>
      {/* SVG Background and decorative elements */}
      <svg
        width="840"
        height="1400"
        viewBox="0 -90 840 1400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0,
          transition: `transform 0.6s ease-in-out ${isPermitOpen ? '0.1s' : '0s'}`,
          transform: isPermitOpen ? 'translateY(-465px)' : 'translateY(0)'
        }}
      >
        <text
          x="60"
          y="-30"
          fontFamily="Oslo Sans, sans-serif"
          fontWeight="700"
          fontStyle="normal"
          fontSize="24"
          lineHeight="36"
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="hanging"
        >
          Ventilasjon
        </text>
        
        {/* Main text content with scroll if needed */}
        <foreignObject x="60" y="20" width="465" height="338">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            fontFamily: 'Oslo Sans',
            fontWeight: 300,
            fontStyle: 'normal',
            fontSize: '14px',
            lineHeight: '22px',
            letterSpacing: '0px',
            color: '#000000',
            textAlign: 'left',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '10px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#CCCCCC #F5F5F5'
          }}>
            <style>{`
              div::-webkit-scrollbar {
                width: 6px;
              }
              div::-webkit-scrollbar-track {
                background: #F5F5F5;
              }
              div::-webkit-scrollbar-thumb {
                background: #CCCCCC;
                border-radius: 3px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: #AAAAAA;
              }
            `}</style>
            <p style={{ marginBottom: '16px' }}>
              Etterisolering av fasaden er svært effektivt for å spare strømutgifter, skape bedre inneklima med mindre trekk, og få mer kontroll over temperaturen inne.
            </p>
            <p style={{ marginBottom: '16px' }}>
              Hvis du uansett må skifte kledning, altså fasadematerialet, lønner det seg å etterisolere samtidig.
            </p>

            {buildingType && buildingType.toLowerCase() === 'enebolig' ? (
              <p style={{ marginBottom: '20px' }}>
                Har huset ditt en enkel fasade uten mye detaljer, er det som regel uproblematisk å etterisolere utvendig og kle med nytt materiale i ønsket stil. Skal du bevare dagens uttrykk, kan innvendig isolasjon eller forbedret tetting være alternativer.
              </p>
            ) : buildingType && (buildingType.toLowerCase() === 'rekkehus' || buildingType.toLowerCase() === 'tomannsbolig') ? (
              <p style={{ marginBottom: '20px' }}>
                I tomannsboliger og rekkehus kan det være lurt å samkjøre etterisoleringen med naboen – spesielt ved speilvendte eller sammenhengende fasader. Det gir et helhetlig resultat og gjør det enklere å gjennomføre.
              </p>
            ) : (
              <p style={{ marginBottom: '20px' }}>
                Blokker med store, flate fasader har godt potensial for etterisolering. Ved å etterisolere hele veggflater eller bare utvalgte partier kan dere redusere energiforbruket og oppgradere byggets uttrykk.
              </p>
            )}
          </div>
        </foreignObject>
        
        {/* Blue rectangles */}
        <rect
          x="565"
          y="60"
          width="132"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Cloud icon in first box */}
        <svg x="573" y="67" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12.5087 12.8731H3.49116C3.43379 12.8731 3.37666 12.8711 3.31977 12.8677C2.67867 12.8281 2.06713 12.5841 1.57483 12.1716C1.08253 11.759 0.735383 11.1995 0.584305 10.5752C0.433227 9.95091 0.486166 9.29463 0.735359 8.70261C0.984552 8.1106 1.41688 7.61401 1.96895 7.28567C2.01896 6.37224 2.35248 5.49711 2.92308 4.78207C3.49368 4.06703 4.27298 3.54764 5.15255 3.29618C6.03211 3.04472 6.96819 3.0737 7.83052 3.37908C8.69285 3.68447 9.43853 4.25106 9.96381 5.00003C10.7128 4.81678 11.5036 4.92815 12.1728 5.31115C12.842 5.69415 13.3386 6.31953 13.56 7.05813C14.2039 7.30219 14.7445 7.76 15.0912 8.35496C15.438 8.94991 15.5698 9.64591 15.4648 10.3265C15.3597 11.007 15.0241 11.6308 14.514 12.0935C14.004 12.5562 13.3506 12.8297 12.663 12.8682C12.6132 12.8711 12.561 12.8731 12.5087 12.8731ZM6.36176 4.12674C5.46049 4.12773 4.59641 4.4862 3.95911 5.1235C3.32182 5.7608 2.96334 6.62488 2.96235 7.52615L2.97041 7.90774L2.67133 8.04471C2.26473 8.23061 1.93192 8.54708 1.72579 8.94381C1.51965 9.34054 1.45202 9.79479 1.53364 10.2344C1.61526 10.6739 1.84145 11.0736 2.17626 11.3699C2.51107 11.6662 2.9353 11.8421 3.38154 11.8697C3.41865 11.8721 3.45478 11.8731 3.49116 11.8731H12.5087C12.5415 11.8731 12.5742 11.8721 12.6069 11.8701C13.083 11.8435 13.5341 11.648 13.8791 11.3188C14.2242 10.9895 14.4405 10.5481 14.4894 10.0737C14.5383 9.59928 14.4164 9.123 14.1458 8.73033C13.8751 8.33766 13.4734 8.05432 13.0126 7.93118L12.7084 7.85037L12.6498 7.54129C12.5941 7.25099 12.4749 6.97661 12.3007 6.73778C12.1265 6.49894 11.9017 6.30155 11.6423 6.15974C11.383 6.01793 11.0955 5.93519 10.8004 5.91746C10.5053 5.89973 10.21 5.94743 9.93549 6.05716L9.5312 6.21951L9.31489 5.84158C9.01682 5.32139 8.58689 4.88897 8.06843 4.5879C7.54997 4.28684 6.9613 4.12777 6.36176 4.12674Z" fill="#2A2859"/>
        </svg>
        <text 
          x="597"
          y="75"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          lineHeight="22"
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          Mindre trekk
        </text>
        <rect
          x="565"
          y="106"
          width="155"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* House with heart icon in second box */}
        <svg x="573" y="113" width="17" height="16" viewBox="0 0 17 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M5.42501 7.092C6.21251 6.3035 7.49451 6.304 8.28301 7.092L8.33251 7.1425L8.38251 7.0925C9.17051 6.3045 10.453 6.3045 11.241 7.0925C12.0285 7.88 12.0285 9.1625 11.241 9.9505L8.33301 12.8585L5.42501 9.95C4.63701 9.162 4.63701 7.88 5.42501 7.092ZM10.5345 7.799C10.136 7.401 9.48851 7.401 9.09001 7.799L8.33301 8.556L7.57601 7.7995C7.37701 7.6005 7.11551 7.501 6.85401 7.501C6.59251 7.501 6.33101 7.6005 6.13201 7.7995C5.73401 8.1975 5.73401 8.845 6.13201 9.2435L8.33301 11.4445L10.5345 9.243C10.9325 8.845 10.9325 8.197 10.5345 7.799Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M5.65601 2.7305L8.33301 0.5L14.333 5.5V16H2.33301V1H5.22351L5.65601 2.7305ZM4.44251 2H3.33301V4.6665L4.80301 3.4415L4.44251 2ZM3.33301 5.9685V15H13.333V5.9685L8.33301 1.802L3.33301 5.9685Z" fill="#2A2859"/>
        </svg>
        <text 
          x="598"
          y="121"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          lineHeight="22"
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          Bedre bokvalitet
        </text>
        <rect
          x="565"
          y="152"
          width="183"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Coins/money icon in third box */}
        <svg x="573" y="159" width="17" height="16" viewBox="0 0 17 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M9.16699 2.25C9.16699 0.9885 10.814 0 12.917 0C15.02 0 16.667 0.9885 16.667 2.25V11C16.667 12.2615 15.02 13.25 12.917 13.25C10.814 13.25 9.16699 12.2615 9.16699 11V2.25ZM12.917 12.25C14.4905 12.25 15.667 11.59 15.667 11V10.791C14.987 11.2285 14.016 11.5 12.917 11.5C11.818 11.5 10.847 11.2285 10.167 10.791V11C10.167 11.59 11.3435 12.25 12.917 12.25ZM12.917 10.5C14.4905 10.5 15.667 9.84 15.667 9.25V9.041C14.987 9.4785 14.016 9.75 12.917 9.75C11.818 9.75 10.847 9.4785 10.167 9.041V9.25C10.167 9.84 11.3435 10.5 12.917 10.5ZM12.917 8.75C14.4905 8.75 15.667 8.09 15.667 7.5V7.291C14.987 7.7285 14.016 8 12.917 8C11.818 8 10.847 7.7285 10.167 7.291V7.5C10.167 8.09 11.3435 8.75 12.917 8.75ZM12.917 7C14.4905 7 15.667 6.34 15.667 5.75V5.541C14.987 5.9785 14.016 6.25 12.917 6.25C11.818 6.25 10.847 5.9785 10.167 5.541V5.75C10.167 6.34 11.3435 7 12.917 7ZM12.917 5.25C14.4905 5.25 15.667 4.59 15.667 4V3.791C14.987 4.2285 14.016 4.5 12.917 4.5C11.818 4.5 10.847 4.2285 10.167 3.791V4C10.167 4.59 11.3435 5.25 12.917 5.25ZM10.167 2.25C10.167 2.84 11.3435 3.5 12.917 3.5C14.4905 3.5 15.667 2.84 15.667 2.25C15.667 1.66 14.4905 1 12.917 1C11.3435 1 10.167 1.66 10.167 2.25Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M0.666992 8.5C0.666992 7.2385 2.31399 6.25 4.41699 6.25C6.51999 6.25 8.16699 7.2385 8.16699 8.5V13.75C8.16699 15.0115 6.51999 16 4.41699 16C2.31399 16 0.666992 15.0115 0.666992 13.75V8.5ZM4.41699 15C5.99099 15 7.16699 14.34 7.16699 13.75V13.541C6.48699 13.9785 5.51549 14.25 4.41699 14.25C3.31849 14.25 2.34699 13.9785 1.66699 13.541V13.75C1.66699 14.34 2.84299 15 4.41699 15ZM4.41699 13.25C5.99099 13.25 7.16699 12.59 7.16699 12V11.791C6.48699 12.2285 5.51549 12.5 4.41699 12.5C3.31849 12.5 2.34699 12.2285 1.66699 11.791V12C1.66699 12.59 2.84299 13.25 4.41699 13.25ZM4.41699 11.5C5.99099 11.5 7.16699 10.84 7.16699 10.25V10.041C6.48699 10.4785 5.51549 10.75 4.41699 10.75C3.31849 10.75 2.34699 10.4785 1.66699 10.041V10.25C1.66699 10.84 2.84299 11.5 4.41699 11.5ZM1.66699 8.5C1.66699 9.09 2.84299 9.75 4.41699 9.75C5.99099 9.75 7.16699 9.09 7.16699 8.5C7.16699 7.91 5.99099 7.25 4.41699 7.25C2.84299 7.25 1.66699 7.91 1.66699 8.5Z" fill="#2A2859"/>
        </svg>
        <text 
          x="598"
          y="167"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          lineHeight="22"
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          Lavere strømregning
        </text>
        <rect
          x="565"
          y="198"
          width="172"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Chart/graph icon in fourth box */}
        <svg x="573" y="205" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14.9333 3.73333V0H11.2V1.06667H13.1176L8.73813 5.44533L4.13595 0.77914L1.15888 3.75621L1.91312 4.51046L4.13067 2.2928L8.73339 6.95953L13.8667 1.82625V3.73333H14.9333Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M4.944 6.4H1.12V14.9333H0V16H16V14.9333H14.8747V6.93333H11.0507V14.9333H9.90933V9.06667H6.08533V14.9333H4.944V6.4ZM12.1173 14.9333H13.808V8H12.1173V14.9333ZM8.84267 10.1333V14.9333H7.152V10.1333H8.84267ZM3.87733 14.9333V7.46667H2.18667V14.9333H3.87733Z" fill="#2A2859"/>
        </svg>
        <text 
          x="597"
          y="213"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          lineHeight="22"
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          Bedre strømstyring
        </text>
        
        {/* Dark green box below the list */}
        <rect
          x="565"
          y="260"
          width="211"
          height="124"
          fill="#034B45"
        />
        
        {/* Årlig strømbesparelse text */}
        <text
          x="589"
          y="284"
          width="149"
          height="24"
          fontFamily="Oslo Sans"
          fill="#FFFFFF"
          dominantBaseline="hanging"
        >
          Årlig strømbesparelse
        </text>
        
        {/* Etterisoleringyttervegg savings text */}
        {(() => {
          // ENERGY_SAVINGS_DATA dictionary
          const ENERGY_SAVINGS_DATA: Record<string | number, any> = {
            "eldre": {
              "blokk": {
                0.75: 38.9,
                1.2: 32.1,
                "etteriso_yttervegg": 81.7,
                "etteriso_takloft": 24.4
              },
              "småhus": {
                0.75: 42.2,
                1.2: 34.3,
                "etteriso_yttervegg": 94.1,
                "etteriso_takloft": 41.2
              }
            },
            49: {
              "blokk": {
                0.75: 38.9,
                1.2: 32.1,
                "etteriso_yttervegg": 81.7,
                "etteriso_takloft": 24.4
              },
              "småhus": {
                0.75: 42.2,
                1.2: 34.3,
                "etteriso_yttervegg": 94.1,
                "etteriso_takloft": 41.2
              }
            },
            69: {
              "blokk": {
                0.75: 38.3,
                1.2: 31.3,
                "etteriso_yttervegg": 39.7,
                "etteriso_takloft": 8.4
              },
              "småhus": {
                0.75: 41.7,
                1.2: 33.7,
                "etteriso_yttervegg": 27.7,
                "etteriso_takloft": 11.4
              }
            },
            87: {
              "blokk": {
                0.75: 28.1,
                1.2: 21.0,
                "etteriso_yttervegg": 9.7,
                "etteriso_takloft": 2.8
              },
              "småhus": {
                0.75: 31.4,
                1.2: 23.4,
                "etteriso_yttervegg": 15.0,
                "etteriso_takloft": 4.7
              }
            },
            97: {
              "blokk": {
                0.75: 12.1,
                1.2: 5.0,
                "etteriso_yttervegg": 7.3,
                "etteriso_takloft": 0.4
              },
              "småhus": {
                0.75: 14.2,
                1.2: 6.1,
                "etteriso_yttervegg": 3.7,
                "etteriso_takloft": 0.6
              }
            },
            7: {
              "blokk": {
                0.75: 7.2,
                1.2: 0,
                "etteriso_yttervegg": 1.3,
                "etteriso_takloft": 0.4
              },
              "småhus": {
                0.75: 8.2,
                1.2: 0,
                "etteriso_yttervegg": 0,
                "etteriso_takloft": 0
              }
            }
          };
          
          // TEK calculation function
          const calculateTEK = (byggeaar: number): string => {
            const terskel = 2; // lag i år i forhold til tek
            
            // TEK years with threshold applied
            if (byggeaar >= 2007 + terskel) return "TEK7";      // 2009 and newer
            if (byggeaar >= 1997 + terskel) return "TEK97";     // 1999-2008
            if (byggeaar >= 1987 + terskel) return "TEK87";     // 1989-1998
            if (byggeaar >= 1969 + terskel) return "TEK69";     // 1971-1988
            if (byggeaar >= 1949 + terskel) return "TEK49";     // 1951-1970
            
            // Older than 1951
            return "eldre";
          };
          
          // Calculate etterisoleringyttervegg savings based on building data
          const bruksareal = buildingData?.bruksarealM2 || buildingData?.csvData?.bruksareal_totalt || 0;
          const byggeaar = buildingData?.byggeaar || buildingData?.csvData?.byggeaar || 0;
          
          // Determine building category
          const buildingTypeCode = buildingData?.bygningstypeKode?.substring(0, 2) || 
                                  buildingData?.csvData?.bygningstypekode?.substring(0, 2) ||
                                  buildingData?.csvData?.bygningstypeKode?.substring(0, 2);
          
          const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode || '');
          const isBlokk = ['14', '15', '16', '17'].includes(buildingTypeCode || '');
          let buildingCategory = isSmåhus ? 'småhus' : isBlokk ? 'blokk' : null;
          
          if (!buildingCategory) {
            // Fallback to string matching if code is not available
            const typeString = buildingType?.toLowerCase() || '';
            if (typeString.includes('enebolig') || typeString.includes('tomannsbolig') || 
                typeString.includes('rekkehus') || typeString.includes('kjedehus')) {
              buildingCategory = 'småhus';
            } else if (typeString.includes('blokk') || typeString.includes('leilighet') || typeString.includes('store boligbygg')) {
              buildingCategory = 'blokk';
            }
          }
          
          let savingsPerM2 = 0;
          let totalSavings = 0;
          
          if (byggeaar && buildingCategory) {
            const tek = calculateTEK(byggeaar);
            
            // Get TEK key for the data structure
            let tekKey: string | number = tek;
            if (tek.startsWith('TEK')) {
              const tekNumber = parseInt(tek.substring(3));
              tekKey = tekNumber;
            }
            
            const savingsData = ENERGY_SAVINGS_DATA[tekKey];
            if (savingsData && savingsData[buildingCategory]) {
              savingsPerM2 = savingsData[buildingCategory]["etteriso_yttervegg"] || 0;
              totalSavings = savingsPerM2 * bruksareal;
            }
          }
          
          if (totalSavings > 0) {
            const lowerSavings = Math.round((totalSavings * 0.9) / 1000) * 1000;
            const upperSavings = Math.round((totalSavings * 1.1) / 1000) * 1000;
            const norgespris = 1.1; // kr/kWh
            const lowerKr = Math.round((lowerSavings * norgespris) / 1000) * 1000;
            const upperKr = Math.round((upperSavings * norgespris) / 1000) * 1000;
            
            return (
              <>
                <text
                  x="589"
                  y="316"
                  fontFamily="Oslo Sans"
                  fontWeight="100"
                  fontStyle="normal"
                  fontSize="14"
                  lineHeight="22"
                  letterSpacing="0"
                  fill="#FFFFFF"
                  dominantBaseline="hanging"
                >
                  {`${lowerSavings} - ${upperSavings} kWh`}
                </text>
                
                <text
                  x="589"
                  y="338"
                  fontFamily="Oslo Sans"
                  fontWeight="100"
                  fontStyle="normal"
                  fontSize="14"
                  lineHeight="22"
                  letterSpacing="0"
                  fill="#FFFFFF"
                  dominantBaseline="hanging"
                >
                  {`${lowerKr} - ${upperKr} kr`}
                </text>
              </>
            );
          } else {
            return (
              <text
                x="589"
                y="327"
                fontFamily="Oslo Sans"
                fontWeight="100"
                fontStyle="normal"
                fontSize="14"
                lineHeight="22"
                letterSpacing="0"
                fill="#FFFFFF"
                dominantBaseline="hanging"
              >
                Kunne ikke beregne besparelse
              </text>
            );
          }
        })()}
        
        {/* Circle below main text */}
        <circle
          cx="170"
          cy="490"
          r="110"
          fill="#2A2859"
        />
        
        {/* "Les mer" title in circle */}
        <text
          x="170"
          y="466"
          fontFamily="Oslo Sans"
          fontWeight="700"
          fontStyle="normal"
          fontSize="18"
          lineHeight="28"
          letterSpacing="-0.2"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          Les mer
        </text>
        
        {/* Links below "Les mer" */}
        <text
          x="170"
          y="502"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://www.dibk.no/smartere-oppussing/artikler/yttertak-og-vegger', '_blank')}
        >
          Direktoratet for byggkvalitet
        </text>
        
        <text
          x="170"
          y="528"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://www.enova.no/nb/privat/bolig/boligtyper', '_blank')}
        >
          Enova
        </text>
        
        <text
          x="170"
          y="554"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://www.sintef.no/siste-nytt/2023/etterisolering-er-mer-aktuelt-enn-noen-gang-her-er-vare-tips/', '_blank')}
        >
          Sintef
        </text>
        
        {/* Dynamic table with scrollbar */}
        {/* Top border */}
        <rect
          x="298"
          y="450"
          width="482"
          height="2"
          fill="#CCCCCC"
        />
        
        {/* Table container with scrolling via foreignObject */}
        <foreignObject x="298" y="452" width="482" height={needsScroll ? "144" : `${stotteordninger.length * 36}`}>
          <div xmlns="http://www.w3.org/1999/xhtml" style={{
            width: '100%',
            height: '100%',
            overflowY: needsScroll ? 'auto' : 'hidden',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: '#CCCCCC #F5F5F5'
          }}>
            <style>{`
              div::-webkit-scrollbar {
                width: 8px;
              }
              div::-webkit-scrollbar-track {
                background: #F5F5F5;
              }
              div::-webkit-scrollbar-thumb {
                background: #CCCCCC;
                border-radius: 4px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: #AAAAAA;
              }
            `}</style>
            <svg width="474" height={stotteordninger.length * 36} viewBox={`0 0 474 ${stotteordninger.length * 36}`}>
              {stotteordninger.map((ordning, index) => {
                const yPosition = index * 36;
                const textYPosition = yPosition + 18;
                const boxYPosition = yPosition + 6.5;
                
                return (
                  <g key={index}>
                    {/* Row background */}
                    <rect
                      x="0"
                      y={yPosition}
                      width="474"
                      height="36"
                      fill={index % 2 === 0 ? '#F9F9F9' : '#FFFFFF'}
                    />
                    
                    {/* Ordning text */}
                    <text
                      x="10"
                      y={textYPosition}
                      fontFamily="Oslo Sans"
                      fontWeight="300"
                      fontStyle="normal"
                      fontSize="12"
                      lineHeight="20"
                      letterSpacing="-0.2"
                      fill="#000000"
                      dominantBaseline="middle"
                    >
                      <tspan>{ordning.ordning.length > 45 ? ordning.ordning.substring(0, 42) + '...' : ordning.ordning}</tspan>
                    </text>
                    
                    {/* Overskrift box */}
                    <rect
                      x={ordning.overskrift === 'Enova' ? "353" : ordning.overskrift === 'Oslo kommune' ? "314" : "314"}
                      y={boxYPosition}
                      width={ordning.overskrift === 'Enova' ? "43" : ordning.overskrift === 'Oslo kommune' ? "82" : "82"}
                      height="23"
                      fill={overskriftFarger[ordning.overskrift] || '#E0E0E0'}
                    />
                    
                    {/* Overskrift text */}
                    <text
                      x={ordning.overskrift === 'Enova' ? "374.5" : ordning.overskrift === 'Oslo kommune' ? "355" : "355"}
                      y={textYPosition}
                      fontFamily="Oslo Sans"
                      fontWeight="300"
                      fontStyle="normal"
                      fontSize="10"
                      lineHeight="22"
                      letterSpacing="-0.2"
                      fill="#000000"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {ordning.overskrift === 'Klima- og energifondet' ? 'Oslo kommune' : ordning.overskrift}
                    </text>
                    
                    {/* Lenke text with click handler - moved left to avoid scrollbar */}
                    <text
                      x="425"
                      y={textYPosition}
                      fontFamily="Oslo Sans"
                      fontWeight="300"
                      fontStyle="normal"
                      fontSize="12"
                      lineHeight="18.67"
                      letterSpacing="-0.13"
                      fill="#000000"
                      textDecoration="underline"
                      dominantBaseline="middle"
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.open(ordning.lenke, '_blank')}
                    >
                      Lenke
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </foreignObject>
        
        {/* "Relevante støtteordninger" text */}
        <text
          x="308"
          y="443"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill="#000000"
        >
          Relevante støtteordninger
        </text>
        
        {/* "Søk til" text */}
        <text
          x="640"
          y="443"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill="#000000"
        >
          Søk til
        </text>
        
        {/* "Les mer" text */}
        <text
          x="710"
          y="443"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill="#000000"
        >
          Les mer
        </text>
        
        {/* Fordeler heading */}
        <text
          x="565"
          y="20"
          fontFamily="Oslo Sans"
          fontWeight="700"
          fontStyle="normal"
          fontSize="18"
          lineHeight="28"
          letterSpacing="-0.2"
          fill="#000000"
          dominantBaseline="hanging"
        >
          Fordeler
        </text>
        
        {/* Back button positioned at same y as Tetting heading */}
        <g
          style={{ 
            cursor: 'pointer'
          }}
          transform="translate(738, -50)"
          onClick={() => onBack && onBack()}
        >
          <rect x="1" y="1" width="40" height="40" fill="#2A2859"/>
          <rect x="1" y="1" width="40" height="40" stroke="#2A2859" strokeWidth="2"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M18.1 23.0539L16.5 24.7472L11 18.8207L16.5 13L18.1 14.6933L15.3 17.6566H28.4H30.6V19.9849V21.3961V25.5938V27.005V29.3333H28.4H18.8397V27.005H28.4V25.5938V21.3961V19.9849H15.2L18.1 23.0539Z" fill="white"/>
        </g>
        
        {/* HTML Dropdown elements inside SVG with foreignObject */}
        <foreignObject x="60" y="625" width="720" height="1000">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%' }}>
            {/* Permit Check Dropdown */}
            <div>
          <button
            onClick={() => setIsPermitOpen(!isPermitOpen)}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 16px',
              border: '2px solid #2A285980',
              borderRadius: '0',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'Oslo Sans',
              fontWeight: 500,
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '-0.2px',
              color: '#2A2859'
            }}
          >
            Sjekk om du må søke for å gjennomføre tiltaket
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none"
              style={{
                transform: isPermitOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.5s ease'
              }}
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M12 14.56L4.7466 7.5L3.75 8.47002L12 16.5L20.25 8.47002L19.2534 7.5L12 14.56Z" fill="#2A2859"/>
            </svg>
          </button>
          <div style={{
              width: '100%',
              maxHeight: isPermitOpen ? '1000px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.6s ease-in-out',
              border: isPermitOpen ? '2px solid #2A285980' : 'none',
              borderTop: 'none',
              background: 'white'
            }}>
            <div style={{
              padding: isPermitOpen ? '16px' : '0 16px',
              fontFamily: 'Oslo Sans',
              fontWeight: 300,
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '0px',
              color: '#000000',
              opacity: isPermitOpen ? 1 : 0,
              transition: `opacity ${isPermitOpen ? '0.4s' : '0.1s'} ease-in-out ${isPermitOpen ? '0.2s' : '0s'}, padding 0.6s ease-in-out`
            }}>
              <p style={{ margin: 0 }}>
                Etterisolering som endrer fasaden er søknadspliktig. Du må derfor kontakte en fagperson (arkitekt, byggmester eller entreprenør) som søker om tillatelse fra Plan- og bygningsetaten for deg. Etterisolering fra innsiden er som regel ikke søknadspliktig, så lenge du ikke endrer bygningens utseende eller bærende konstruksjon.

              </p>
              
              {/* Links section */}
              <div style={{ marginTop: '16px' }}>
                <a 
                  href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/skal-du-bygge-rive-eller-endre/ma-du-sende-byggesoknad/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#2A2859',
                    textDecoration: 'underline',
                    marginBottom: '12px'
                  }}
                >
                  Sjekk nærmere om tiltaket ditt er søknadspliktig
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', flexShrink: 0 }}>
                    <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#2A2859"/>
                  </svg>
                </a>
                
                <a 
                  href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/trenger-du-veiledning/#toc-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#2A2859',
                    textDecoration: 'underline',
                    marginBottom: '12px'
                  }}
                >
                  Gratis veiledningstime hos Plan- og bygningsetaten for generell informasjon om søknadsplikt
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', flexShrink: 0 }}>
                    <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#2A2859"/>
                  </svg>
                </a>
                
                <a 
                  href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/trenger-du-veiledning/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: 'Oslo Sans',
                    fontWeight: 300,
                    fontSize: '14px',
                    lineHeight: '22px',
                    letterSpacing: '0px',
                    color: '#2A2859',
                    textDecoration: 'underline'
                  }}
                >
                  Kontakt Plan- og bygningsetaten for en konkret vurdering av søknadsplikt for ditt tiltak, mot gebyr
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', flexShrink: 0 }}>
                    <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#2A2859"/>
                  </svg>
                </a>
              </div>
              
              {/* Rectangle with permit information */}
              <div style={{
                marginTop: '16px',
                padding: '16px',
                backgroundColor: '#2A2859'
              }}>
                <h3 style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 700,
                  fontSize: '16px',
                  lineHeight: '24px',
                  letterSpacing: '-0.2px',
                  color: '#FFFFFF',
                  margin: '0 0 12px 0'
                }}>
                  Søknadsplikt er ikke en stopper, men en støtte
                </h3>
                <p style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 300,
                  fontSize: '14px',
                  lineHeight: '22px',
                  letterSpacing: '0px',
                  color: '#FFFFFF',
                  margin: 0,
                  position: 'relative'
                }}>
                  Er tiltaket ditt <span 
                    style={{ 
                      textDecoration: 'underline', 
                      textDecorationStyle: 'dotted', 
                      textUnderlineOffset: '4px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onMouseEnter={() => setHoveredWord('søknadspliktig')}
                    onMouseLeave={() => setHoveredWord(null)}
                  >
                    søknadspliktig
                    {hoveredWord === 'søknadspliktig' && (
                      <div 
                        onMouseEnter={() => setHoveredWord('søknadspliktig')}
                        onMouseLeave={() => setHoveredWord(null)}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '0',
                          width: '368px',
                          backgroundColor: '#D1F9FF',
                          padding: '12px',
                          marginBottom: '0',
                          zIndex: 1000
                        }}>
                        <h4 style={{
                          fontFamily: 'Oslo Sans',
                          fontWeight: 700,
                          fontStyle: 'normal',
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
                          Søknadsplikt betyr at du må ha tillatelse fra Plan- og bygningsetaten før et tiltak – altså fysiske endringer på bygninger eller eiendom – kan settes i verk. Les mer om søknadsplikt <a 
                            href="https://www.dibk.no/regelverk/sak/2/2/innledning" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#000000', 
                              textDecoration: 'underline',
                              fontFamily: 'Oslo Sans',
                              fontWeight: 300,
                              fontSize: '14px'
                            }}
                          >her</a>.
                        </p>
                      </div>
                    )}
                  </span>, betyr ikke det at du får avslag. Tvert imot! Søknadsplikten skal sikre at arbeidet planlegges og gjennomføres med god kvalitet – både i papirene og på bygget. Målet er at du som <span 
                    style={{ 
                      textDecoration: 'underline', 
                      textDecorationStyle: 'dotted', 
                      textUnderlineOffset: '4px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onMouseEnter={() => setHoveredWord('tiltakshaver')}
                    onMouseLeave={() => setHoveredWord(null)}
                  >
                    tiltakshaver
                    {hoveredWord === 'tiltakshaver' && (
                      <div 
                        onMouseEnter={() => setHoveredWord('tiltakshaver')}
                        onMouseLeave={() => setHoveredWord(null)}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '0',
                          width: '368px',
                          backgroundColor: '#D1F9FF',
                          padding: '12px',
                          marginBottom: '0',
                          zIndex: 1000
                        }}>
                        <h4 style={{
                          fontFamily: 'Oslo Sans',
                          fontWeight: 700,
                          fontStyle: 'normal',
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
                          Tiltakshaver er den personen eller virksomheten som utfører eller får utført tiltak – altså fysiske endringer på bygninger eller eiendom – som krever søknad og tillatelse etter plan- og bygningsloven. Les mer om tiltakshavers ansvar <a 
                            href="https://www.dibk.no/regelverk/sak/3/12/12-1" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#000000', 
                              textDecoration: 'underline',
                              fontFamily: 'Oslo Sans',
                              fontWeight: 300,
                              fontSize: '14px'
                            }}
                          >her</a>.
                        </p>
                      </div>
                    )}
                  </span> får det resultatet du ønsker deg, på en trygg og effektiv måte. I mer komplekse saker stilles det krav til <span 
                    style={{ 
                      textDecoration: 'underline', 
                      textDecorationStyle: 'dotted', 
                      textUnderlineOffset: '4px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onMouseEnter={() => setHoveredWord('ansvarlige foretak')}
                    onMouseLeave={() => setHoveredWord(null)}
                  >
                    ansvarlige foretak
                    {hoveredWord === 'ansvarlige foretak' && (
                      <div 
                        onMouseEnter={() => setHoveredWord('ansvarlige foretak')}
                        onMouseLeave={() => setHoveredWord(null)}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '0',
                          width: '368px',
                          backgroundColor: '#D1F9FF',
                          padding: '12px',
                          marginBottom: '0',
                          zIndex: 1000
                        }}>
                        <h4 style={{
                          fontFamily: 'Oslo Sans',
                          fontWeight: 700,
                          fontStyle: 'normal',
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
                          Et ansvarlig foretak er et firma (for eksempel en arkitekt, byggmester eller entreprenør) som har fagkunnskap og tar ansvar for bestemte deler av et byggeprosjekt. Kommunen stiller krav til at slike firmaer må ha riktig kompetanse og erfaring.
                          Les mer om ansvarsrett <a 
                            href="https://www.dibk.no/regelverk/sak/3/12/innledning" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#000000', 
                              textDecoration: 'underline',
                              fontFamily: 'Oslo Sans',
                              fontWeight: 300,
                              fontSize: '14px'
                            }}
                          >her</a>, og hvilke tiltak som krever ansvarlig foretak <a 
                            href="https://lovdata.no/dokument/NL/lov/2008-06-27-71/KAPITTEL_4-1#%C2%A720-3" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#000000', 
                              textDecoration: 'underline',
                              fontFamily: 'Oslo Sans',
                              fontWeight: 300,
                              fontSize: '14px'
                            }}
                          >her</a>.
                        </p>
                      </div>
                    )}
                  </span>, nettopp for å sikre at de som gjør jobben har riktig kompetanse, og leverer løsninger som faktisk fungerer. Søknadsplikten hjelper deg altså i å lykkes med tiltaket ditt.
                </p>
              </div>
                </div>
              </div>
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
};
import React, { useState } from 'react';

interface TettingProps {
  onBack?: () => void;
  buildingType?: string;
  stotteordninger?: any[];
  buildingData?: any;
}

export const SolenergiGul: React.FC<TettingProps> = ({ onBack, buildingType, stotteordninger: propStotteordninger, buildingData }) => {
  const [isPermitOpen, setIsPermitOpen] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [stotteordninger, setStotteordninger] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSourceTooltip, setShowSourceTooltip] = useState(false);

  // Hent støtteordninger fra Excel via API
  React.useEffect(() => {
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
        const url = `http://localhost:3001/api/stotteordninger-live?gulliste=true&tiltak=solenergi&bygningstype=${mappedType}`;
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
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStotteordninger();
  }, [buildingType]);

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
          transform: isPermitOpen ? (buildingType && buildingType.toLowerCase().trim() === 'enebolig' ? 'translateY(-625px)' : 'translateY(-540px)') : 'translateY(0)'
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
          Solenergi
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
              Solcelleanlegg kan være et effektivt og lønnsomt tiltak – også for deg som bor i et bygg med verneverdi. Med riktig plassering og god tilpasning er det fullt mulig å produsere egen strøm, samtidig som du tar vare på bygningens uttrykk.
            </p>
            <p style={{ marginBottom: '16px' }}>
              Har du overskuddsproduksjon, kan du få lavere nettleie ved å registrere deg som plusskunde hos nettselskapet.
            </p>
            <p style={{ marginBottom: '16px' }}>
              I <a 
                href="https://od2.pbe.oslo.kommune.no/solkart/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: '#000000', 
                  textDecoration: 'underline'
                }}
              >Oslos solkart</a> kan du sjekke hvor mye sol taket ditt får gjennom året – og vurdere om tiltaket er aktuelt for din bolig.
            </p>
            {buildingType && buildingType.toLowerCase() === 'enebolig' ? (
              <p style={{ marginBottom: '20px' }}>
                Takflater som vender mot sør, øst eller vest kan egne seg godt for solenergi. På hus med markerte takdetaljer eller fremtredende arkitektonisk uttrykk, vurderes det ofte som bedre å plassere anlegget på garasje, uthus eller et tilbygg. Et møte med Byantikvaren kan hjelpe deg å finne gode løsninger.
              </p>
            ) : buildingType && (buildingType.toLowerCase() === 'rekkehus' || buildingType.toLowerCase() === 'tomannsbolig') ? (
              <p style={{ marginBottom: '20px' }}>
                Takflater som vender mot sør, øst eller vest kan egne seg godt for solenergi. I flermannsboliger burde anlegget planlegges i dialog med naboen. Mange av disse husene har symmetrisk utforming eller felles tak, og ved å samarbeide kan dere finne løsninger som både ser helhetlige ut og som enklere får byggetillatelse. Bakside, bod eller tilbygg egner seg ofte best for diskré løsninger med lav visuell påvirkning. Et møte med Byantikvaren kan hjelpe dere å finne gode løsninger.
              </p>
            ) : (
              <p style={{ marginBottom: '20px' }}>
                Takflater som vender mot sør, øst eller vest kan egne seg godt for solenergi. I eldre blokker er flate tak og bakgårdsfasader ofte best egnet. Fasader og tak med arkitektoniske markerte deler bør som regel ikke endres. Når tiltak planlegges som et felles prosjekt i borettslaget eller sameiet, kan dere få til gode løsninger som både gir energigevinst og ivaretar byggets uttrykk. Et møte med Byantikvaren kan hjelpe dere å finne gode løsninger.              </p>
            )}
          </div>
        </foreignObject>
        
        {/* Blue rectangles */}
        <rect
          x="565"
          y="60"
          width="162"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Chart/graph icon in first box */}
        <svg x="573" y="67" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14.9333 3.73333V0H11.2V1.06667H13.1176L8.73813 5.44533L4.13595 0.77914L1.15888 3.75621L1.91312 4.51046L4.13067 2.2928L8.73339 6.95953L13.8667 1.82625V3.73333H14.9333Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M4.944 6.4H1.12V14.9333H0V16H16V14.9333H14.8747V6.93333H11.0507V14.9333H9.90933V9.06667H6.08533V14.9333H4.944V6.4ZM12.1173 14.9333H13.808V8H12.1173V14.9333ZM8.84267 10.1333V14.9333H7.152V10.1333H8.84267ZM3.87733 14.9333V7.46667H2.18667V14.9333H3.87733Z" fill="#2A2859"/>
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
          Høyere boligverdi
        </text>
        <rect
          x="565"
          y="106"
          width="177"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Bulb icon from Oslo kommune */}
        <svg x="573" y="113" width="16" height="16" viewBox="0 0 32 32" fill="none">
          <path fill="#2A2859" fillRule="evenodd"
            d="M10.169 2.377C11.868 1.423 13.842 1 16.012 1s4.144.423 5.843 1.377c1.706.958 3.078 2.42 4.084 4.401 1.539 3.032 1.228 5.892.182 8.472-.908 2.24-2.402 4.336-3.725 6.193l-.324.455v7.439L16 31l-5.59-1.682v-7.393q-.168-.214-.342-.43c-1.452-1.827-3.08-3.875-4.08-6.101-1.155-2.575-1.506-5.458.097-8.616 1.006-1.981 2.378-3.443 4.084-4.4m.91 1.635c-1.35.758-2.476 1.93-3.332 3.616-1.29 2.544-1.035 4.819-.058 6.997.896 1.995 2.367 3.848 3.838 5.701l.267.337h3.831q.069-.072.15-.162c.243-.27.55-.645.82-1.08.572-.921.81-1.821.445-2.553a5 5 0 0 0-.161-.298 4 4 0 0 1-.259.37c-.292.371-.68.714-1.182.894-.521.187-1.075.166-1.623-.04-1.078-.405-1.908-1.138-1.924-2.186-.016-.985.71-1.704 1.444-2.053.763-.363 1.747-.455 2.722-.101.16-.715.262-1.437.325-2.014a22 22 0 0 0 .09-1.044l.003-.058v-.016l.933.041.932.042v.008l-.002.02-.004.07q-.004.09-.016.255a24 24 0 0 1-.081.887c-.08.724-.22 1.694-.46 2.64q-.034.137-.072.277a6 6 0 0 1 1.004 1.469c.821 1.649.125 3.324-.531 4.382q-.08.128-.162.25h2.642l.22-.31c1.34-1.882 2.695-3.788 3.515-5.81.9-2.22 1.114-4.49-.117-6.915-.855-1.686-1.98-2.858-3.332-3.616-1.358-.763-3.001-1.14-4.932-1.14s-3.574.377-4.932 1.14m1.198 20.396v-1.873h7.93v1.873zm0 1.873v1.644l3.747 1.127 4.182-1.145V26.28zm2.88-10.503q.172-.219.325-.54l-.03-.012c-.508-.194-.988-.136-1.318.021-.304.145-.363.296-.375.33.024.057.148.252.711.464.185.07.282.05.34.03.076-.027.196-.102.347-.293"
            clipRule="evenodd" />
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
          Bedre strømstyring
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
          width="183"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Lightning bolt icon in fourth box */}
        <svg x="573" y="205" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M9.5 1L3 9.25H7.5L6.5 15L13 6.75H8.5L9.5 1Z" fill="none" stroke="#2A2859" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
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
          Egenprodusert strøm
        </text>
        
        {/* Dark green box below the list */}
        <rect
          x="565"
          y="260"
          width="211"
          height="124"
          fill="#034B45"
        />
        
        {/* Årlig besparelse text */}
        <text
          x="589"
          y="284"
          width="149"
          height="24"
          fontFamily="Oslo Sans"
          fill="#FFFFFF"
          dominantBaseline="hanging"
        >
          Årlig besparelse
        </text>
        
        {/* Question mark icon with hover area */}
        <g>
          {/* Invisible hover area that covers the entire icon */}
          <rect
            x="728"
            y="278"
            width="24"
            height="24"
            fill="transparent"
            onMouseEnter={() => setShowSourceTooltip(true)}
            onMouseLeave={() => setShowSourceTooltip(false)}
            style={{ cursor: 'pointer' }}
          />
          
          {/* The actual icon */}
          <svg x="728" y="278" width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ pointerEvents: 'none' }}>
            <path d="M15.93 7.6C17.1356 7.5897 18.3022 8.02698 19.204 8.82721C20.1058 9.62744 20.6787 10.7337 20.8118 11.932C20.945 13.1303 20.6289 14.3354 19.9247 15.314C19.2206 16.2927 18.1785 16.9754 17 17.23H16.94V18.91H14.94V15.35H15.94C16.479 15.3516 17.0077 15.2019 17.4658 14.9179C17.924 14.634 18.2932 14.2271 18.5316 13.7437C18.77 13.2602 18.8679 12.7196 18.8142 12.1832C18.7606 11.6469 18.5574 11.1364 18.228 10.7098C17.8986 10.2831 17.456 9.95754 16.9507 9.76998C16.4453 9.58243 15.8975 9.54045 15.3695 9.64883C14.8415 9.75721 14.3545 10.0116 13.9639 10.383C13.5733 10.7545 13.2948 11.2281 13.16 11.75V11.92L11.16 11.53C11.3793 10.425 11.9741 9.42996 12.8436 8.71364C13.713 7.99731 14.8035 7.60384 15.93 7.6ZM16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.97351 8.64968 3.98957 11.0251C3.00563 13.4006 2.74818 16.0144 3.24979 18.5362C3.7514 21.0579 4.98953 23.3743 6.80761 25.1924C8.62569 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5994 28.9944 20.9749 28.0104C23.3503 27.0265 25.3806 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C29 12.5522 27.6304 9.24558 25.1924 6.80761C22.7544 4.36964 19.4478 3 16 3ZM16 1C18.9667 1 21.8668 1.87973 24.3336 3.52796C26.8003 5.17618 28.7229 7.51886 29.8582 10.2597C30.9935 13.0006 31.2906 16.0166 30.7118 18.9264C30.133 21.8361 28.7044 24.5088 26.6066 26.6066C24.5088 28.7044 21.8361 30.133 18.9264 30.7118C16.0166 31.2906 13.0006 30.9935 10.2597 29.8582C7.51886 28.7229 5.17618 26.8003 3.52796 24.3336C1.87973 21.8668 1 18.9667 1 16C1 12.0218 2.58035 8.20644 5.3934 5.3934C8.20644 2.58035 12.0218 1 16 1Z" fill="#FFFFFF"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M17.65 22.38C17.648 22.7197 17.5455 23.0513 17.3553 23.3328C17.1651 23.6144 16.8958 23.8333 16.5813 23.9619C16.2669 24.0906 15.9213 24.1232 15.5884 24.0557C15.2554 23.9882 14.9498 23.8236 14.7103 23.5827C14.4707 23.3418 14.3079 23.0353 14.2424 22.7019C14.1768 22.3685 14.2114 22.0232 14.3419 21.7095C14.4724 21.3958 14.6928 21.1277 14.9755 20.9392C15.2581 20.7506 15.5902 20.65 15.93 20.65C16.1567 20.65 16.3812 20.6948 16.5905 20.7819C16.7999 20.8689 16.9899 20.9965 17.1498 21.1573C17.3096 21.3181 17.4361 21.5089 17.522 21.7187C17.6078 21.9285 17.6513 22.1533 17.65 22.38Z" fill="#FFFFFF"/>
          </svg>
        </g>
        
        
        
        {/* Solar energy savings text */}
        {buildingData?.filteredSolarEnergy && buildingData.filteredSolarEnergy > 0 ? (
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
              {`${Math.round((buildingData.filteredSolarEnergy * 0.9) / 1000) * 1000} - ${Math.round((buildingData.filteredSolarEnergy * 1.1) / 1000) * 1000} kWh`}
            </text>
            
            {/* Tilsvarer text - calculated based on kWh * Norgespris (1.1 kr/kWh) */}
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
              {(() => {
                // Norgespris: 1.1 kr/kWh
                const norgespris = 1.1;
                const baseKr = buildingData.filteredSolarEnergy * norgespris;
                const lowerKr = Math.round((baseKr * 0.9) / 1000) * 1000;
                const upperKr = Math.round((baseKr * 1.1) / 1000) * 1000;
                return `${lowerKr} - ${upperKr} kr`;
              })()}
            </text>
          </>
        ) : (
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
            Boligen din er ikke egnet
            <tspan x="589" dy="22">for solcellepanel</tspan>
          </text>
        )}
        
        {/* Circle below main text */}
        <circle
          cx="170"
          cy="490"
          r="110"
          fill="#2A2859"
        />
        
        {/* "Tips om tetting" title in circle */}
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
        
        {/* Four lines of text below "Les mer" */}
        <text
          x="170"
          y="490"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://www.enova.no/nb/privat/bolig/stottetilbud-bolig/solcelleanlegg', '_blank')}
        >
          Enova
        </text>
        <text
          x="170"
          y="510"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://www.nve.no/reguleringsmyndigheten/regulering/nettvirksomhet/nettleie/tariffer-for-produksjon/plusskunder/', '_blank')}
        >
          Plusskundeordning
        </text>
        <text
          x="170"
          y="530"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://www.oslo.kommune.no/getfile.php/13450103-1751020179/Tjenester%20og%20tilbud/Plan%2C%20bygg%20og%20eiendom/Byggesaksveiledere%2C%20normer%20og%20skjemaer/Om%20solceller%20%E2%80%93%20informasjonsark%20mai%202022.pdf', '_blank')}
        >
          Byantikvaren
        </text>
        <text
          x="170"
          y="550"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://www.oslo.kommune.no/getfile.php/13450103-1751020179/Tjenester%20og%20tilbud/Plan%2C%20bygg%20og%20eiendom/Byggesaksveiledere%2C%20normer%20og%20skjemaer/Om%20solceller%20%E2%80%93%20informasjonsark%20mai%202022.pdf', '_blank')}
        >
          Riksantikvaren
        </text>
        
        {/* Dynamic table with scrollbar */}
        {/* Top border */}
        <rect
          x="298"
          y={needsScroll ? "440" : "470"}
          width="482"
          height="2"
          fill="#CCCCCC"
        />
        
        {/* Table container with scrolling via foreignObject */}
        <foreignObject x="298" y={needsScroll ? "442" : "472"} width="482" height={needsScroll ? "144" : `${Math.max(stotteordninger.length * 36, 36)}`}>
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
            {isLoading ? (
              <svg width="474" height="36" viewBox="0 0 474 36">
                <rect x="0" y="0" width="474" height="36" fill="#F9F9F9"/>
                <text
                  x="237"
                  y="18"
                  fontFamily="Oslo Sans"
                  fontWeight="300"
                  fontSize="12"
                  fill="#666666"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  Laster støtteordninger...
                </text>
              </svg>
            ) : stotteordninger.length === 0 ? (
              <svg width="474" height="36" viewBox="0 0 474 36">
                <rect x="0" y="0" width="474" height="36" fill="#F9F9F9"/>
                <text
                  x="237"
                  y="18"
                  fontFamily="Oslo Sans"
                  fontWeight="300"
                  fontSize="12"
                  fill="#666666"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  Ingen støtteordninger funnet
                </text>
              </svg>
            ) : (
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
                    
                    {/* Overskrift box - dynamisk størrelse */}
                    {(() => {
                      // Bruk "Oslo kommune" i stedet for "Klima- og energifondet"
                      const displayText = ordning.overskrift === 'Klima- og energifondet' ? 'Oslo kommune' : ordning.overskrift;
                      // Beregn bredde basert på tekst (ca 6px per tegn for 10px font)
                      const textWidth = displayText ? displayText.length * 6 : 0;
                      const boxWidth = textWidth + 10; // 5px padding på hver side (matcher Enova)
                      const boxX = 396 - boxWidth; // Høyrejuster til x=396 (samme som Enova: 353 + 43)
                      
                      return (
                        <>
                          <rect
                            x={boxX}
                            y={boxYPosition}
                            width={boxWidth}
                            height="23"
                            fill={overskriftFarger[ordning.overskrift] || '#E0E0E0'}
                          />
                          
                          {/* Overskrift text */}
                          <text
                            x={boxX + (boxWidth / 2)}
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
                            {displayText}
                          </text>
                        </>
                      );
                    })()}
                    
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
            )}
          </div>
        </foreignObject>
        
        {/* "Relevante støtteordninger" text */}
        <text
          x="308"
          y={needsScroll ? "433" : "463"}
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
          y={needsScroll ? "433" : "463"}
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
          y={needsScroll ? "433" : "463"}
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
        {!showSourceTooltip && (
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
        )}
        
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
              borderTop: '2px solid #2A285980',
              borderRight: '2px solid #2A285980',
              borderBottom: '2px solid #2A285980',
              borderLeft: '2px solid #2A285980',
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
              borderTop: 'none',
              borderRight: isPermitOpen ? '2px solid #2A285980' : 'none',
              borderBottom: isPermitOpen ? '2px solid #2A285980' : 'none',
              borderLeft: isPermitOpen ? '2px solid #2A285980' : 'none',
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
                Solcelleanlegg på bygg med verneverdi er som regel søknadspliktig fordi det regnes som teknisk installasjon og fasadeendring. Du må derfor kontakte en fagperson (arkitekt, byggmester eller entreprenør) som søker om tillatelse fra Plan- og bygningsetaten for deg. Du kan selv ta kontakt med Byantikvaren for gratis rådgivning i forkant. I byggesaken vil fagpersonen eller saksbehandler i Plan- og bygningsetaten uansett innhente en uttalelse fra Byantikvaren. Ved søknad om solenergianlegg får du 100% rabatt for saksbehandling, samt forespørsel om søknadsplikt.
              </p>
              
              {/* Conditional paragraph for enebolig */}
              {buildingType && buildingType.toLowerCase().trim() === 'enebolig' && (
                <p style={{ marginTop: '16px', marginBottom: '0' }}>
                  I noen tilfeller kan solcelleanlegg på enebolig være unntatt søknadsplikt dersom det regnes som «enkel installasjon». Dette går ikke dersom det fører til fasadeendring. Terskelen for om det regnes som fasadeendring eller ikke er lavere for bevaringsverdige bygg. I <a 
                    href="https://www.dibk.no/regelverk/sak/2/4/4-1"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#2A2859',
                      textDecoration: 'underline'
                    }}
                  >veiledning til SAK10 §4-1 bokstav e nr.4</a> kan du lese mer om hva som regnes som «enkel installasjon».
                </p>
              )}
              
              {/* Links section */}
              <div style={{ marginTop: '16px' }}>
                <a 
                  href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/skal-du-bygge-rive-eller-endre/ma-du-sende-byggesoknad/solcelle-eller-solfangeranlegg/"
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
                    textDecoration: 'underline',
                    marginBottom: '12px'
                  }}
                >
                  Kontakt Plan- og bygningsetaten for en konkret vurdering av søknadsplikt for ditt tiltak, mot gebyr
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', flexShrink: 0 }}>
                    <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#2A2859"/>
                  </svg>
                </a>
                
                <a 
                  href="https://www.oslo.kommune.no/etater-foretak-og-ombud/byantikvaren/#toc-2"
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
                  Bestill gratis veiledningstime, eller saksbehandling over disk, hos Byantikvaren
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
        
        {/* Source tooltip - moved to end for proper z-order */}
        {showSourceTooltip && (
          <foreignObject x="565" y="20" width="211" height="450"
            onMouseEnter={() => setShowSourceTooltip(true)}
            onMouseLeave={() => setShowSourceTooltip(false)}
          >
            <div 
              xmlns="http://www.w3.org/1999/xhtml"
              style={{
                backgroundColor: '#034B45',
                padding: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <h4 style={{
                  fontFamily: 'Oslo Sans',
                  fontWeight: 700,
                  fontStyle: 'normal',
                  fontSize: '16px',
                  lineHeight: '24px',
                  letterSpacing: '-0.2px',
                  color: '#FFFFFF',
                  margin: 0
                }}>
                  Kilde
                </h4>
                <button
                  onClick={() => setShowSourceTooltip(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: '-4px',
                    marginRight: '-4px'
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p style={{
                fontFamily: 'Oslo Sans',
                fontWeight: 300,
                fontSize: '14px',
                lineHeight: '22px',
                letterSpacing: '0px',
                color: '#FFFFFF',
                margin: 0
              }}>
                Data for årlig solinnstårlig og areal for ulike takflater blir hentet fra Oslo kommunes <a 
                  href="https://od2.pbe.oslo.kommune.no/solkart/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: '#FFFFFF', 
                    textDecoration: 'underline'
                  }}
                >Solkart</a>. For alle takflater med årlig solpotensial over 800 kWh/m², så summeres produktene av innstårligen og takflatearealet. Deretter antas det at 85% av takarealet kan utnyttes til solceller, og at solcellene har en en virkningsgrad på 20%.
              </p>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
};
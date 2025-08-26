import React, { useState } from 'react';

interface TettingProps {
  onBack?: () => void;
  buildingType?: string;
  stotteordninger?: any[];
}

export const Tetting: React.FC<TettingProps> = ({ onBack, buildingType, stotteordninger: propStotteordninger }) => {
  const [isPermitOpen, setIsPermitOpen] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [stotteordninger, setStotteordninger] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        const url = `http://localhost:3001/api/stotteordninger-live?gulliste=true&tiltak=tetting&bygningstype=${mappedType}`;
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
          transform: isPermitOpen ? 'translateY(-500px)' : 'translateY(0)'
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
          Tetting
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
              Tetting er et enkelt og effektivt tiltak som kan gi stor forskjell i både komfort og strømforbruk. Ofte holder det å tette rundt vinduer, dører og lister for å stoppe trekken og få lunere rom. Tiltaket krever lite inngrep, koster lite – og passer godt til eldre bygg.
            </p>
            <p style={{ marginBottom: '16px' }}>
              For å få et varig og trygt resultat, bør du bruke materialer og metoder som er tilpasset bygningens alder og konstruksjon.
            </p>
            {buildingType && buildingType.toLowerCase() === 'enebolig' ? (
              <p style={{ marginBottom: '20px' }}>
                Trekken i eldre eneboliger kommer ofte fra vinduer, dører og overganger mellom etasjer. I murhus er det ofte gulv, hjørner og overgangen mot kjeller og loft som lekker. I trehus kan det være rundt dører og vinduer, der materialene har beveget seg over tid. Tetting med tettelister, dyttestrimmel eller isolering bak listverk er enkle tiltak som raskt gir effekt.
              </p>
            ) : (
              <p style={{ marginBottom: '20px' }}>
                I blokker er det vanlig at trekken kommer rundt eldre vinduer eller i overgangen mot fellesarealer som trapperom, kjeller eller loft. Tetting rundt egne vinduer og inne i leiligheten kan du ofte gjøre selv, så lenge det ikke berører fasade eller felleskonstruksjoner. Hvis lekkasjen gjelder deler av bygget som deles av flere, bør tiltakene vurderes i fellesskap med styret. Tetting er også lurt å gjøre sammen med annet vedlikehold for å få mer igjen for innsatsen.
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
        
        {/* Snowflake icon */}
        <svg x="573" y="67" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.49023 3.23242L10.0698 1.71387L10.7529 2.375L8.49023 4.55762V7.18604L10.8765 5.86035L11.6987 2.90918L11.689 2.89062L12.6299 3.13428L12.0527 5.20703L14.5122 3.84229L15 4.65771L12.5381 6.02344L14.6978 6.59375L14.459 7.50293L11.3262 6.69629L8.98047 7.99951L11.3706 9.32666L14.4492 8.53418V8.50146L14.6978 9.40625L12.5391 9.97559L15 11.3423L14.5122 12.1577L12.0508 10.7905L12.6299 12.8843L11.689 13.1279L10.8525 10.1255L8.49023 8.81348V11.4458L10.7529 13.625L10.0698 14.2861L8.49023 12.7671V15.5H7.51465V12.7661L5.93018 14.2861L5.24268 13.625L7.51465 11.4404V8.81348L5.14062 10.1299L4.31104 13.1094L3.37012 12.8657L3.94385 10.7939L1.48779 12.1577L1 11.3423L3.47461 9.96875L1.30225 9.40625L1.55566 8.51562L4.65381 9.31396L7.02393 7.99951L4.67236 6.69482L1.55566 7.49854L1.30225 6.59375L3.46094 6.02295L1 4.65771L1.48779 3.84229L3.94141 5.20312L3.36523 3.13428L4.30615 2.89062H4.31104L5.13623 5.86621L7.51465 7.18604V4.55908L5.24268 2.375L5.93018 1.71387L7.51465 3.2334V0.5H8.49023V3.23242Z" fill="#2A2859"/>
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
          width="147"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* House icon from Oslo kommune */}
        <svg x="573" y="113" width="16" height="16" viewBox="0 0 32 32" fill="none">
          <path d="M1.233 16.423L16 1.645l4 4.003V4.06h6v7.592l4.767 4.771-1.414 1.414L16 4.474 2.647 17.837z" fill="#2A2859"/>
          <path d="M8 29V16H6v15h8V20h4v11h8V16h-2v13h-4V18h-8v11z" fill="#2A2859"/>
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
          Ivaretar boligen
        </text>
        <rect
          x="565"
          y="152"
          width="155"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* House with heart icon */}
        <svg x="573" y="159" width="17" height="16" viewBox="0 0 17 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M5.42501 7.092C6.21251 6.3035 7.49451 6.304 8.28301 7.092L8.33251 7.1425L8.38251 7.0925C9.17051 6.3045 10.453 6.3045 11.241 7.0925C12.0285 7.88 12.0285 9.1625 11.241 9.9505L8.33301 12.8585L5.42501 9.95C4.63701 9.162 4.63701 7.88 5.42501 7.092ZM10.5345 7.799C10.136 7.401 9.48851 7.401 9.09001 7.799L8.33301 8.556L7.57601 7.7995C7.37701 7.6005 7.11551 7.501 6.85401 7.501C6.59251 7.501 6.33101 7.6005 6.13201 7.7995C5.73401 8.1975 5.73401 8.845 6.13201 9.2435L8.33301 11.4445L10.5345 9.243C10.9325 8.845 10.9325 8.197 10.5345 7.799Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M5.65601 2.7305L8.33301 0.5L14.333 5.5V16H2.33301V1H5.22351L5.65601 2.7305ZM4.44251 2H3.33301V4.6665L4.80301 3.4415L4.44251 2ZM3.33301 5.9685V15H13.333V5.9685L8.33301 1.802L3.33301 5.9685Z" fill="#2A2859"/>
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
          Bedre bokvalitet
        </text>
        <rect
          x="565"
          y="198"
          width="190"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Heater icon */}
        <svg x="573" y="205" width="16" height="16" viewBox="0 0 16 16" fill="none">
          {/* Heat waves - wavy */}
          <path d="M4.5 0.5C4.5 0.5 4 1 4 1.5C4 2 4.5 2.5 4.5 2.5C4.5 2.5 5 2 5 1.5C5 1 4.5 0.5 4.5 0.5Z" fill="#2A2859"/>
          <path d="M8 0.5C8 0.5 7.5 1 7.5 1.5C7.5 2 8 2.5 8 2.5C8 2.5 8.5 2 8.5 1.5C8.5 1 8 0.5 8 0.5Z" fill="#2A2859"/>
          <path d="M11.5 0.5C11.5 0.5 11 1 11 1.5C11 2 11.5 2.5 11.5 2.5C11.5 2.5 12 2 12 1.5C12 1 11.5 0.5 11.5 0.5Z" fill="#2A2859"/>
          {/* Heater body */}
          <rect x="1" y="4" width="14" height="9" rx="2" fill="#2A2859"/>
          <rect x="2" y="5" width="12" height="7" rx="1" fill="#C7F6C9"/>
          {/* Vertical heater lines - 5 lines */}
          <rect x="3.5" y="6" width="0.8" height="5" fill="#2A2859"/>
          <rect x="5.5" y="6" width="0.8" height="5" fill="#2A2859"/>
          <rect x="7.6" y="6" width="0.8" height="5" fill="#2A2859"/>
          <rect x="9.7" y="6" width="0.8" height="5" fill="#2A2859"/>
          <rect x="11.7" y="6" width="0.8" height="5" fill="#2A2859"/>
          {/* Legs */}
          <rect x="3" y="13" width="1.5" height="2" fill="#2A2859"/>
          <rect x="11.5" y="13" width="1.5" height="2" fill="#2A2859"/>
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
          Redusert energibehov
        </text>
        
        {/* Dark green box below the list */}
        <rect
          x="565"
          y="260"
          width="211"
          height="124"
          fill="#034B45"
        />
        
        {/* Strømbesparelser text */}
        <text
          x="589"
          y="284"
          width="149"
          height="24"
          fontFamily="Oslo Sans"
          fill="#FFFFFF"
          dominantBaseline="hanging"
        >
          Strømbesparelser
        </text>
        
        {/* Mangler data kWh text */}
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
          Mangler data kWh
        </text>
        
        {/* Mangler data kr text */}
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
          Mangler data kr
        </text>
        
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
        
        {/* Three lines of text below "Tips om tetting" */}
        <text
          x="170"
          y="496"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://riksantikvaren.no/veileder/rad-om-energisparing-i-gamle-hus/#72aa0e54-2678-43a1-8fd2-f4f2f7697e46', '_blank')}
        >
          Riksantikvaren
        </text>
        <text
          x="170"
          y="518"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://issuu.com/fortidsminneforeningen/docs/en_k-tiltak_i_gamle_hus/13', '_blank')}
        >
          Fortidsminneforeningen
        </text>
        <text
          x="170"
          y="540"
          fontFamily="Oslo Sans"
          fontWeight="300"
          fontStyle="normal"
          fontSize="14"
          lineHeight="22"
          fill="#FFFFFF"
          textAnchor="middle"
          textDecoration="underline"
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://byggogbevar.no/enoek/artikler/tiltak/tetting-rundt-vinduer-og-doerer/', '_blank')}
        >
          Bygg og bevar
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
                Tetting regnes som vedlikehold og er normalt ikke søknadspliktig, så lenge tiltaket ikke endrer bygningens uttrykk, fasade eller detaljer. Inngrep som påvirker verneverdige vinduer eller dører, kan likevel være søknadspliktige. Er du i tvil, eller planlegger å gjøre inngrep i eldre konstruksjoner, kan du ta kontakt med Byantikvaren for gratis veiledning før du setter i gang. Du kan også kontakte Plan- og bygningsetaten og mot gebyr få en konkret vurdering av søknadsplikt.
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
      </svg>
    </div>
  );
};
import React, { useState, useEffect } from 'react';

interface VarmepumpeGulProps {
  onBack?: () => void;
  buildingType?: string;
  buildingData?: any;
}

export const VarmepumpeGul: React.FC<VarmepumpeGulProps> = ({ onBack, buildingType, buildingData }) => {
  const [isPermitOpen, setIsPermitOpen] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [activeButton, setActiveButton] = useState<string>('Generelt');
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
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
        const url = `http://localhost:3001/api/stotteordninger-live?gulliste=true&tiltak=varmepumpe&bygningstype=${mappedType}`;
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
          transform: isPermitOpen ? 'translateY(-500px)' : 'translateY(0)'
        }}
      >
        <text
          x="60"
          y="-50"
          fontFamily="Oslo Sans, sans-serif"
          fontWeight="700"
          fontStyle="normal"
          fontSize="24"
          lineHeight="36"
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="hanging"
        >
          Varmepumpe
        </text>
        
        
        {/* Button boxes - invisible clickable areas */}
        <rect
          x="60"
          y="4"
          width="94"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Generelt')}
          onMouseEnter={() => setHoveredButton('Generelt')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        <rect
          x="154"
          y="4"
          width="94"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Luft-luft')}
          onMouseEnter={() => setHoveredButton('Luft-luft')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        <rect
          x="248"
          y="4"
          width="94"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Luft-vann')}
          onMouseEnter={() => setHoveredButton('Luft-vann')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        <rect
          x="342"
          y="4"
          width="94"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Vann-vann')}
          onMouseEnter={() => setHoveredButton('Vann-vann')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        <rect
          x="436"
          y="4"
          width="94"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Ventilasjon')}
          onMouseEnter={() => setHoveredButton('Ventilasjon')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        {/* Text inside button boxes */}
        <text
          x="107"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Generelt' ? "#000000" : hoveredButton === 'Generelt' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Generelt')}
          onMouseEnter={() => setHoveredButton('Generelt')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Generelt
        </text>
        
        <text
          x="201"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Luft-luft' ? "#000000" : hoveredButton === 'Luft-luft' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Luft-luft')}
          onMouseEnter={() => setHoveredButton('Luft-luft')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Luft-luft
        </text>
        
        <text
          x="295"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Luft-vann' ? "#000000" : hoveredButton === 'Luft-vann' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Luft-vann')}
          onMouseEnter={() => setHoveredButton('Luft-vann')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Luft-vann
        </text>
        
        <text
          x="389"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Vann-vann' ? "#000000" : hoveredButton === 'Vann-vann' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Vann-vann')}
          onMouseEnter={() => setHoveredButton('Vann-vann')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Vann-vann
        </text>
        
        <text
          x="483"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Ventilasjon' ? "#000000" : hoveredButton === 'Ventilasjon' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Ventilasjon')}
          onMouseEnter={() => setHoveredButton('Ventilasjon')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Ventilasjon
        </text>
        
        {/* Button underlines - active and hover */}
        <rect
          x="60"
          y="49"
          width="94"
          height="4"
          fill={activeButton === 'Generelt' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Generelt' ? 1 : hoveredButton === 'Generelt' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Generelt' || hoveredButton === 'Generelt' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        <rect
          x="154"
          y="49"
          width="94"
          height="4"
          fill={activeButton === 'Luft-luft' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Luft-luft' ? 1 : hoveredButton === 'Luft-luft' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Luft-luft' || hoveredButton === 'Luft-luft' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        <rect
          x="248"
          y="49"
          width="94"
          height="4"
          fill={activeButton === 'Luft-vann' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Luft-vann' ? 1 : hoveredButton === 'Luft-vann' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Luft-vann' || hoveredButton === 'Luft-vann' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        <rect
          x="342"
          y="49"
          width="94"
          height="4"
          fill={activeButton === 'Vann-vann' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Vann-vann' ? 1 : hoveredButton === 'Vann-vann' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Vann-vann' || hoveredButton === 'Vann-vann' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        <rect
          x="436"
          y="49"
          width="94"
          height="4"
          fill={activeButton === 'Ventilasjon' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Ventilasjon' ? 1 : hoveredButton === 'Ventilasjon' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Ventilasjon' || hoveredButton === 'Ventilasjon' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        {/* Horizontal line above content */}
        <rect
          x="60"
          y="53"
          width="470"
          height="1"
          fill="#CCCCCC"
        />
        
        {/* Content areas for each button */}
        {activeButton === 'Generelt' && (
          <foreignObject x="60" y="69" width="464" height="289">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              fontFamily: 'Oslo Sans',
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '0px',
              color: '#000000',
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
              <p style={{ marginTop: 0, marginBottom: '16px' }}>
                Varmepumpe kan være en god løsning for oppvarming, bedre inneklima samt en effektiv måte å spare energi og redusere strømregningen på - også i verneverdige bygninger. Det er viktig å velge riktig type og plassering av hensyn til byggets historiske verdier. I mange tilfeller finnes det gode løsninger, så lenge de gjøres på riktig måte.
              </p>
              {buildingType?.toLowerCase() === 'enebolig' && (
                <p style={{ marginBottom: 0 }}>
                  På murhus, laftede hus, bindingsverk og reisverk anbefales det å unngå plassering av varmepumpe mot gaten. Tenk også på at naboer ikke forstyrres med støy og visuell påvirkning. Det kan være lurt å benytte eksisterende hull og åpninger. Luft-til-luft varmepumpe er det vanligste alternativet, men luft-til-vann kan være aktuelt for større oppvarmingsbehov.
                </p>
              )}
              {(buildingType?.toLowerCase() === 'rekkehus' || buildingType?.toLowerCase() === 'tomannsbolig') && (
                <>
                  <p style={{ marginBottom: '16px' }}>
                    På murhus, laftede hus, bindingsverk og reisverk anbefales det å unngå plassering av varmepumpe mot gaten. Tenk også på at naboer ikke forstyrres med støy og visuell påvirkning. Det er lurt å benytte eksisterende hull og åpninger, ventiler og pipegjeonnomføringer. Dersom bygget har originale og sjeldne elementer i fasaden må det særlig tas hensyn til disse.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Siden mange tomannsboliger og rekkehus har like fasader, bør du samarbeide med naboen. Da er det enklere å finne løsninger som fungerer både teknisk og visuelt.
                  </p>
                </>
              )}
              {(buildingType?.toLowerCase() === 'leilighet' || buildingType?.toLowerCase() === 'blokk' || buildingType?.toLowerCase() === 'store boligbygg') && (
                <>
                  <p style={{ marginBottom: '16px' }}>
                    I blokker er det spesielt viktig å ta hensyn til både byggets helhet og naboene rundt. Mange blokker på gul liste er oppført i mur eller betong, med arkitektoniske detaljer som har høy verneverdi – enten det gjelder fasadeuttrykk, materialbruk eller proporsjoner. Utedeler til luft-til-luft varmepumper kan være lite egnet i slike bygg, både på grunn av visuell påvirkning og støy, og fordi de bryter med fasadeuttrykket. I noen tilfeller er de ikke tillatt i det hele tatt.
                  </p>
                  <p style={{ marginBottom: '16px' }}>
                    Skal man vurdere varmepumpe i blokk, er det gjerne mer aktuelt med luft-til-vann eller væske-til-vann-løsninger, som kan kobles til et felles vannbårent anlegg. Dette krever større investering og teknisk planlegging, men gir mulighet for skjulte installasjoner og god energisparing for hele bygget.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Når du deler fasade, tekniske løsninger og utearealer i borettslag og sameier, må slike tiltak samordnes med styret og andre beboere. Samkjørte løsninger gir som regel bedre teknisk og visuell kvalitet, og øker sjansen for at tiltaket får byggetillatelse.
                  </p>
                </>
              )}
            </div>
          </foreignObject>
        )}
        
        {activeButton === 'Luft-luft' && (
          <foreignObject x="60" y="69" width="464" height="289">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              fontFamily: 'Oslo Sans',
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '0px',
              color: '#000000',
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
              <p style={{ marginTop: 0, marginBottom: 0 }}>
                Luft-til-luft varmepumper henter varme fra uteluften og blåser den direkte inn som varm luft i boligen. Den er rimelig, enkel å installere og passer godt for mindre boliger eller åpne planløsninger. Inne- og utedelen er synlige, så plassering bør planlegges nøye – særlig i verneverdige bygg hvor visuelle hensyn er viktige.
              </p>
            </div>
          </foreignObject>
        )}
        
        {activeButton === 'Luft-vann' && (
          <foreignObject x="60" y="69" width="464" height="289">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              fontFamily: 'Oslo Sans',
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '0px',
              color: '#000000',
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
              <p style={{ marginTop: 0, marginBottom: 0 }}>
                Luft-til-vann-systemer bruker varmen i uteluften til å varme opp vann, som sirkulerer i radiatorer, gulvvarme eller brukes til tappevann. Dette gir en jevn og behagelig oppvarming, men krever at huset har et vannbårent system. Det er en mer omfattende installasjon enn luft-til-luft, og passer godt i boliger der man ønsker en helhetlig løsning.
              </p>
            </div>
          </foreignObject>
        )}
        
        {activeButton === 'Vann-vann' && (
          <foreignObject x="60" y="69" width="464" height="289">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              fontFamily: 'Oslo Sans',
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '0px',
              color: '#000000',
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
              <p style={{ marginTop: 0, marginBottom: 0 }}>
                Vann-til-vann varmepumper henter varme fra fjell, jord eller sjø via nedgravde rør eller borehull. Den har høy effektivitet, også på kalde vinterdager, og gir varme til både oppvarming og tappevann. Dette er den mest omfattende og kostbare løsningen, men den egner seg godt for større boliger, blokker eller ved rehabilitering der man ønsker et robust og skjult system.
              </p>
            </div>
          </foreignObject>
        )}
        
        {activeButton === 'Ventilasjon' && (
          <foreignObject x="60" y="69" width="464" height="289">
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              fontFamily: 'Oslo Sans',
              fontWeight: 300,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '22px',
              letterSpacing: '0px',
              color: '#000000',
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
              <p style={{ marginTop: 0, marginBottom: 0 }}>
                Ventilasjonsvarmepumper gjenvinner varme fra brukt luft som ventileres ut av boligen, og bruker den til å varme opp tilluft, tappevann eller vannbåren varme. Ventilasjonsvarmepumper krever balansert ventilasjon (altså at både tilluft og avtrekk går i kanalnett), og er derfor mest egnet i nyere hus eller når det etableres nytt ventilasjonsanlegg.
              </p>
            </div>
          </foreignObject>
        )}
        
        {/* Blue rectangles */}
        <rect
          x="565"
          y="40"
          width="132"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Sound/speaker icon in first box */}
        <svg x="573" y="47" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3.71973 13.75H3.70947C3.70414 13.7499 3.69682 13.7497 3.68799 13.7495C3.67026 13.7492 3.64569 13.7484 3.61523 13.7471C3.55407 13.7445 3.46815 13.7392 3.36621 13.729C3.16479 13.7089 2.88779 13.668 2.604 13.583C2.32538 13.4996 2.00381 13.3632 1.74463 13.1304C1.47111 12.8846 1.27492 12.5362 1.2749 12.085V10.645H0.5V5.36475H3.61865L11.6099 2.00195V14.0083L4.22021 10.8931V13.75H3.71973ZM4.22021 6.19678V9.80811L10.6099 12.501V3.50781L4.22021 6.19678ZM14.7729 10.6304L14.6152 11.105L14.457 11.5791L12.3374 10.8745L12.6528 9.92529L14.7729 10.6304ZM1.5 9.63965H3.22021V6.36475H1.5V9.63965ZM15.1807 6.76514L15.1694 7.76465L12.9346 7.73975L12.9458 6.73975L15.1807 6.76514ZM14.7788 3.70215L12.7788 4.70215L12.3315 3.80762L14.3315 2.80762L14.7788 3.70215ZM2.2749 12.085C2.27492 12.216 2.32204 12.3044 2.41309 12.3862C2.51856 12.481 2.68351 12.5633 2.89111 12.6255C3.00157 12.6586 3.11427 12.6821 3.22021 12.7002V10.645H2.2749V12.085Z" fill="#2A2859"/>
        </svg>
        <text 
          x="597"
          y="55"
          fontFamily="Oslo Sans"
          fontWeight="500"
          fontSize="14"
          lineHeight="22"
          letterSpacing="-0.2"
          fill="#2A2859"
          dominantBaseline="middle"
        >
          Redusert støy
        </text>
        <rect
          x="565"
          y="86"
          width="147"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* House icon from Oslo kommune in second box */}
        <svg x="573" y="93" width="16" height="16" viewBox="0 0 32 32" fill="none">
          <path d="M1.233 16.423L16 1.645l4 4.003V4.06h6v7.592l4.767 4.771-1.414 1.414L16 4.474 2.647 17.837z" fill="#2A2859"/>
          <path d="M8 29V16H6v15h8V20h4v11h8V16h-2v13h-4V18h-8v11z" fill="#2A2859"/>
        </svg>
        <text 
          x="598"
          y="101"
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
          y="132"
          width="155"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* House with heart icon in third box */}
        <svg x="573" y="139" width="17" height="16" viewBox="0 0 17 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M5.42501 7.092C6.21251 6.3035 7.49451 6.304 8.28301 7.092L8.33251 7.1425L8.38251 7.0925C9.17051 6.3045 10.453 6.3045 11.241 7.0925C12.0285 7.88 12.0285 9.1625 11.241 9.9505L8.33301 12.8585L5.42501 9.95C4.63701 9.162 4.63701 7.88 5.42501 7.092ZM10.5345 7.799C10.136 7.401 9.48851 7.401 9.09001 7.799L8.33301 8.556L7.57601 7.7995C7.37701 7.6005 7.11551 7.501 6.85401 7.501C6.59251 7.501 6.33101 7.6005 6.13201 7.7995C5.73401 8.1975 5.73401 8.845 6.13201 9.2435L8.33301 11.4445L10.5345 9.243C10.9325 8.845 10.9325 8.197 10.5345 7.799Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M5.65601 2.7305L8.33301 0.5L14.333 5.5V16H2.33301V1H5.22351L5.65601 2.7305ZM4.44251 2H3.33301V4.6665L4.80301 3.4415L4.44251 2ZM3.33301 5.9685V15H13.333V5.9685L8.33301 1.802L3.33301 5.9685Z" fill="#2A2859"/>
        </svg>
        <text 
          x="598"
          y="147"
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
          y="178"
          width="183"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Coins/money icon in fourth box */}
        <svg x="573" y="185" width="17" height="16" viewBox="0 0 17 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M9.16699 2.25C9.16699 0.9885 10.814 0 12.917 0C15.02 0 16.667 0.9885 16.667 2.25V11C16.667 12.2615 15.02 13.25 12.917 13.25C10.814 13.25 9.16699 12.2615 9.16699 11V2.25ZM12.917 12.25C14.4905 12.25 15.667 11.59 15.667 11V10.791C14.987 11.2285 14.016 11.5 12.917 11.5C11.818 11.5 10.847 11.2285 10.167 10.791V11C10.167 11.59 11.3435 12.25 12.917 12.25ZM12.917 10.5C14.4905 10.5 15.667 9.84 15.667 9.25V9.041C14.987 9.4785 14.016 9.75 12.917 9.75C11.818 9.75 10.847 9.4785 10.167 9.041V9.25C10.167 9.84 11.3435 10.5 12.917 10.5ZM12.917 8.75C14.4905 8.75 15.667 8.09 15.667 7.5V7.291C14.987 7.7285 14.016 8 12.917 8C11.818 8 10.847 7.7285 10.167 7.291V7.5C10.167 8.09 11.3435 8.75 12.917 8.75ZM12.917 7C14.4905 7 15.667 6.34 15.667 5.75V5.541C14.987 5.9785 14.016 6.25 12.917 6.25C11.818 6.25 10.847 5.9785 10.167 5.541V5.75C10.167 6.34 11.3435 7 12.917 7ZM12.917 5.25C14.4905 5.25 15.667 4.59 15.667 4V3.791C14.987 4.2285 14.016 4.5 12.917 4.5C11.818 4.5 10.847 4.2285 10.167 3.791V4C10.167 4.59 11.3435 5.25 12.917 5.25ZM10.167 2.25C10.167 2.84 11.3435 3.5 12.917 3.5C14.4905 3.5 15.667 2.84 15.667 2.25C15.667 1.66 14.4905 1 12.917 1C11.3435 1 10.167 1.66 10.167 2.25Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M0.666992 8.5C0.666992 7.2385 2.31399 6.25 4.41699 6.25C6.51999 6.25 8.16699 7.2385 8.16699 8.5V13.75C8.16699 15.0115 6.51999 16 4.41699 16C2.31399 16 0.666992 15.0115 0.666992 13.75V8.5ZM4.41699 15C5.99099 15 7.16699 14.34 7.16699 13.75V13.541C6.48699 13.9785 5.51549 14.25 4.41699 14.25C3.31849 14.25 2.34699 13.9785 1.66699 13.541V13.75C1.66699 14.34 2.84299 15 4.41699 15ZM4.41699 13.25C5.99099 13.25 7.16699 12.59 7.16699 12V11.791C6.48699 12.2285 5.51549 12.5 4.41699 12.5C3.31849 12.5 2.34699 12.2285 1.66699 11.791V12C1.66699 12.59 2.84299 13.25 4.41699 13.25ZM4.41699 11.5C5.99099 11.5 7.16699 10.84 7.16699 10.25V10.041C6.48699 10.4785 5.51549 10.75 4.41699 10.75C3.31849 10.75 2.34699 10.4785 1.66699 10.041V10.25C1.66699 10.84 2.84299 11.5 4.41699 11.5ZM1.66699 8.5C1.66699 9.09 2.84299 9.75 4.41699 9.75C5.99099 9.75 7.16699 9.09 7.16699 8.5C7.16699 7.91 5.99099 7.25 4.41699 7.25C2.84299 7.25 1.66699 7.91 1.66699 8.5Z" fill="#2A2859"/>
        </svg>
        <text 
          x="597"
          y="193"
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
        
        {/* Dark green box below the list */}
        <rect
          x="565"
          y="240"
          width="211"
          height="124"
          fill="#034B45"
        />
        
        {/* Årlig strømbesparelse text */}
        <text
          x="589"
          y="264"
          width="149"
          height="24"
          fontFamily="Oslo Sans"
          fill="#FFFFFF"
          dominantBaseline="hanging"
        >
          Årlig strømbesparelse
        </text>
        
        {/* Window upgrade savings text */}
        <text
          x="589"
          y="296"
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
        
        <text
          x="589"
          y="318"
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
          y="450"
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
        <a href="https://www.riksantikvaren.no/veileder/rad-om-varmepumper-i-fredede-og-verneverdige-bygninger/" target="_blank" rel="noopener noreferrer">
          <text
            x="170"
            y="480"
            fontFamily="Oslo Sans"
            fontWeight="300"
            fontStyle="normal"
            fontSize="14"
            lineHeight="22"
            fill="#FFFFFF"
            textAnchor="middle"
            textDecoration="underline"
            style={{ cursor: 'pointer' }}
          >
            Riksantikvaren
          </text>
        </a>
        <a href="https://www.sintef.no/ekspertise/sintef-energi/varmepumpeteknologi/" target="_blank" rel="noopener noreferrer">
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
          >
            Sintef
          </text>
        </a>
        <a href="https://www.enova.no/nb/privat/bolig/stottetilbud-bolig/vaeske-til-vann-varmepumpe" target="_blank" rel="noopener noreferrer">
          <text
            x="170"
            y="524"
            fontFamily="Oslo Sans"
            fontWeight="300"
            fontStyle="normal"
            fontSize="14"
            lineHeight="22"
            fill="#FFFFFF"
            textAnchor="middle"
            textDecoration="underline"
            style={{ cursor: 'pointer' }}
          >
            Enova
          </text>
        </a>
        <a href="https://www.enova.no/nb/privat/bolig/stottetilbud-bolig/varmepumpebereder" target="_blank" rel="noopener noreferrer">
          <text
            x="170"
            y="546"
            fontFamily="Oslo Sans"
            fontWeight="300"
            fontStyle="normal"
            fontSize="14"
            lineHeight="22"
            fill="#FFFFFF"
            textAnchor="middle"
            textDecoration="underline"
            style={{ cursor: 'pointer' }}
          >
            Enova
          </text>
        </a>
        
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
          y="0"
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
                Varmepumpe kan være søknadspliktig hvis den endrer fasadens karakter. Om det endrer fasadens karakter eller ikke vurderes fra sak til sak, og er strengere for verneverdige bygg. Større installasjoner regnes ofte som byggteknisk installasjon, som også er søknadspliktig. Du kan selv bestille gratis rådgivning med Byantikvaren i forkant for tips. Plan- og bygningsetaten gir også veiledning om søknadsplikt og eventuelt om du må kontakte en fagperson (arkitekt, byggmester eller entreprenør) til å hjelpe deg.
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
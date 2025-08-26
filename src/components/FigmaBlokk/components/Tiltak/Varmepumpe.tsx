import React, { useState, useEffect } from 'react';

interface VarmepumpeProps {
  onBack?: () => void;
  buildingType?: string;
  buildingData?: any;
}

export const Varmepumpe: React.FC<VarmepumpeProps> = ({ onBack, buildingType, buildingData }) => {
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
        const url = `http://localhost:3001/api/stotteordninger-live?gulliste=false&tiltak=varmepumpe&bygningstype=${mappedType}`;
        console.log('Fetching støtteordninger from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API response error:', response.status, errorText);
          throw new Error(`Failed to fetch støtteordninger: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Støtteordninger received for varmepumpe:', data);
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
          transform: isPermitOpen ? 'translateY(-461px)' : 'translateY(0)'
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
          width="101"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Generelt')}
          onMouseEnter={() => setHoveredButton('Generelt')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        <rect
          x="161"
          y="4"
          width="118"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Vedlikehold')}
          onMouseEnter={() => setHoveredButton('Vedlikehold')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        <rect
          x="279"
          y="4"
          width="136"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Oppgradering')}
          onMouseEnter={() => setHoveredButton('Oppgradering')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        <rect
          x="415"
          y="4"
          width="105"
          height="49"
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Utskiftning')}
          onMouseEnter={() => setHoveredButton('Utskiftning')}
          onMouseLeave={() => setHoveredButton(null)}
        />
        
        {/* Text inside button boxes */}
        <text
          x="76"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Generelt' ? "#000000" : hoveredButton === 'Generelt' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Generelt')}
          onMouseEnter={() => setHoveredButton('Generelt')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Generelt
        </text>
        
        <text
          x="177"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Vedlikehold' ? "#000000" : hoveredButton === 'Vedlikehold' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Vedlikehold')}
          onMouseEnter={() => setHoveredButton('Vedlikehold')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Vedlikehold
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
          fill={activeButton === 'Oppgradering' ? "#000000" : hoveredButton === 'Oppgradering' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Oppgradering')}
          onMouseEnter={() => setHoveredButton('Oppgradering')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Oppgradering
        </text>
        
        <text
          x="431"
          y="28.5"
          fontFamily="Oslo Sans"
          fontWeight="400"
          fontStyle="normal"
          fontSize="16"
          lineHeight="24"
          letterSpacing="-0.2"
          fill={activeButton === 'Utskiftning' ? "#000000" : hoveredButton === 'Utskiftning' ? "#1F42AA" : "#666666"}
          dominantBaseline="middle"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveButton('Utskiftning')}
          onMouseEnter={() => setHoveredButton('Utskiftning')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          Utskiftning
        </text>
        
        {/* Button underlines - active and hover */}
        <rect
          x="60"
          y="49"
          width="101"
          height="4"
          fill={activeButton === 'Generelt' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Generelt' ? 1 : hoveredButton === 'Generelt' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Generelt' || hoveredButton === 'Generelt' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        <rect
          x="161"
          y="49"
          width="118"
          height="4"
          fill={activeButton === 'Vedlikehold' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Vedlikehold' ? 1 : hoveredButton === 'Vedlikehold' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Vedlikehold' || hoveredButton === 'Vedlikehold' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        <rect
          x="279"
          y="49"
          width="136"
          height="4"
          fill={activeButton === 'Oppgradering' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Oppgradering' ? 1 : hoveredButton === 'Oppgradering' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Oppgradering' || hoveredButton === 'Oppgradering' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        <rect
          x="415"
          y="49"
          width="105"
          height="4"
          fill={activeButton === 'Utskiftning' ? "#6FE9FF" : "#1F42AA"}
          opacity={activeButton === 'Utskiftning' ? 1 : hoveredButton === 'Utskiftning' ? 1 : 0}
          style={{ transition: `opacity ${activeButton === 'Utskiftning' || hoveredButton === 'Utskiftning' ? '0.3s' : '0.1s'} ease-in-out` }}
        />
        
        {/* Horizontal line above content */}
        <rect
          x="60"
          y="53"
          width="464"
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
              <p style={{ marginTop: 0, marginBottom: 0 }}>
                Vinduer har mye å si for både komfort og energibruk i boligen. Så mye som 40 % av varmetapet kan komme herfra. Dette betyr stort potensial for å spare strøm og få et bedre inneklima. Godt isolerte vinduer og dører kan halvere varmetapet sammenlignet med vanlige vinduer og dører. Det finnes det flere måter å forbedre dem på, og det er lurt å starte med de enkleste løsningene først, før du vurderer større arbeider.
              </p>
            </div>
          </foreignObject>
        )}
        
        {activeButton === 'Vedlikehold' && (
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
              {buildingType && buildingType.toLowerCase() === 'enebolig' ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Vinduer i tre kan forbedres med enkle grep som maling, kitting, justering og tetting. Dette gir bedre komfort og forlenger levetiden.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Har du nyere vinduer i plast eller metall, er det viktig å holde dem rene, smøre beslag og sjekke at tetningslistene er myke og tette. Enkle vedlikeholdsoppgaver kan redusere varmetap og utsette behovet for utskifting.
                  </p>
                </>
              ) : buildingType && (buildingType.toLowerCase() === 'rekkehus' || buildingType.toLowerCase() === 'tomannsbolig') ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Vinduer i tre kan forbedres med enkle grep som maling, kitting, justering og tetting. Dette gir bedre komfort og forlenger levetiden.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Har du nyere vinduer i plast eller metall, er det viktig å holde dem rene, smøre beslag og sjekke at tetningslistene er myke og tette. Enkle vedlikeholdsoppgaver kan redusere varmetap og utsette behovet for utskifting.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    I mange eldre flermannsboliger er vinduene laget av solid treverk og passer godt til bygningens stil. Ofte kan de repareres og brukes videre i mange år. Typiske oppgaver er å fjerne maling og kitt, skifte ut deler som har fått råte, justere hengsler og legge på tetningslister.
                  </p>
                  <p style={{ marginBottom: '16px' }}>
                    Har du nyere vinduer i plast eller metall, er det viktig å holde dem rene, smøre beslag og sjekke at tetningslistene er myke og tette.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Ved å holde vinduene i god stand, reduserer du varmetap og bevarer utseendet på huset.
                  </p>
                </>
              )}
            </div>
          </foreignObject>
        )}
        
        {activeButton === 'Oppgradering' && (
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
              {buildingType && buildingType.toLowerCase() === 'enebolig' ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Om vindusrammen er i god nok stand, og tåler økt vekt fra glasset, kan du bytte ut det gamle glasset med et som isolerer bedre.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    En annen vanlig og effektiv måte å oppgradere vinduet på er å sette inn et varevindu. Det er et vindu som monteres på innsiden av det eksisterende. Det gir bedre isolasjon, reduserer trekk og bevarer vinduets utseende.
                  </p>
                </>
              ) : buildingType && (buildingType.toLowerCase() === 'rekkehus' || buildingType.toLowerCase() === 'tomannsbolig') ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Om vindusrammen er i god nok stand, og tåler økt vekt fra glasset, kan du bytte ut det gamle glasset med et som isolerer bedre.
                  </p>
                  <p style={{ marginBottom: '16px' }}>
                    En annen vanlig og effektiv måte å oppgradere vinduet på er å sette inn et varevindu. Det er et vindu som monteres på innsiden av det eksisterende. Det gir bedre isolasjon, reduserer trekk og bevarer vinduets utseende.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Hvis flere boliger i rekken har like vinduer, kan det være smart å samarbeide for å bevare helheten og oppnå bedre pris.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Om vindusrammen er i god nok stand, og tåler økt vekt fra glasset, kan du bytte ut det gamle glasset med et som isolerer bedre.
                  </p>
                  <p style={{ marginBottom: '16px' }}>
                    En annen vanlig og effektiv måte å oppgradere vinduet på er å sette inn et varevindu. Det er et vindu som monteres på innsiden av det eksisterende. Det gir bedre isolasjon, reduserer trekk og bevarer vinduets utseende.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Det er lurt å samarbeide med naboen for å finne de beste tekniske og visuelle løsningene.
                  </p>
                </>
              )}
            </div>
          </foreignObject>
        )}
        
        {activeButton === 'Utskiftning' && (
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
              {buildingType && buildingType.toLowerCase() === 'enebolig' ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Dersom vinduene er dårlige og ikke lar seg reparere, vil det ofte lønne seg å bytte dem ut. Nye vinduer med god isolasjon kan gi lavere strømforbruk og bedre inneklima – spesielt i kombinasjon med god tetting rundt vindusåpningen.
                  </p>
                  <p style={{ marginBottom: 0, position: 'relative' }}>
                    Velg vinduer med lav <span 
                      style={{ 
                        textDecoration: 'underline', 
                        textDecorationStyle: 'dotted', 
                        textUnderlineOffset: '4px',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onMouseEnter={() => setHoveredWord('U-verdi')}
                      onMouseLeave={() => setHoveredWord(null)}
                    >
                      U-verdi
                      {hoveredWord === 'U-verdi' && (
                        <div 
                          onMouseEnter={() => setHoveredWord('U-verdi')}
                          onMouseLeave={() => setHoveredWord(null)}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            width: '280px',
                            backgroundColor: '#D1F9FF',
                            padding: '12px',
                            marginTop: '0',
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
                            U-verdien sier hvor godt vinduet isolerer. Jo lavere tall, jo mindre varme slipper ut – og jo bedre er vinduet for energibruken. Les mer om U-verdi <a 
                              href="https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/14/14-2" 
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
                    </span>. Et trelags vindu isolerer betydelig bedre mot kulde enn et tolags vindu. Derfor er det særlig mye å energi å spare i det nordiske klimaet.
                  </p>
                </>
              ) : buildingType && (buildingType.toLowerCase() === 'rekkehus' || buildingType.toLowerCase() === 'tomannsbolig') ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Dersom vinduene er dårlige og ikke lar seg reparere, vil det ofte lønne seg å bytte dem ut. Nye vinduer med god isolasjon kan gi lavere strømforbruk og bedre inneklima – spesielt i kombinasjon med god tetting rundt vindusåpningen.
                  </p>
                  <p style={{ marginBottom: '16px', position: 'relative' }}>
                    Velg vinduer med lav <span 
                      style={{ 
                        textDecoration: 'underline', 
                        textDecorationStyle: 'dotted', 
                        textUnderlineOffset: '4px',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onMouseEnter={() => setHoveredWord('U-verdi')}
                      onMouseLeave={() => setHoveredWord(null)}
                    >
                      U-verdi
                      {hoveredWord === 'U-verdi' && (
                        <div 
                          onMouseEnter={() => setHoveredWord('U-verdi')}
                          onMouseLeave={() => setHoveredWord(null)}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            width: '280px',
                            backgroundColor: '#D1F9FF',
                            padding: '12px',
                            marginTop: '0',
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
                            U-verdien sier hvor godt vinduet isolerer. Jo lavere tall, jo mindre varme slipper ut – og jo bedre er vinduet for energibruken. Les mer om U-verdi <a 
                              href="https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/14/14-2" 
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
                    </span>. Et trelags vindu isolerer betydelig bedre mot kulde enn et tolags vindu. Derfor er det særlig mye å energi å spare i det nordiske klimaet.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Hvis flere boliger i rekken har like vinduer, kan det være smart å samarbeide for å bevare helheten og oppnå bedre pris.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0, marginBottom: '16px' }}>
                    Dersom vinduene er dårlige og ikke lar seg reparere, vil det ofte lønne seg å bytte dem ut. Nye vinduer med god isolasjon kan gi lavere strømforbruk og bedre inneklima – spesielt i kombinasjon med god tetting rundt vindusåpningen.
                  </p>
                  <p style={{ marginBottom: '16px', position: 'relative' }}>
                    Velg vinduer med lav <span 
                      style={{ 
                        textDecoration: 'underline', 
                        textDecorationStyle: 'dotted', 
                        textUnderlineOffset: '4px',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onMouseEnter={() => setHoveredWord('U-verdi')}
                      onMouseLeave={() => setHoveredWord(null)}
                    >
                      U-verdi
                      {hoveredWord === 'U-verdi' && (
                        <div 
                          onMouseEnter={() => setHoveredWord('U-verdi')}
                          onMouseLeave={() => setHoveredWord(null)}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            width: '280px',
                            backgroundColor: '#D1F9FF',
                            padding: '12px',
                            marginTop: '0',
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
                            U-verdien sier hvor godt vinduet isolerer. Jo lavere tall, jo mindre varme slipper ut – og jo bedre er vinduet for energibruken. Les mer om U-verdi <a 
                              href="https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/14/14-2" 
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
                    </span>. Et trelags vindu isolerer betydelig bedre mot kulde enn et tolags vindu. Derfor er det særlig mye å energi å spare i det nordiske klimaet.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    Det er lurt å samarbeide med naboen for å finne de beste tekniske og visuelle løsningene.
                  </p>
                </>
              )}
            </div>
          </foreignObject>
        )}
        
        {/* Blue rectangles */}
        <rect
          x="565"
          y="40"
          width="119"
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
          Mindre støy
        </text>
        <rect
          x="565"
          y="86"
          width="148"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* House with heart icon in second box */}
        <svg x="573" y="93" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M5.092 7.092C5.8795 6.3035 7.1615 6.304 7.95 7.092L7.9995 7.1425L8.0495 7.0925C8.8375 6.3045 10.12 6.3045 10.908 7.0925C11.6955 7.88 11.6955 9.1625 10.908 9.9505L8 12.8585L5.092 9.95C4.304 9.162 4.304 7.88 5.092 7.092ZM10.2015 7.799C9.803 7.401 9.1555 7.401 8.757 7.799L8 8.556L7.243 7.7995C7.044 7.6005 6.7825 7.501 6.521 7.501C6.2595 7.501 5.998 7.6005 5.799 7.7995C5.401 8.1975 5.401 8.845 5.799 9.2435L8 11.4445L10.2015 9.243C10.5995 8.845 10.5995 8.197 10.2015 7.799Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M5.323 2.7305L8 0.5L14 5.5V16H2V1H4.8905L5.323 2.7305ZM4.1095 2H3V4.6665L4.47 3.4415L4.1095 2ZM3 5.9685V15H13V5.9685L8 1.802L3 5.9685Z" fill="#2A2859"/>
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
          Bedre inneklima
        </text>
        <rect
          x="565"
          y="132"
          width="186"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Snowflake icon in third box */}
        <svg x="573" y="139" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8.49023 3.23242L10.0698 1.71387L10.7529 2.375L8.49023 4.55762V7.18604L10.8765 5.86035L11.6987 2.90918L11.689 2.89062L12.6299 3.13428L12.0527 5.20703L14.5122 3.84229L15 4.65771L12.5381 6.02344L14.6978 6.59375L14.459 7.50293L11.3262 6.69629L8.98047 7.99951L11.3706 9.32666L14.4492 8.53418V8.50146L14.6978 9.40625L12.5391 9.97559L15 11.3423L14.5122 12.1577L12.0508 10.7905L12.6299 12.8843L11.689 13.1279L10.8525 10.1255L8.49023 8.81348V11.4458L10.7529 13.625L10.0698 14.2861L8.49023 12.7671V15.5H7.51465V12.7661L5.93018 14.2861L5.24268 13.625L7.51465 11.4404V8.81348L5.14062 10.1299L4.31104 13.1094L3.37012 12.8657L3.94385 10.7939L1.48779 12.1577L1 11.3423L3.47461 9.96875L1.30225 9.40625L1.55566 8.51562L4.65381 9.31396L7.02393 7.99951L4.67236 6.69482L1.55566 7.49854L1.30225 6.59375L3.46094 6.02295L1 4.65771L1.48779 3.84229L3.94141 5.20312L3.36523 3.13428L4.30615 2.89062H4.31104L5.13623 5.86621L7.51465 7.18604V4.55908L5.24268 2.375L5.93018 1.71387L7.51465 3.2334V0.5H8.49023V3.23242Z" fill="#2A2859"/>
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
          Mindre trekk og kulde
        </text>
        <rect
          x="565"
          y="178"
          width="197"
          height="30"
          fill="#C7F6C9"
        />
        
        {/* Chart/graph icon in fourth box */}
        <svg x="573" y="185" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14.9333 3.73333V0H11.2V1.06667H13.1176L8.73813 5.44533L4.13595 0.77914L1.15888 3.75621L1.91312 4.51046L4.13067 2.2928L8.73339 6.95953L13.8667 1.82625V3.73333H14.9333Z" fill="#2A2859"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M4.944 6.4H1.12V14.9333H0V16H16V14.9333H14.8747V6.93333H11.0507V14.9333H9.90933V9.06667H6.08533V14.9333H4.944V6.4ZM12.1173 14.9333H13.808V8H12.1173V14.9333ZM8.84267 10.1333V14.9333H7.152V10.1333H8.84267ZM3.87733 14.9333V7.46667H2.18667V14.9333H3.87733Z" fill="#2A2859"/>
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
          Boligen kan stige i verdi
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
        
        {/* Links below "Les mer" */}
        <a href="https://www.sintef.no/ekspertise/sintef-energi/varmepumpeteknologi/" target="_blank" rel="noopener noreferrer">
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
            Sintef
          </text>
        </a>
        <a href="https://www.enova.no/nb/privat/bolig/stottetilbud-bolig/vaeske-til-vann-varmepumpe" target="_blank" rel="noopener noreferrer">
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
            Enova
          </text>
        </a>
        <a href="https://www.enova.no/nb/privat/bolig/stottetilbud-bolig/varmepumpebereder" target="_blank" rel="noopener noreferrer">
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
                Varmepumpe kan være søknadspliktig hvis den endrer fasadens karakter. Om det endrer fasadens karakter eller ikke vurderes fra sak til sak. Større installasjoner regnes ofte som byggteknisk installasjon, som også er søknadspliktig. Plan- og bygningsetaten gir veiledning om søknadsplikt og eventuelt om du må kontakte en fagperson (arkitekt, byggmester eller entreprenør) til å hjelpe deg.
              </p>
              
              {/* Links section */}
              <div style={{ marginTop: '16px' }}>
                <a 
                  href="#"
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
                  Sjekk nærmere om tiltaket ditt er søknadsplikt her
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', flexShrink: 0 }}>
                    <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#2A2859"/>
                  </svg>
                </a>
                
                <a 
                  href="#"
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
                  Gratis veiledningstime hos Plan- og bygningsetaten for generell informasjon om søknadsplikt her
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginLeft: '8px', flexShrink: 0 }}>
                    <path d="M12.9546 11.8742V13.033H5.0459V5.16359H6.20465V4.03859H5.0459V4.03297H3.9209V14.158H14.0796V11.8742H12.9546Z" fill="#2A2859"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.1253 4.02734V5.15234H12.1615L8.07777 9.24734L8.85402 10.0292L12.9434 5.92859V7.97047H14.0796V4.02734H10.1253Z" fill="#2A2859"/>
                  </svg>
                </a>
                
                <a 
                  href="#"
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
                  Kontakt Plan- og bygningsetaten for en konkret vurdering av søknadsplikt for ditt tiltak, mot gebyr, her
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
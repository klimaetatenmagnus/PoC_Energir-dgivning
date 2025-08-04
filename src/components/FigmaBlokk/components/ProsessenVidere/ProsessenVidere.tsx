import React from 'react';
import { Document, Blokk, PersonPresentingGraph, PersonPresentingQuestion, Shovel, Trees, Pil } from './Ikoner';
import { CircleWithHover } from './CircleWithHover';

interface ProsessenVidereProps {
  showProcess: boolean;
  scaleFactor: number;
  onBack: () => void;
}

export const ProsessenVidere: React.FC<ProsessenVidereProps> = ({ 
  showProcess, 
  scaleFactor, 
  onBack 
}) => {
  const [isCircle1Hovered, setIsCircle1Hovered] = React.useState(false);
  const [isCircle2Hovered, setIsCircle2Hovered] = React.useState(false);
  const [isCircle3Hovered, setIsCircle3Hovered] = React.useState(false);
  const [isCircle4Hovered, setIsCircle4Hovered] = React.useState(false);
  const [isCircle5Hovered, setIsCircle5Hovered] = React.useState(false);
  const [isCircle6Hovered, setIsCircle6Hovered] = React.useState(false);
  
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: showProcess 
        ? `translate(-50%, -50%) scale(${scaleFactor})`
        : `translate(-50%, calc(-50% + 100vh)) scale(${scaleFactor})`,
      transformOrigin: 'center',
      width: '1728px',
      height: '900px',
      zIndex: 10000,
      transition: 'transform 0.8s ease-in-out'
    }}>
      <div 
        style={{
          position: 'absolute',
          width: '100%',
          height: '85px',
          top: '30px',
          left: 0,
          pointerEvents: 'auto'
        }}
      >
        <div style={{
          position: 'absolute',
          left: 'calc(50% - 235.5px - 74px - 336px)',
          right: '40px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}>
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
      
      
      {/* All circles positioned vertically, centered horizontally - 15px from bottom */}
      <div style={{
        position: 'absolute',
        bottom: '15px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '214px',
        alignItems: 'center',
        pointerEvents: 'auto'
      }}>
        {/* First row of circles (bottom row) */}
        <div style={{
          display: 'flex',
          gap: '250px',
          alignItems: 'center'
        }}>
          {/* Left circle with PersonPresentingQuestion icon */}
          <CircleWithHover
            number={4}
            text="Sjekk om tiltaket er søknadspliktig"
            hoverText="For noen arbeider må du søke om byggetillatelse fra Plan- og bygningsetaten som skal sikre kvalitet og riktig gjennomføring. Du finner informasjon om søknadsplikt, og om du trenger en fagperson til å søke for deg, når du trykker på tiltaket du vurderer."
            icon={<PersonPresentingQuestion />}
            iconStyle={{
              bottom: '141px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
            growFullCircle={true}
            onHoverChange={setIsCircle4Hovered}
          />
          
          {/* Center circle with Document icon */}
          <div style={{
            width: isCircle5Hovered ? '400px' : '230px',
            height: isCircle5Hovered ? '400px' : '230px',
            position: 'relative',
            transition: 'all 0.3s ease'
          }}>
            {/* Document icon - positioned relative to circle */}
            <div style={{
              position: 'absolute',
              bottom: '124px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1,
              pointerEvents: 'none'
            }}>
              <Document />
            </div>
            <CircleWithHover
              number={5}
              text="Undersøk støtteordninger"
              hoverText="Det finnes støtteordninger for flere energitiltak - fra Oslo kommune og Enova. Aktuelle støtteordninger er nevnt under informasjonen for hvert tiltak. Sjekk mulighetene tidlig i planleggingen, så du vet hva som kan være aktuelt for din bolig."
              growFullCircle={true}
              onHoverChange={setIsCircle5Hovered}
            />
          </div>
          
          {/* Right circle with Shovel icon */}
          <CircleWithHover
            number={6}
            text="Gjennomfør arbeidene"
            hoverText="Når du først setter i gang, bør det gjøres skikkelig. Velg løsninger som varer og gir lavere energibehov. Husk å følge opp i etterkant – godt vedlikehold sikrer at forbedringene holder seg over tid. Da kan du nyte bedre inneklima og lavere strømregninger."
            icon={<Shovel />}
            iconStyle={{
              bottom: '174.5px',
              left: '53px'
            }}
            growFullCircle={true}
            onHoverChange={setIsCircle6Hovered}
          />
        </div>
        
        {/* Second row of circles (top row) - 214px above the first */}
        <div style={{
          display: 'flex',
          gap: '250px',
          alignItems: 'center'
        }}>
          {/* Left circle with Trees icon */}
          <CircleWithHover
            number={1}
            text="Bruk det du har, oppgrader når det trengs"
            hoverText="Det mest miljøvennlige er å bruke det du allerede har, så lenge det fungerer. Nye materialer, som vinduer og isolasjon, gir også klimagassutslipp når de produseres og fraktes. Men om du først skal oppgradere er det viktig å utføre arbeidene på riktig måte - med løsninger som varer, sparer energi og tar hensyn til byggets kulturhistoriske verdier."
            icon={<Trees />}
            iconStyle={{
              bottom: '192.5px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
            growFullCircle={true}
            onHoverChange={setIsCircle1Hovered}
          />
          
          {/* Center circle with Blokk icon */}
          <CircleWithHover
            number={2}
            text="Skaff deg oversikt over boligen"
            hoverText={
              <>
                Sjekk hva som er gjort i boligen din fra før. Er det etterisolert tidligere? Hvor gamle er vinduene? Finn frem tilstandsrapport, energimerke eller{' '}
                <a 
                  href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/trenger-du-veiledning/#toc-3" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    color: '#0066CC',
                    textDecoration: 'underline'
                  }}
                >
                  gamle tegninger fra Plan- og bygningsetaten
                </a>
                . Er du usikker, eller vurderer større endringer, kan det være lurt å kontakte en fagperson, som en energirådgiver, byggmester eller arkitekt. De hjelper deg med vurderinger, byggesøknad og gjennomføring.
              </>
            }
            icon={<Blokk />}
            iconStyle={{
              bottom: '180px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
            growFullCircle={true}
            onHoverChange={setIsCircle2Hovered}
            extraLarge={true}
          />
          
          {/* Right circle with PersonPresentingGraph icon */}
          <CircleWithHover
            number={3}
            text="Planlegg helhetlig"
            hoverText="Flere tiltak virker sammen. Hvis du tetter, bør du også tenke på ventilasjon. Vinduer isolerer dårlig hvis veggene lekker varme. Se boligen som en helhet før du velger hva du eventuelt gjør."
            icon={<PersonPresentingGraph />}
            iconStyle={{
              bottom: '82px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
            growFullCircle={true}
            onHoverChange={setIsCircle3Hovered}
          />
        </div>
      </div>
      
      {/* Additional content for "Prosessen videre" can be added here later */}
      {/* For example: information cards, next steps, etc. */}
    </div>
  );
};
/**
 * MobileProsessenVidere
 * Fullskjerm swipe-karusell for "Veien videre" (7 prosess-steg) på mobil.
 *
 * Gjenbruker swipe-mønster fra MobileDistrictComparison:
 * - Touch-basert sveip med 50px terskel
 * - Slide-animasjoner (300ms, translateX)
 * - Chevron-navigasjon og dot-indikatorer
 * - Swipe-hint på første kort
 */

import React, { useState, useRef } from 'react';
import { PktButton, PktIcon } from '@oslokommune/punkt-react';
import {
  Trees,
  Blokk,
  PersonPresentingGraph,
  PersonPresentingQuestion,
  Document,
  Shovel,
  FlowerPinwheel,
} from '../../FigmaBlokk/components/ProsessenVidere/Ikoner';
import './MobileProsessenVidere.css';

interface MobileProsessenVidereProps {
  isOpen: boolean;
  onClose: () => void;
  isGulliste?: boolean;
}

interface StepConfig {
  number: number;
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
}

export const MobileProsessenVidere: React.FC<MobileProsessenVidereProps> = ({
  isOpen,
  onClose,
  isGulliste = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const step2Description = (
    <>
      Sjekk hva som er gjort i boligen tidligere fra tilstandsrapport, energimerke eller{' '}
      <a
        href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/trenger-du-veiledning/#toc-3"
        target="_blank"
        rel="noopener noreferrer"
      >
        gamle tegninger fra Plan- og bygningsetaten
      </a>
      . Er du usikker, eller vurderer større endringer, kontakt en fagperson som en energirådgiver,
      byggmester eller arkitekt for hjelp med vurderinger, byggesøknad og gjennomføring.
      {isGulliste && (
        <span style={{ display: 'block', marginTop: '10px' }}>
          Byantikvaren gir også gratis veiledning i arbeider på verneverdige bygg.
        </span>
      )}
    </>
  );

  const STEPS: StepConfig[] = [
    {
      number: 1,
      title: 'Bruk det du har, oppgrader når det trengs',
      description:
        'Det mest miljøvennlige er å bruke det du allerede har, så lenge det fungerer. Nye materialer, som vinduer og isolasjon, gir også klimagassutslipp når de produseres og fraktes. Men om du først skal oppgradere er det viktig å utføre arbeidene på riktig måte - med løsninger som varer, sparer energi og tar hensyn til byggets kulturhistoriske verdier.',
      icon: <Trees />,
    },
    {
      number: 2,
      title: 'Skaff deg oversikt over boligen',
      description: step2Description,
      icon: <Blokk />,
    },
    {
      number: 3,
      title: 'Planlegg helhetlig',
      description:
        'Flere tiltak virker sammen. Hvis du tetter, bør du også tenke på ventilasjon. Vinduer isolerer dårlig hvis veggene lekker varme. Se boligen som en helhet før du velger hva du eventuelt gjør.',
      icon: <PersonPresentingGraph />,
    },
    {
      number: 4,
      title: 'Sjekk om tiltaket er søknadspliktig',
      description:
        'For noen arbeider må du søke om byggetillatelse fra Plan- og bygningsetaten som skal sikre kvalitet og riktig gjennomføring. Du finner informasjon om søknadsplikt, og om du trenger en fagperson til å søke for deg, når du trykker på tiltaket du vurderer.',
      icon: <PersonPresentingQuestion />,
    },
    {
      number: 5,
      title: 'Undersøk støtteordninger',
      description: (
        <>
          Det finnes støtteordninger for flere energitiltak - fra både Oslo kommune og Enova. Aktuelle støtteordninger er nevnt under informasjonen for hvert tiltak. Sjekk mulighetene tidlig i planleggingen, så du vet hva som kan være aktuelt for din bolig.
          <span style={{ display: 'block', marginTop: '10px' }}>
            Se hva du kan få støtte til på{' '}
            <a href="https://klimatilskudd.no" target="_blank" rel="noopener noreferrer">klimatilskudd.no</a>.
          </span>
        </>
      ),
      icon: <Document />,
    },
    {
      number: 6,
      title: 'Gjennomfør arbeidene',
      description:
        'Når du først setter i gang, bør det gjøres skikkelig. Velg løsninger som varer og gir lavere energibehov. Husk å følge opp i etterkant – godt vedlikehold sikrer at forbedringene holder seg over tid. Da kan du nyte bedre inneklima og lavere strømregninger.',
      icon: <Shovel />,
    },
    {
      number: 7,
      title: 'Få flere energisparetips',
      description: (
        <>
          Vil du lære mer om hvordan du kan spare energi i hverdagen? Oslo kommune har samlet gode råd og tips for deg som vil redusere energiforbruket.
          <span style={{ display: 'block', marginTop: '10px' }}>
            Les mer på{' '}
            <a href="https://klimaoslo.no/sparstrom" target="_blank" rel="noopener noreferrer">klimaoslo.no/sparstrøm</a>.
          </span>
        </>
      ),
      icon: <FlowerPinwheel />,
    },
  ];

  const goToCard = (newIndex: number) => {
    if (isAnimating || newIndex === activeIndex) return;
    if (newIndex < 0 || newIndex >= STEPS.length) return;

    setSlideDirection(newIndex > activeIndex ? 'left' : 'right');
    setIncomingIndex(newIndex);
    setIsAnimating(true);

    setTimeout(() => {
      setActiveIndex(newIndex);
      setIncomingIndex(null);
      setIsAnimating(false);
      setSlideDirection(null);
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || isAnimating) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(diff) > 50) {
      if (diff < 0 && activeIndex < STEPS.length - 1) {
        goToCard(activeIndex + 1);
      } else if (diff > 0 && activeIndex > 0) {
        goToCard(activeIndex - 1);
      }
    }
    touchStartX.current = null;
  };

  const renderStep = (index: number) => {
    const step = STEPS[index];
    return (
      <div className="mobile-prosessen__step-content">
        <div className="mobile-prosessen__step-icon">
          {step.icon}
        </div>
        <div className="mobile-prosessen__step-badge">
          <span className="mobile-prosessen__step-number">{step.number}/{STEPS.length}</span>
        </div>
        <h3 className="mobile-prosessen__step-title pkt-txt-18-medium">
          {step.title}
        </h3>
        <p className="mobile-prosessen__step-description pkt-txt-14-light">
          {step.description}
        </p>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="mobile-prosessen-overlay" onClick={onClose}>
      <div
        className="mobile-prosessen-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header med kun lukk-knapp */}
        <div className="mobile-prosessen-header">
          <PktButton
            skin="tertiary"
            size="small"
            variant="icon-only"
            iconName="close"
            onClick={onClose}
            aria-label="Lukk"
          />
        </div>

        {/* Karusell med chevron-navigasjon */}
        <div className="mobile-prosessen-carousel">
          {activeIndex > 0 && (
            <button
              className="mobile-prosessen-chevron mobile-prosessen-chevron--left"
              onClick={() => goToCard(activeIndex - 1)}
              aria-label="Forrige steg"
            >
              <PktIcon name="chevron-thin-left" />
            </button>
          )}

          <div
            className={`mobile-prosessen-cards-container ${
              slideDirection ? `mobile-prosessen-cards--slide-${slideDirection}` : ''
            }`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className={`mobile-prosessen-card mobile-prosessen-card--outgoing ${
                slideDirection === 'left' ? 'mobile-prosessen-card--exit-left' : ''
              }${slideDirection === 'right' ? 'mobile-prosessen-card--exit-right' : ''}`}
            >
              {renderStep(activeIndex)}
            </div>

            {isAnimating && incomingIndex !== null && (
              <div
                className={`mobile-prosessen-card mobile-prosessen-card--incoming ${
                  slideDirection === 'left' ? 'mobile-prosessen-card--enter-left' : ''
                }${slideDirection === 'right' ? 'mobile-prosessen-card--enter-right' : ''}`}
              >
                {renderStep(incomingIndex)}
              </div>
            )}
          </div>

          {activeIndex < STEPS.length - 1 && (
            <button
              className="mobile-prosessen-chevron mobile-prosessen-chevron--right"
              onClick={() => goToCard(activeIndex + 1)}
              aria-label="Neste steg"
            >
              <PktIcon name="chevron-thin-right" />
            </button>
          )}

        </div>

        {/* Dot-indikatorer */}
        <div className="mobile-prosessen-nav">
          <div className="mobile-prosessen-dots">
            {STEPS.map((step, i) => (
              <button
                key={step.number}
                className={`mobile-prosessen-dot ${i === activeIndex ? 'mobile-prosessen-dot--active' : ''}`}
                onClick={() => goToCard(i)}
                aria-label={`Steg ${step.number}: ${step.title}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileProsessenVidere;

import React from 'react';
import { PktButton } from '@oslokommune/punkt-react';
import { Document, Blokk, PersonPresentingGraph, PersonPresentingQuestion, Shovel, Trees } from './Ikoner';
import { StepCard } from './StepCard';
import './ProsessenVidere.css';

interface ProsessenVidereProps {
  showProcess: boolean;
  scaleFactor: number;
  onBack: () => void;
  isGulliste?: boolean;
}

const steps = [
  {
    number: 1,
    text: 'Bruk det du har, oppgrader når det trengs',
    hoverText: 'Det mest miljøvennlige er å bruke det du allerede har, så lenge det fungerer. Nye materialer, som vinduer og isolasjon, gir også klimagassutslipp når de produseres og fraktes. Men om du først skal oppgradere er det viktig å utføre arbeidene på riktig måte - med løsninger som varer, sparer energi og tar hensyn til byggets kulturhistoriske verdier.',
    icon: <Trees />,
  },
  {
    number: 2,
    text: 'Skaff deg oversikt over boligen',
    hoverText: null, // handled specially for link + gulliste
    icon: <Blokk />,
  },
  {
    number: 3,
    text: 'Planlegg helhetlig',
    hoverText: 'Flere tiltak virker sammen. Hvis du tetter, bør du også tenke på ventilasjon. Vinduer isolerer dårlig hvis veggene lekker varme. Se boligen som en helhet før du velger hva du eventuelt gjør.',
    icon: <PersonPresentingGraph />,
  },
  {
    number: 4,
    text: 'Sjekk om tiltaket er søknadspliktig',
    hoverText: 'For noen arbeider må du søke om byggetillatelse fra Plan- og bygningsetaten som skal sikre kvalitet og riktig gjennomføring. Du finner informasjon om søknadsplikt, og om du trenger en fagperson til å søke for deg, når du trykker på tiltaket du vurderer.',
    icon: <PersonPresentingQuestion />,
  },
  {
    number: 5,
    text: 'Undersøk støtteordninger',
    hoverText: null, // handled specially for link
    icon: <Document />,
  },
  {
    number: 6,
    text: 'Gjennomfør arbeidene',
    hoverText: 'Når du først setter i gang, bør det gjøres skikkelig. Velg løsninger som varer og gir lavere energibehov. Husk å følge opp i etterkant – godt vedlikehold sikrer at forbedringene holder seg over tid. Da kan du nyte bedre inneklima og lavere strømregninger.',
    icon: <Shovel />,
  },
];

export const ProsessenVidere: React.FC<ProsessenVidereProps> = ({
  showProcess,
  isGulliste = false
}) => {
  // Build hover text for step 5 (contains a link)
  const step5HoverText = (
    <>
      Det finnes støtteordninger for flere energitiltak - fra både Oslo kommune og Enova. Aktuelle støtteordninger er nevnt under informasjonen for hvert tiltak. Sjekk mulighetene tidlig i planleggingen, så du vet hva som kan være aktuelt for din bolig.
      <span style={{ display: 'block', marginTop: '10px' }}>
        Se hva du kan få støtte til på{' '}
        <a href="https://klimatilskudd.no" target="_blank" rel="noopener noreferrer">klimatilskudd.no</a>.
      </span>
    </>
  );

  // Build hover text for step 2 (contains a link and conditional gulliste text)
  const step2HoverText = (
    <>
      Sjekk hva som er gjort i boligen tidligere fra tilstandsrapport, energimerke eller{' '}
      <a
        href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/trenger-du-veiledning/#toc-3"
        target="_blank"
        rel="noopener noreferrer"
      >
        gamle tegninger fra Plan- og bygningsetaten
      </a>
      . Er du usikker, eller vurderer større endringer, kontakt en fagperson som en energirådgiver, byggmester eller arkitekt for hjelp med vurderinger, byggesøknad og gjennomføring.
      {isGulliste && (
        <span style={{ display: 'block', marginTop: '10px' }}>
          Byantikvaren gir også gratis veiledning i arbeider på verneverdige bygg.
        </span>
      )}
    </>
  );

  return (
    <div
      className={`prosessen-videre ${showProcess ? 'prosessen-videre--visible' : 'prosessen-videre--hidden'}`}
      inert={!showProcess ? true : undefined}
    >
      <div className="prosessen-videre__scale-shell">
        <section className="prosessen-videre__grid pkt-grid pkt-grid--gap-size-24">
          {steps.map((step) => (
            <div key={step.number} className="pkt-cell pkt-cell--span12 pkt-cell--span4-tablet-up">
              <StepCard
                number={step.number}
                text={step.text}
                hoverText={step.number === 2 ? step2HoverText : step.number === 5 ? step5HoverText : step.hoverText}
                icon={step.icon}
              />
            </div>
          ))}
          <div className="pkt-cell pkt-cell--span12 prosessen-videre__cta-cell">
            <PktButton
              skin="primary"
              size="small"
              variant="label-only"
              onClick={() => window.open('https://klimaoslo.no/sparstrom/', '_blank', 'noopener,noreferrer')}
            >
              Få flere energitips på klimaoslo.no/sparstrøm!
            </PktButton>
          </div>
        </section>
      </div>
    </div>
  );
};

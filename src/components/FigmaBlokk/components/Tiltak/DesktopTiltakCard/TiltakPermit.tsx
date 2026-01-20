import React, { useState } from 'react';
import { PktIcon } from '@oslokommune/punkt-react';
import { renderParagraphWithGlossary, GlossaryTerm } from '../glossaryHelpers';
import { openExternalLink } from '../shared';
import type { TiltakPermitProps } from './types';

export const TiltakPermit: React.FC<TiltakPermitProps> = ({
  permitContent,
  glossary,
  hoveredTerm,
  setHoveredTerm
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!permitContent) {
    return null;
  }

  return (
    <section className="desktop-tiltak-card__permit">
      <button
        className="desktop-tiltak-card__permit-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="permit-content"
        type="button"
      >
        <span className="desktop-tiltak-card__permit-trigger-text">
          Sjekk om du må søke for å gjennomføre tiltaket
        </span>
        <PktIcon
          name="chevron-thin-down"
          className={`desktop-tiltak-card__permit-trigger-icon ${
            isOpen ? 'desktop-tiltak-card__permit-trigger-icon--open' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="desktop-tiltak-card__permit-content" id="permit-content">
          {permitContent.body.map((paragraph, index) => (
            <p key={`permit-${index}`}>
              {renderParagraphWithGlossary({
                paragraph,
                glossary,
                hoveredTerm,
                setHoveredTerm
              })}
            </p>
          ))}

          {permitContent.links?.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="desktop-tiltak-card__permit-link"
              onClick={(e) => {
                e.preventDefault();
                openExternalLink(link.url);
              }}
            >
              {link.label}
              <PktIcon name="external-link" className="pkt-icon--small" />
            </a>
          ))}

          <div className="desktop-tiltak-card__permit-highlight">
            <h3>Søknadsplikt er ikke en stopper, men en støtte</h3>
            <p>
              Er tiltaket ditt{' '}
              <GlossaryTerm
                term="søknadspliktig"
                glossary={glossary}
                hoveredTerm={hoveredTerm}
                setHoveredTerm={setHoveredTerm}
              >
                søknadspliktig
              </GlossaryTerm>{' '}
              betyr det at Plan- og bygningsetaten må godkjenne arbeidet. Dette sikrer at
              arbeidet utføres forsvarlig og i henhold til gjeldende forskrifter.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

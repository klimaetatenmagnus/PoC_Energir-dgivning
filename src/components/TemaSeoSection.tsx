import React from 'react';
import type { TemaConfig } from '../tema';

interface TemaSeoSectionProps {
  tema: TemaConfig;
  /** Følger landingssidens fade-animasjon ved overgang til tiltakssiden */
  opacity?: number;
}

/**
 * Tematisk innhold under adressesøket på annonse-landingssidene
 * (/solceller, /vinduer, /varmepumpe). Ligger i normal dokumentflyt etter den
 * fixed-posisjonerte landingssiden og skyver seg over den ved skrolling.
 * Innholdet speiler den prerendrede HTML-en i variantfilene (samme kilde: tema.ts).
 */
export const TemaSeoSection: React.FC<TemaSeoSectionProps> = ({ tema, opacity = 1 }) => (
  <section className="tema-seo" style={{ opacity }} aria-label={`Om ${tema.id}`}>
    <div className="tema-seo__inner">
      {tema.sections.map((section) => (
        <React.Fragment key={section.heading}>
          <h2 className="tema-seo__heading">{section.heading}</h2>
          <p className="tema-seo__text">{section.text}</p>
        </React.Fragment>
      ))}
    </div>
  </section>
);

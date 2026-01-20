import React from 'react';
import { useProviderColors, getOverskriftLabel, openExternalLink } from '../shared';
import type { TiltakGrantsProps } from './types';

export const TiltakGrants: React.FC<TiltakGrantsProps> = ({
  stotteordninger,
  isLoading = false
}) => {
  const getProviderColor = useProviderColors();

  if (isLoading) {
    return (
      <section className="desktop-tiltak-card__grants">
        <h2 className="desktop-tiltak-card__section-title">Relevante støtteordninger</h2>
        <p className="desktop-tiltak-card__grants-empty">Laster støtteordninger...</p>
      </section>
    );
  }

  if (!stotteordninger.length) {
    return (
      <section className="desktop-tiltak-card__grants">
        <h2 className="desktop-tiltak-card__section-title">Relevante støtteordninger</h2>
        <p className="desktop-tiltak-card__grants-empty">Ingen støtteordninger tilgjengelig.</p>
      </section>
    );
  }

  return (
    <section className="desktop-tiltak-card__grants">
      <h2 className="desktop-tiltak-card__section-title">Relevante støtteordninger</h2>
      <div className="desktop-tiltak-card__grants-table">
        {stotteordninger.map((ordning, index) => (
          <div key={`grant-${index}`} className="desktop-tiltak-card__grant-row">
            <span className="desktop-tiltak-card__grant-name">{ordning.ordning}</span>
            <span
              className="desktop-tiltak-card__grant-provider"
              style={{ backgroundColor: getProviderColor(ordning.overskrift) }}
            >
              {getOverskriftLabel(ordning.overskrift)}
            </span>
            {ordning.lenke && (
              <a
                href={ordning.lenke}
                target="_blank"
                rel="noopener noreferrer"
                className="desktop-tiltak-card__grant-link"
                onClick={(e) => {
                  e.preventDefault();
                  openExternalLink(ordning.lenke);
                }}
              >
                Lenke
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

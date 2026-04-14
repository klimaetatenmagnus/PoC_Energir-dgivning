import React, { useState } from 'react';
import { formatNumberWithSpaces } from '../shared';
import type { TiltakSavingsProps } from './types';

export const TiltakSavings: React.FC<TiltakSavingsProps> = ({
  annualSavingsKwh,
  annualSavingsNok,
  sourceDescription,
  economicsNote
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Rund til nærmeste 1000 for konsistens med WhiteInfoBox
  const roundToNearestThousand = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value / 1000) * 1000;
  };

  const roundedSavingsKwh = roundToNearestThousand(annualSavingsKwh);
  const savingsNok = roundToNearestThousand(annualSavingsNok);
  const hasData = annualSavingsKwh > 0;
  const hasTooltipContent = Boolean(sourceDescription) || Boolean(economicsNote);

  if (!hasData) {
    return (
      <section className="desktop-tiltak-card__savings desktop-tiltak-card__savings--empty">
        <div className="desktop-tiltak-card__savings-header">
          <span className="desktop-tiltak-card__savings-label">Årlig besparelse</span>
        </div>
        <div className="desktop-tiltak-card__savings-value">
          <span className="desktop-tiltak-card__savings-kwh">Ikke beregnet</span>
        </div>
      </section>
    );
  }

  return (
    <section className="desktop-tiltak-card__savings">
      <div className="desktop-tiltak-card__savings-header">
        <span className="desktop-tiltak-card__savings-label">Årlig besparelse</span>
        {hasTooltipContent && (
          <button
            className="desktop-tiltak-card__savings-info"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="Vis kilde for besparelseberegning"
            type="button"
          >
            ?
          </button>
        )}
      </div>
      <div className="desktop-tiltak-card__savings-value">
        <span className="desktop-tiltak-card__savings-nok">
          {formatNumberWithSpaces(savingsNok)} kr
        </span>
        <span className="desktop-tiltak-card__savings-kwh">
          {formatNumberWithSpaces(roundedSavingsKwh)} kWh
        </span>
      </div>
      {showTooltip && hasTooltipContent && (
        <div className="desktop-tiltak-card__savings-tooltip" role="tooltip">
          {sourceDescription && (
            <>
              <h4>Kilde</h4>
              <p>{sourceDescription}</p>
            </>
          )}
          {economicsNote && (
            <>
              <h4>Om besparelsen</h4>
              <p>{economicsNote}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
};

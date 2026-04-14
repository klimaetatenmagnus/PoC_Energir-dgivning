import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatNumberWithSpaces } from '../shared';
import type { TiltakSavingsProps } from './types';

export const TiltakSavings: React.FC<TiltakSavingsProps> = ({
  annualSavingsKwh,
  annualSavingsNok,
  sourceDescription,
  economicsNote
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);

  // Når tooltip vises: beregn posisjon ut fra savings-seksjonens rect.
  // Tooltip rendres via portal til document.body for å slippe klipping fra
  // foreldre med overflow: hidden (desktop-tiltak-card__body).
  useLayoutEffect(() => {
    if (!showTooltip || !sectionRef.current) return;
    const update = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      setTooltipStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showTooltip]);

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
    <section className="desktop-tiltak-card__savings" ref={sectionRef}>
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
      {showTooltip && hasTooltipContent && tooltipStyle &&
        createPortal(
          <div
            className="desktop-tiltak-card__savings-tooltip"
            role="tooltip"
            style={tooltipStyle}
          >
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
          </div>,
          document.body
        )}
    </section>
  );
};

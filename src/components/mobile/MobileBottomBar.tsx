import React from 'react';
import {
  ENERGY_RATING_COLORS,
  formatSavingsKwh,
  formatSavingsNok,
  ratingTextColor,
  roundEstimate,
} from './mobileFormat';

export interface BottomBarChosenItem {
  id: string;
  title: string;
  /** Besparelse for tiltaket alene, null når den ikke kan beregnes */
  nok: number | null;
}

interface MobileBottomBarProps {
  chosen: BottomBarChosenItem[];
  /** Samlet besparelse for valgte tiltak */
  totalNok: number;
  totalKwh: number;
  /** Samlet besparelse hvis alle gjenstående tiltak velges (vises når ingenting er valgt) */
  potentialNok: number;
  /** Dagens energikarakter, etter tiltak som er gjort fra før */
  baseRating?: string | null;
  /** Ny energikarakter, bare satt når den er bedre enn dagens */
  newRating?: string | null;
  /** Tiltak som er merket som gjort fra før (visningsnavn) */
  doneTitles: string[];
  uncalculableCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onForward: () => void;
  onShowHowItWorks: () => void;
}

const RatingChip: React.FC<{ rating: string }> = ({ rating }) => (
  <span
    className="mobile-bottom-bar__rating"
    style={{
      backgroundColor: ENERGY_RATING_COLORS[rating] ?? '#FFFFFF',
      color: ratingTextColor(rating),
    }}
  >
    {rating}
  </span>
);

/**
 * Slank bunnlinje med samlet besparelse, energikarakter og neste steg.
 * Trykk på venstre del viser utregningen i et panel over linja.
 */
export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  chosen,
  totalNok,
  totalKwh,
  potentialNok,
  baseRating,
  newRating,
  doneTitles,
  uncalculableCount,
  expanded,
  onToggleExpanded,
  onForward,
  onShowHowItWorks,
}) => {
  const hasSelection = chosen.length > 0;
  const hasTotal = roundEstimate(totalNok) > 0;
  const base = baseRating?.toUpperCase();
  const next = newRating?.toUpperCase();
  const improved = Boolean(base && next && base !== next);
  const showBreakdown = hasSelection && expanded;

  return (
    <div className="mobile-bottom-bar">
      {showBreakdown && (
        <div className="mobile-bottom-bar__breakdown" id="mobile-bottom-bar-breakdown">
          <h3 className="mobile-bottom-bar__breakdown-title">Dette har du valgt</h3>
          <ul className="mobile-bottom-bar__breakdown-list">
            {chosen.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <span className="mobile-bottom-bar__amount">
                  {item.nok !== null ? formatSavingsNok(item.nok) : 'Ikke beregnet'}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mobile-bottom-bar__totals">
            <div>
              <dt>Samlet besparelse</dt>
              <dd>{hasTotal ? formatSavingsNok(totalNok) : 'Ikke beregnet'}</dd>
            </div>
            {roundEstimate(totalKwh) > 0 && (
              <div>
                <dt>Spart energi</dt>
                <dd>{formatSavingsKwh(totalKwh)}</dd>
              </div>
            )}
          </dl>
          {chosen.length > 1 && (
            <p className="mobile-bottom-bar__note">
              Tiltakene påvirker hverandre. Derfor er samlet besparelse lavere enn summen av
              tiltakene hver for seg.
            </p>
          )}
          {uncalculableCount > 0 && (
            <p className="mobile-bottom-bar__note">
              {uncalculableCount === 1
                ? 'Ett av tiltakene kan ikke beregnes for denne boligen.'
                : `${uncalculableCount} av tiltakene kan ikke beregnes for denne boligen.`}
            </p>
          )}
          {doneTitles.length > 0 && (
            <p className="mobile-bottom-bar__note">
              Gjort fra før og regnet inn i dagens energikarakter: {doneTitles.join(', ')}.
            </p>
          )}
          <button type="button" className="mobile-bottom-bar__how" onClick={onShowHowItWorks}>
            Slik regner vi
          </button>
        </div>
      )}

      <div className="mobile-bottom-bar__bar">
        {hasSelection ? (
          <>
            <button
              type="button"
              className="mobile-bottom-bar__summary"
              aria-expanded={showBreakdown}
              aria-controls="mobile-bottom-bar-breakdown"
              onClick={onToggleExpanded}
            >
              <span className="mobile-bottom-bar__summary-text">
                <span className="mobile-bottom-bar__total" aria-live="polite">
                  {hasTotal ? formatSavingsNok(totalNok) : 'Ikke beregnet'}
                </span>
                <span className="mobile-bottom-bar__meta">
                  <span>{chosen.length} tiltak</span>
                  {improved && base && next && (
                    <span
                      className="mobile-bottom-bar__ratings"
                      role="img"
                      aria-label={`Energikarakter fra ${base} til ${next}`}
                    >
                      <RatingChip rating={base} />
                      <span aria-hidden="true">→</span>
                      <RatingChip rating={next} />
                    </span>
                  )}
                </span>
              </span>
              <svg
                className={`mobile-bottom-bar__chevron${showBreakdown ? ' mobile-bottom-bar__chevron--open' : ''}`}
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path d="M4 15 L12 8 L20 15" />
              </svg>
            </button>
            <button type="button" className="mobile-bottom-bar__cta" onClick={onForward}>
              Veien videre
            </button>
          </>
        ) : (
          <div className="mobile-bottom-bar__empty">
            {roundEstimate(potentialNok) > 0 && (
              <span className="mobile-bottom-bar__potential">
                Kan spare opptil {formatSavingsNok(potentialNok)}
              </span>
            )}
            <span>Velg tiltak for å se din besparelse</span>
          </div>
        )}
      </div>
    </div>
  );
};

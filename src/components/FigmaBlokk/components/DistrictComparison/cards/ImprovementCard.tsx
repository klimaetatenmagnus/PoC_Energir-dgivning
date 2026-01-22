/**
 * ImprovementCard (Kort 2.3)
 * Viser forbedringspotensial relativt til bydel
 */

import React from 'react';
import type { DistrictStats, EnergyGrade } from '../../../../../types/districtStatistics';

interface ImprovementCardProps {
  currentPercentile: number;
  projectedPercentile: number | null;
  districtName: string;
  districtStats: DistrictStats;
  currentEnergyGrade: EnergyGrade | null;
  projectedEnergyGrade: EnergyGrade | null;
  hasActiveMeasures: boolean;
}

const GRADE_COLORS: Record<EnergyGrade, string> = {
  A: 'var(--pkt-color-brand-green-1000, #43F8B6)',
  B: 'var(--pkt-color-brand-light-green-1000, #C7F6C9)',
  C: 'var(--pkt-color-brand-yellow-500, #FFE7BC)',
  D: 'var(--pkt-color-brand-yellow-1000, #F9C66B)',
  E: 'var(--pkt-color-brand-red-600, #FFB4AC)',
  F: 'var(--pkt-color-brand-red-600, #FFB4AC)',
  G: 'var(--pkt-color-brand-red-1000, #FF8274)',
};

export const ImprovementCard: React.FC<ImprovementCardProps> = ({
  currentPercentile,
  projectedPercentile,
  districtName,
  currentEnergyGrade,
  projectedEnergyGrade,
  hasActiveMeasures,
}) => {
  const improvement = projectedPercentile !== null ? currentPercentile - projectedPercentile : 0;

  return (
    <div className="carousel-card carousel-card--improvement">
      <div className="carousel-card__title">
        Din posisjon i {districtName}
      </div>

      {/* Percentil-skala - speilet: under snitt til venstre, best til høyre */}
      <div className="improvement-scale">
        <div className="improvement-scale__labels">
          <span>Under snitt</span>
          <span>Snitt</span>
          <span>Best</span>
        </div>
        <div className="improvement-scale__track">
          {/* Markør for nåværende posisjon - invertert for speilet skala */}
          <div
            className="improvement-scale__marker improvement-scale__marker--current"
            style={{ left: `${100 - currentPercentile}%` }}
            title={`Din bolig: Topp ${currentPercentile}%`}
          >
            <div className="improvement-scale__marker-dot" />
            <span className="improvement-scale__marker-label">Din bolig</span>
          </div>

          {/* Markør for projisert posisjon - invertert for speilet skala */}
          {hasActiveMeasures && projectedPercentile !== null && (
            <div
              className="improvement-scale__marker improvement-scale__marker--projected"
              style={{ left: `${100 - projectedPercentile}%` }}
              title={`Med tiltak: Topp ${projectedPercentile}%`}
            >
              <div className="improvement-scale__marker-dot improvement-scale__marker-dot--projected" />
              <span className="improvement-scale__marker-label improvement-scale__marker-label--top">Med valgte tiltak</span>
            </div>
          )}

          {/* Forbindelseslinje mellom markører - invertert for speilet skala */}
          {hasActiveMeasures && projectedPercentile !== null && improvement > 0 && (
            <div
              className="improvement-scale__arrow"
              style={{
                left: `${100 - currentPercentile}%`,
                width: `${improvement}%`,
              }}
            />
          )}
        </div>
        <div className="improvement-scale__ticks">
          <span>90%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>10%</span>
        </div>
      </div>

      {/* Statistikk-bokser */}
      <div className="improvement-stats">
        <div className="improvement-stat">
          <div className="improvement-stat__label">Din bolig</div>
          <div
            className="improvement-stat__grade"
            style={{ backgroundColor: currentEnergyGrade ? GRADE_COLORS[currentEnergyGrade] : '#ccc' }}
          >
            {currentEnergyGrade || '-'}
          </div>
        </div>

        {hasActiveMeasures && projectedPercentile !== null && projectedEnergyGrade && (
          <>
            <div className="improvement-stat__arrow">→</div>
            <div className="improvement-stat">
              <div className="improvement-stat__label">Med tiltak</div>
              <div
                className="improvement-stat__grade"
                style={{ backgroundColor: GRADE_COLORS[projectedEnergyGrade] }}
              >
                {projectedEnergyGrade}
              </div>
            </div>
          </>
        )}

        {!hasActiveMeasures && (
          <>
            <div className="improvement-stat__arrow">→</div>
            <div className="improvement-stat">
              <div className="improvement-stat__label">Beste i bydel</div>
              <div
                className="improvement-stat__grade"
                style={{ backgroundColor: GRADE_COLORS.A }}
              >
                A
              </div>
            </div>
          </>
        )}
      </div>

      {/* Oppsummering */}
      {hasActiveMeasures && improvement > 0 && (
        <div className="carousel-card__summary carousel-card__summary--positive">
          +{improvement} prosentpoeng forbedring med valgte tiltak
        </div>
      )}
      {!hasActiveMeasures && (
        <div className="carousel-card__summary carousel-card__summary--info">
          Velg tiltak for å se ditt forbedringspotensial
        </div>
      )}
    </div>
  );
};

export default ImprovementCard;

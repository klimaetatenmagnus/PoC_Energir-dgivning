/**
 * ComparisonCard (Kort 2.1)
 * Viser kWh/m² sammenligning med bydelssnitt
 */

import React from 'react';
import type { DistrictStats, MotivationalMessage } from '../../../../../types/districtStatistics';

interface ComparisonCardProps {
  currentKwhPerM2: number;
  projectedKwhPerM2: number | null;
  districtName: string;
  districtStats: DistrictStats;
  percentageDifferenceFromAvg: number;
  motivationalMessage: MotivationalMessage;
  hasActiveMeasures: boolean;
}

export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  currentKwhPerM2,
  projectedKwhPerM2,
  districtName,
  districtStats,
  percentageDifferenceFromAvg,
  motivationalMessage,
  hasActiveMeasures,
}) => {
  const isBetterThanAvg = percentageDifferenceFromAvg > 0;
  const barWidthCurrent = Math.min(100, (currentKwhPerM2 / (districtStats.avgKwhPerM2 * 1.5)) * 100);
  const barWidthAvg = Math.min(100, (districtStats.avgKwhPerM2 / (districtStats.avgKwhPerM2 * 1.5)) * 100);
  const barWidthProjected = projectedKwhPerM2
    ? Math.min(100, (projectedKwhPerM2 / (districtStats.avgKwhPerM2 * 1.5)) * 100)
    : null;

  return (
    <div className="carousel-card carousel-card--comparison">
      {/* Motiverende melding */}
      <div className="carousel-card__message">
        {motivationalMessage.text}
      </div>

      {/* Overskrift */}
      <div className="carousel-card__title">Energiforbruk</div>

      {/* Visuell sammenligning med bars */}
      <div className="carousel-card__bars">
        <div className="carousel-card__bar-row">
          <span className="carousel-card__bar-label">Din bolig*</span>
          <div className="carousel-card__bar-container">
            <div
              className={`carousel-card__bar ${isBetterThanAvg ? 'carousel-card__bar--good' : 'carousel-card__bar--neutral'}`}
              style={{ width: `${barWidthCurrent}%` }}
            />
          </div>
          <span className="carousel-card__bar-value">{Math.round(currentKwhPerM2)}</span>
        </div>

        {hasActiveMeasures && projectedKwhPerM2 !== null && barWidthProjected !== null && (
          <div className="carousel-card__bar-row carousel-card__bar-row--projected">
            <span className="carousel-card__bar-label">Med tiltak</span>
            <div className="carousel-card__bar-container">
              <div
                className="carousel-card__bar carousel-card__bar--projected"
                style={{ width: `${barWidthProjected}%` }}
              />
            </div>
            <span className="carousel-card__bar-value">{Math.round(projectedKwhPerM2)}</span>
          </div>
        )}

        <div className="carousel-card__bar-row carousel-card__bar-row--avg">
          <span className="carousel-card__bar-label">Snitt {districtName}</span>
          <div className="carousel-card__bar-container">
            <div
              className="carousel-card__bar carousel-card__bar--avg"
              style={{ width: `${barWidthAvg}%` }}
            />
          </div>
          <span className="carousel-card__bar-value">{districtStats.avgKwhPerM2}</span>
        </div>
      </div>

      {/* Oppsummering */}
      <div className={`carousel-card__summary ${isBetterThanAvg ? 'carousel-card__summary--positive' : 'carousel-card__summary--negative'}`}>
        {isBetterThanAvg
          ? `${Math.round(Math.abs(percentageDifferenceFromAvg))}% bedre enn bydelssnitt`
          : `${Math.round(Math.abs(percentageDifferenceFromAvg))}% mindre energieffektiv enn bydelssnitt`
        }
      </div>

      {/* Kildeinfo */}
      <div className="carousel-card__meta">
        kWh/m²/år
      </div>
    </div>
  );
};

export default ComparisonCard;

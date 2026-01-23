/**
 * EnergyGradeCard (Kort 2.2)
 * Viser A-G energikarakter-fordeling i bydelen
 * Støtter visning av både nåværende og projisert energikarakter (etter tiltak)
 */

import React from 'react';
import type { DistrictStats, EnergyGrade } from '../../../../../types/districtStatistics';

interface EnergyGradeCardProps {
  districtName: string;
  districtStats: DistrictStats;
  userEnergyGrade: EnergyGrade | null;
  /** Projisert energikarakter etter valgte tiltak */
  projectedEnergyGrade?: EnergyGrade | null;
  /** Om bruker har valgt aktive tiltak */
  hasActiveMeasures?: boolean;
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

const GRADES: EnergyGrade[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const EnergyGradeCard: React.FC<EnergyGradeCardProps> = ({
  districtName,
  districtStats,
  userEnergyGrade,
  projectedEnergyGrade,
  hasActiveMeasures = false,
}) => {
  const maxPercentage = Math.max(...Object.values(districtStats.energyGradeDistribution));

  // Vis projisert karakter hvis tiltak er valgt
  const showProjected = hasActiveMeasures && projectedEnergyGrade;
  const gradeChanged = projectedEnergyGrade !== userEnergyGrade;

  return (
    <div className="carousel-card carousel-card--energy-grade">
      <div className="carousel-card__title">
        Energikarakterer i {districtName}
      </div>

      <div className="energy-grade-chart">
        {GRADES.map((grade) => {
          const percentage = districtStats.energyGradeDistribution[grade];
          const barWidth = (percentage / maxPercentage) * 100;
          const isUserGrade = userEnergyGrade === grade;
          const isProjectedGrade = showProjected && gradeChanged && projectedEnergyGrade === grade;

          return (
            <div
              key={grade}
              className={`energy-grade-row ${isUserGrade ? 'energy-grade-row--highlighted' : ''} ${isProjectedGrade ? 'energy-grade-row--projected' : ''}`}
            >
              <span
                className="energy-grade-row__grade"
                style={{ backgroundColor: GRADE_COLORS[grade] }}
              >
                {grade}
              </span>
              <div className="energy-grade-row__bar-container">
                <div
                  className="energy-grade-row__bar"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: GRADE_COLORS[grade],
                  }}
                />
              </div>
              <span className="energy-grade-row__percentage">
                {percentage}%
              </span>
              <div className="energy-grade-row__markers">
                {isUserGrade && (
                  <span className="energy-grade-row__marker">Nå*</span>
                )}
                {isProjectedGrade && (
                  <span className="energy-grade-row__marker energy-grade-row__marker--projected">Mål</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Oppsummering av forbedring */}
      {showProjected && userEnergyGrade && projectedEnergyGrade && (
        <div className={`carousel-card__summary ${gradeChanged ? 'carousel-card__summary--positive' : 'carousel-card__summary--info'}`}>
          {gradeChanged
            ? `${userEnergyGrade} → ${projectedEnergyGrade} med valgte tiltak`
            : `Beholder karakter ${userEnergyGrade} med valgte tiltak`
          }
        </div>
      )}

      <div className="carousel-card__meta">
        Fordeling basert på {districtStats.count.toLocaleString('nb-NO')} boliger
      </div>
    </div>
  );
};

export default EnergyGradeCard;

import React, { useMemo } from 'react';
import { PktButton, PktAlert } from '@oslokommune/punkt-react';
import type { DistrictStats } from '../../../types/districtStatistics';
import {
  calculatePercentile,
  calculateProjectedConsumption,
  formatPercentageDifference,
  getMotivationalMessage,
} from '../../../services/districtStatisticsService';
import './DistrictComparison.css';

interface DistrictComparisonProps {
  /** Om sammenlignings-seksjonen er utvidet */
  isExpanded: boolean;
  /** Callback for å toggle utvidet/kollapset tilstand */
  onToggle: () => void;
  /** Nåværende energiforbruk (kWh/m²/år) */
  currentKwhPerM2: number;
  /** Totale energibesparelser fra valgte tiltak (kWh/år) */
  totalEnergySavings: number;
  /** Bruksareal (m²) */
  bruksareal: number;
  /** Navn på bydelen */
  districtName: string;
  /** Statistikk for bydelen */
  districtStats: DistrictStats;
}

export const DistrictComparison: React.FC<DistrictComparisonProps> = ({
  isExpanded,
  onToggle,
  currentKwhPerM2,
  totalEnergySavings,
  bruksareal,
  districtName,
  districtStats,
}) => {
  // Beregn nåværende percentil
  const currentPercentile = useMemo(() => {
    if (!Number.isFinite(currentKwhPerM2) || currentKwhPerM2 <= 0) {
      return null;
    }
    return calculatePercentile(currentKwhPerM2, districtStats);
  }, [currentKwhPerM2, districtStats]);

  // Beregn projisert forbruk og percentil etter tiltak
  const projectedData = useMemo(() => {
    if (totalEnergySavings <= 0 || !Number.isFinite(currentKwhPerM2) || bruksareal <= 0) {
      return null;
    }

    const projectedKwhPerM2 = calculateProjectedConsumption(
      currentKwhPerM2,
      totalEnergySavings,
      bruksareal
    );
    const projectedPercentile = calculatePercentile(projectedKwhPerM2, districtStats);

    return {
      projectedKwhPerM2,
      projectedPercentile,
      improvement: currentPercentile ? currentPercentile - projectedPercentile : 0,
    };
  }, [currentKwhPerM2, totalEnergySavings, bruksareal, districtStats, currentPercentile]);

  // Beregn prosentvis forskjell fra bydelssnitt
  const percentageDifferenceFromAvg = useMemo(() => {
    if (!Number.isFinite(currentKwhPerM2) || currentKwhPerM2 <= 0) {
      return 0;
    }
    return ((districtStats.avgKwhPerM2 - currentKwhPerM2) / districtStats.avgKwhPerM2) * 100;
  }, [currentKwhPerM2, districtStats.avgKwhPerM2]);

  // Hent motiverende melding basert på percentil (fra dokumentet seksjon 7.3)
  // Må kalles før conditional return for å følge Rules of Hooks
  const motivationalMessage = useMemo(() => {
    if (currentPercentile === null) return null;
    return getMotivationalMessage(currentPercentile, districtName);
  }, [currentPercentile, districtName]);

  const projectedMessage = useMemo(() => {
    if (!projectedData) return null;
    return getMotivationalMessage(projectedData.projectedPercentile, districtName);
  }, [projectedData, districtName]);

  // Ikke vis hvis vi ikke har gyldig data
  if (currentPercentile === null) {
    return null;
  }

  return (
    <div className="district-comparison">
      <PktButton
        skin="tertiary"
        size="small"
        variant="icon-right"
        iconName={isExpanded ? 'chevron-thin-up' : 'chevron-thin-down'}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls="district-comparison-content"
        className="district-comparison__toggle"
      >
        Sammenlign med naboene
      </PktButton>

      <div
        id="district-comparison-content"
        className={`district-comparison__content ${
          isExpanded
            ? 'district-comparison__content--expanded'
            : 'district-comparison__content--collapsed'
        }`}
      >
        {/* Motiverende melding fra dokumentet seksjon 7.3 */}
        {motivationalMessage && (
          <div className="district-comparison__alert">
            <PktAlert skin={motivationalMessage.skin} compact>
              {motivationalMessage.text}
            </PktAlert>
          </div>
        )}

        {/* Hvis tiltak er valgt, vis projisert melding */}
        {projectedData && projectedData.improvement > 0 && projectedMessage && (
          <div className="district-comparison__alert district-comparison__alert--projected">
            <span className="district-comparison__projected-label">Med tiltak:</span>
            <PktAlert skin={projectedMessage.skin} compact>
              {projectedMessage.text}
            </PktAlert>
          </div>
        )}

        <div className="district-comparison__stats">
          <div className="district-comparison__stat">
            <span className="district-comparison__stat-label">Din bolig</span>
            <span className="district-comparison__stat-value">
              {Math.round(currentKwhPerM2)} kWh/m²
            </span>
          </div>
          <div className="district-comparison__stat">
            <span className="district-comparison__stat-label">Bydelssnitt</span>
            <span className="district-comparison__stat-value">
              {districtStats.avgKwhPerM2} kWh/m²
            </span>
          </div>
        </div>

        <div className="district-comparison__summary">
          {formatPercentageDifference(percentageDifferenceFromAvg)}
        </div>

        <div className="district-comparison__meta">
          Basert på {districtStats.count.toLocaleString('nb-NO')} boliger i {districtName}
        </div>
      </div>
    </div>
  );
};

export default DistrictComparison;

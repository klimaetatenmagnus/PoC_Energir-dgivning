/**
 * DistrictComparisonCarousel
 * Karusell med tre kort for bydelssammenligning:
 * 1. ComparisonCard - kWh/m² sammenligning
 * 2. EnergyGradeCard - A-G fordeling
 * 3. ImprovementCard - Forbedringspotensial
 *
 * Merk: Ekspandering håndteres av PktAccordion i WhiteInfoBox
 */

import React, { useState, useMemo } from 'react';
import { PktButton, PktIcon, PktSelect } from '@oslokommune/punkt-react';
import type { DistrictStats, EnergyGrade, BuildingTypeCategory } from '../../../../types/districtStatistics';
import {
  calculatePercentile,
  calculateProjectedConsumption,
  getMotivationalMessage,
} from '../../../../services/districtStatisticsService';
import { ComparisonCard, EnergyGradeCard, ImprovementCard } from './cards';
import './DistrictComparisonCarousel.css';

interface DistrictComparisonCarouselProps {
  /** Om karusellen er synlig/utvidet (styres av PktAccordion) */
  isExpanded: boolean;
  /** Callback for toggle (ikke brukt når PktAccordion styrer) */
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
  /** Navn på delbydelen (valgfri) */
  subdistrictName?: string;
  /** Statistikk for delbydelen (valgfri) */
  subdistrictStats?: DistrictStats;
  /** Brukerens energikarakter (fra Enova eller beregnet) */
  userEnergyGrade?: EnergyGrade | null;
  /** Boligtype-kategori for riktig sammenligningstekst */
  buildingTypeCategory?: BuildingTypeCategory;
  /** Om brukerens energiforbruk er basert på Enova bulk-data (true) eller TEK-estimering (false) */
  isUsingEnovaBulkData?: boolean;
}

type ComparisonLevel = 'district' | 'subdistrict';

interface CardConfig {
  id: string;
  title: string;
  iconName: string;
}

const CARDS: CardConfig[] = [
  { id: 'comparison', title: 'Energiforbruk', iconName: 'district' },
  { id: 'distribution', title: 'Energikarakterer', iconName: 'bulb' },
  { id: 'improvement', title: 'Din posisjon', iconName: 'location-pin' },
];

/**
 * Estimerer energikarakter basert på kWh/m²
 */
function estimateEnergyGrade(kwhPerM2: number): EnergyGrade {
  if (kwhPerM2 <= 85) return 'A';
  if (kwhPerM2 <= 105) return 'B';
  if (kwhPerM2 <= 130) return 'C';
  if (kwhPerM2 <= 160) return 'D';
  if (kwhPerM2 <= 195) return 'E';
  if (kwhPerM2 <= 240) return 'F';
  return 'G';
}

export const DistrictComparisonCarousel: React.FC<DistrictComparisonCarouselProps> = ({
  currentKwhPerM2,
  totalEnergySavings,
  bruksareal,
  districtName,
  districtStats,
  subdistrictName,
  subdistrictStats,
  userEnergyGrade,
  buildingTypeCategory = 'småhus',
  isUsingEnovaBulkData = false,
}) => {
  // Bestem riktig boligtekst basert på kategori
  const buildingTypeText = buildingTypeCategory === 'blokk' ? 'leiligheter' : 'eneboliger';
  const [activeIndex, setActiveIndex] = useState(0);

  // Toggle mellom bydel og delbydel-visning (bydel er default)
  const hasSubdistrict = Boolean(subdistrictName && subdistrictStats);
  const [comparisonLevel, setComparisonLevel] = useState<ComparisonLevel>('district');

  // Bestem aktiv statistikk og områdenavn basert på valgt nivå
  const activeStats = comparisonLevel === 'subdistrict' && subdistrictStats
    ? subdistrictStats
    : districtStats;
  const activeAreaName = comparisonLevel === 'subdistrict' && subdistrictName
    ? subdistrictName
    : districtName;

  // Beregninger for alle kort (oppdateres når activeStats endres)
  const calculatedData = useMemo(() => {
    if (!Number.isFinite(currentKwhPerM2) || currentKwhPerM2 <= 0) {
      return null;
    }

    const currentPercentile = calculatePercentile(currentKwhPerM2, activeStats);
    const percentageDifferenceFromAvg =
      ((activeStats.avgKwhPerM2 - currentKwhPerM2) / activeStats.avgKwhPerM2) * 100;
    const motivationalMessage = getMotivationalMessage(currentPercentile, activeAreaName);

    // Energikarakter - bruk oppgitt eller estimer
    const currentEnergyGrade = userEnergyGrade ?? estimateEnergyGrade(currentKwhPerM2);

    // Beregn projisert data hvis tiltak er valgt
    let projectedKwhPerM2: number | null = null;
    let projectedPercentile: number | null = null;
    let projectedEnergyGrade: EnergyGrade | null = null;
    const hasActiveMeasures = totalEnergySavings > 0 && bruksareal > 0;

    if (hasActiveMeasures) {
      projectedKwhPerM2 = calculateProjectedConsumption(currentKwhPerM2, totalEnergySavings, bruksareal);
      projectedPercentile = calculatePercentile(projectedKwhPerM2, activeStats);
      projectedEnergyGrade = estimateEnergyGrade(projectedKwhPerM2);
    }

    return {
      currentPercentile,
      percentageDifferenceFromAvg,
      motivationalMessage,
      currentEnergyGrade,
      projectedKwhPerM2,
      projectedPercentile,
      projectedEnergyGrade,
      hasActiveMeasures,
    };
  }, [currentKwhPerM2, totalEnergySavings, bruksareal, activeAreaName, activeStats, userEnergyGrade]);

  // Ikke vis hvis vi ikke har gyldig data
  if (calculatedData === null) {
    return null;
  }

  const goToPrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? CARDS.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev === CARDS.length - 1 ? 0 : prev + 1));
  };

  const renderActiveCard = () => {
    const {
      currentPercentile,
      percentageDifferenceFromAvg,
      motivationalMessage,
      currentEnergyGrade,
      projectedKwhPerM2,
      projectedPercentile,
      projectedEnergyGrade,
      hasActiveMeasures,
    } = calculatedData;

    switch (CARDS[activeIndex].id) {
      case 'comparison':
        return (
          <ComparisonCard
            currentKwhPerM2={currentKwhPerM2}
            projectedKwhPerM2={projectedKwhPerM2}
            districtName={activeAreaName}
            districtStats={activeStats}
            percentageDifferenceFromAvg={percentageDifferenceFromAvg}
            motivationalMessage={motivationalMessage}
            hasActiveMeasures={hasActiveMeasures}
          />
        );
      case 'distribution':
        return (
          <EnergyGradeCard
            districtName={activeAreaName}
            districtStats={activeStats}
            userEnergyGrade={currentEnergyGrade}
            projectedEnergyGrade={projectedEnergyGrade}
            hasActiveMeasures={hasActiveMeasures}
          />
        );
      case 'improvement':
        return (
          <ImprovementCard
            currentPercentile={currentPercentile}
            projectedPercentile={projectedPercentile}
            districtName={activeAreaName}
            districtStats={activeStats}
            currentEnergyGrade={currentEnergyGrade}
            projectedEnergyGrade={projectedEnergyGrade}
            hasActiveMeasures={hasActiveMeasures}
          />
        );
      default:
        return null;
    }
  };

  // Håndter dropdown-endring
  const handleLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setComparisonLevel(event.target.value as ComparisonLevel);
  };

  return (
    <div className="district-carousel">
      {/* Karusell-navigasjon */}
      <div className="district-carousel__nav">
        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-left"
          onClick={goToPrevious}
          aria-label="Forrige kort"
          className="district-carousel__nav-btn"
        />

        <div className="district-carousel__nav-info">
          <span className="district-carousel__nav-title">
            <PktIcon name={CARDS[activeIndex].iconName} className="district-carousel__nav-icon" />
            {CARDS[activeIndex].title}
          </span>
          <span className="district-carousel__nav-indicator">
            {activeIndex + 1} / {CARDS.length}
          </span>
        </div>

        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-right"
          onClick={goToNext}
          aria-label="Neste kort"
          className="district-carousel__nav-btn"
        />
      </div>

      {/* Dropdown for bydel/delbydel-valg */}
      {hasSubdistrict && (
        <div className="district-carousel__level-select">
          <PktSelect
            id="district-level-select"
            name="district-level"
            label=" "
            value={comparisonLevel}
            onChange={handleLevelChange}
            className="district-carousel__select"
          >
            <option value="district">Sammenlign med {districtName}</option>
            <option value="subdistrict">Sammenlign med {subdistrictName}</option>
          </PktSelect>
        </div>
      )}

      {/* Karusell-innhold */}
      <div className="district-carousel__content">
        {renderActiveCard()}
      </div>

      {/* Dot-indikatorer */}
      <div className="district-carousel__dots">
        {CARDS.map((card, index) => (
          <button
            key={card.id}
            className={`district-carousel__dot ${
              index === activeIndex ? 'district-carousel__dot--active' : ''
            }`}
            onClick={() => setActiveIndex(index)}
            aria-label={`Gå til ${card.title}`}
          />
        ))}
      </div>

      {/* Kildeinfo */}
      <div className="district-carousel__meta">
        <span>Basert på {activeStats.count.toLocaleString('nb-NO')} {buildingTypeText} i {activeAreaName}</span>
        {isUsingEnovaBulkData ? (
          <span className="district-carousel__source-info district-carousel__source-info--enova">
            *Energiforbruket for din bolig er hentet fra registrert energiattest.
          </span>
        ) : (
          <span className="district-carousel__source-info district-carousel__source-info--estimated">
            *Energiforbruket for din bolig er estimert basert på byggeår og areal.
          </span>
        )}
      </div>
    </div>
  );
};

// Re-eksporter for bakoverkompatibilitet
export { DistrictComparisonCarousel as DistrictComparison };
export default DistrictComparisonCarousel;

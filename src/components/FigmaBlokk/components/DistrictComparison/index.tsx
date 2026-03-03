/**
 * DistrictComparisonCarousel
 * Karusell med tre kort for bydelssammenligning:
 * 1. ComparisonCard - kWh/m² sammenligning
 * 2. EnergyGradeCard - A-G fordeling
 * 3. ImprovementCard - Forbedringspotensial
 *
 * Merk: Ekspandering håndteres av PktAccordion i WhiteInfoBox
 */

import React, { useState, useMemo, useEffect } from 'react';
import { PktAlert, PktIcon, PktSelect } from '@oslokommune/punkt-react';
import type { DistrictStats, EnergyGrade, BuildingTypeCategory } from '../../../../types/districtStatistics';
import {
  calculatePercentile,
  calculateProjectedConsumption,
  getMotivationalMessage,
} from '../../../../services/districtStatisticsService';
import { estimateEnergyGradeFromKwhPerM2 } from '../../../../utils/tekEnergyCalculations';
import type { BuildingType } from '../../../../utils/tekEnergyCalculations';
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

/** Map BuildingTypeCategory til BuildingType for sentralisert energiberegning */
function mapCategoryToBuildingType(category: BuildingTypeCategory): BuildingType | null {
  if (category === 'småhus') return 'småhus';
  if (category === 'blokk') return 'blokk';
  return null;
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

  // Vis energiattest-varsel når Enova-data brukes
  const [showEnovaNotice, setShowEnovaNotice] = useState(isUsingEnovaBulkData);

  // Reset varselet når datakilden endres (nytt adresseoppslag)
  useEffect(() => {
    setShowEnovaNotice(isUsingEnovaBulkData);
  }, [isUsingEnovaBulkData]);

  // Animasjonstilstand for slide-overgang mellom kort
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);

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

  // Map boligtype-kategori til BuildingType for sentralisert energiberegning
  const mappedBuildingType = useMemo(() => mapCategoryToBuildingType(buildingTypeCategory), [buildingTypeCategory]);

  // Beregninger for alle kort (oppdateres når activeStats endres)
  const calculatedData = useMemo(() => {
    if (!Number.isFinite(currentKwhPerM2) || currentKwhPerM2 <= 0) {
      return null;
    }

    const currentPercentile = calculatePercentile(currentKwhPerM2, activeStats);
    const percentageDifferenceFromAvg =
      ((activeStats.avgKwhPerM2 - currentKwhPerM2) / activeStats.avgKwhPerM2) * 100;
    const motivationalMessage = getMotivationalMessage(currentPercentile, activeAreaName);

    // Energikarakter - bruk oppgitt eller estimer med sentralisert NS 3031:2025-skala
    const currentEnergyGrade = userEnergyGrade
      ?? (estimateEnergyGradeFromKwhPerM2(currentKwhPerM2, bruksareal, mappedBuildingType) as EnergyGrade);

    // Beregn projisert data hvis tiltak er valgt
    let projectedKwhPerM2: number | null = null;
    let projectedPercentile: number | null = null;
    let projectedEnergyGrade: EnergyGrade | null = null;
    const hasActiveMeasures = totalEnergySavings > 0 && bruksareal > 0;

    if (hasActiveMeasures) {
      projectedKwhPerM2 = calculateProjectedConsumption(currentKwhPerM2, totalEnergySavings, bruksareal);
      projectedPercentile = calculatePercentile(projectedKwhPerM2, activeStats);
      projectedEnergyGrade = estimateEnergyGradeFromKwhPerM2(projectedKwhPerM2, bruksareal, mappedBuildingType) as EnergyGrade;
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
  }, [currentKwhPerM2, totalEnergySavings, bruksareal, activeAreaName, activeStats, userEnergyGrade, mappedBuildingType]);

  // Ikke vis hvis vi ikke har gyldig data
  if (calculatedData === null) {
    return null;
  }

  // Navigasjon til nytt kort med slide-animasjon
  const goToCard = (newIndex: number, direction: 'left' | 'right') => {
    if (isAnimating || newIndex === activeIndex) return;
    setSlideDirection(direction);
    setIncomingIndex(newIndex);
    setIsAnimating(true);

    setTimeout(() => {
      setActiveIndex(newIndex);
      setIncomingIndex(null);
      setIsAnimating(false);
      setSlideDirection(null);
    }, 300);
  };

  const goToPrevious = () => {
    goToCard(activeIndex === 0 ? CARDS.length - 1 : activeIndex - 1, 'right');
  };

  const goToNext = () => {
    goToCard(activeIndex === CARDS.length - 1 ? 0 : activeIndex + 1, 'left');
  };

  const renderCard = (index: number) => {
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

    switch (CARDS[index].id) {
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

  // Rendrer én komplett slide: tittel, dropdown og kort-innhold
  const renderCardSlide = (index: number) => (
    <>
      <div className="district-carousel__card-header">
        <PktIcon name={CARDS[index].iconName} className="district-carousel__card-header-icon" />
        <span className="district-carousel__card-header-title">{CARDS[index].title}</span>
        <span className="district-carousel__card-header-indicator">{index + 1} / {CARDS.length}</span>
      </div>
      {hasSubdistrict && (
        <div className="district-carousel__level-select">
          <PktSelect
            id={`district-level-select-${index}`}
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
      <div className="district-carousel__card-body">
        {renderCard(index)}
      </div>
    </>
  );

  return (
    <div className="district-carousel">
      {/* Karusell med animerte slides */}
      <div className="district-carousel__stage">
        {/* Chevron-navigasjon (absolutt posisjonert) */}
        <button
          className="district-carousel__chevron district-carousel__chevron--left"
          onClick={goToPrevious}
          aria-label="Forrige kort"
        >
          <PktIcon name="chevron-thin-left" />
        </button>
        <button
          className="district-carousel__chevron district-carousel__chevron--right"
          onClick={goToNext}
          aria-label="Neste kort"
        >
          <PktIcon name="chevron-thin-right" />
        </button>

        {/* Energiattest-varsel overlay */}
        {showEnovaNotice && isUsingEnovaBulkData && (
          <div className="district-carousel__enova-notice-overlay">
            <PktAlert
              title="Energiattest funnet!"
              skin="info"
              closeAlert
              onClose={() => setShowEnovaNotice(false)}
            >
              <p>
                Vi ser at boligen din er registrert med energiattest fra Enova.
                For å gi en mest mulig rettferdig sammenligning mellom deg og
                naboene dine, brukes forbruksdata fra denne attesten i
                sammenligningen.
              </p>
              <p>
                Verdiene du ser her for energikarakter og energiforbruk vil
                sannsynligvis avvike noe fra estimatene som brukes ellers i
                løsningen.
              </p>
            </PktAlert>
          </div>
        )}

        {/* Animerte kort */}
        <div className="district-carousel__cards-container">
          <div className={`district-carousel__card district-carousel__card--outgoing${
            slideDirection === 'left' ? ' district-carousel__card--exit-left' : ''
          }${slideDirection === 'right' ? ' district-carousel__card--exit-right' : ''}`}>
            {renderCardSlide(activeIndex)}
          </div>
          {isAnimating && incomingIndex !== null && (
            <div className={`district-carousel__card district-carousel__card--incoming${
              slideDirection === 'left' ? ' district-carousel__card--enter-left' : ''
            }${slideDirection === 'right' ? ' district-carousel__card--enter-right' : ''}`}>
              {renderCardSlide(incomingIndex)}
            </div>
          )}
        </div>
      </div>

      {/* Dot-indikatorer */}
      <div className="district-carousel__dots">
        {CARDS.map((card, index) => (
          <button
            key={card.id}
            className={`district-carousel__dot ${
              index === activeIndex ? 'district-carousel__dot--active' : ''
            }`}
            onClick={() => {
              if (index !== activeIndex) {
                goToCard(index, index > activeIndex ? 'left' : 'right');
              }
            }}
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
        <span className="district-carousel__data-source">
          Kilde: Enova energimerkeregisteret
        </span>
      </div>
    </div>
  );
};

// Re-eksporter for bakoverkompatibilitet
export { DistrictComparisonCarousel as DistrictComparison };
export default DistrictComparisonCarousel;

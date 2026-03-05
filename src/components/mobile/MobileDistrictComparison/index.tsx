/**
 * MobileDistrictComparison
 * Modal med swipe-karusell for bydelssammenligning på mobil
 *
 * Gjenbruker kort-komponenter fra desktop:
 * - ComparisonCard: kWh/m² sammenligning
 * - EnergyGradeCard: A-G fordeling
 * - ImprovementCard: Din posisjon/percentil
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PktAlert, PktButton, PktIcon, PktSelect } from '@oslokommune/punkt-react';
import type { DistrictStats, EnergyGrade, BuildingTypeCategory } from '../../../types/districtStatistics';
import {
  calculatePercentile,
  calculateProjectedConsumption,
  getMotivationalMessage,
} from '../../../services/districtStatisticsService';
import { estimateEnergyGradeFromKwhPerM2 } from '../../../utils/tekEnergyCalculations';
import type { BuildingType } from '../../../utils/tekEnergyCalculations';
import { ComparisonCard, EnergyGradeCard, ImprovementCard } from '../../FigmaBlokk/components/DistrictComparison/cards';
import './MobileDistrictComparison.css';

interface MobileDistrictComparisonProps {
  /** Om modalen er synlig */
  isOpen: boolean;
  /** Callback for lukking av modal */
  onClose: () => void;
  /** Navarende energiforbruk (kWh/m2/ar) */
  currentKwhPerM2: number;
  /** Totale energibesparelser fra valgte tiltak (kWh/ar) */
  totalEnergySavings: number;
  /** Bruksareal (m2) */
  bruksareal: number;
  /** Navn pa bydelen */
  districtName: string;
  /** Statistikk for bydelen */
  districtStats: DistrictStats;
  /** Navn pa delbydelen (valgfri) */
  subdistrictName?: string;
  /** Statistikk for delbydelen (valgfri) */
  subdistrictStats?: DistrictStats;
  /** Brukerens energikarakter (fra Enova eller beregnet) */
  userEnergyGrade?: EnergyGrade | null;
  /** Boligtype-kategori for riktig sammenligningstekst */
  buildingTypeCategory?: BuildingTypeCategory;
  /** Om brukerens energiforbruk er basert på Enova-data (true) eller TEK-estimering (false) */
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

export const MobileDistrictComparison: React.FC<MobileDistrictComparisonProps> = ({
  isOpen,
  onClose,
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [comparisonLevel, setComparisonLevel] = useState<ComparisonLevel>('district');
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Vis energiattest-varsel når modalen åpnes med Enova-data
  const [showEnovaNotice, setShowEnovaNotice] = useState(false);

  useEffect(() => {
    if (isOpen && isUsingEnovaBulkData) {
      setShowEnovaNotice(true);
    }
  }, [isOpen, isUsingEnovaBulkData]);

  // Bestem riktig boligtekst basert pa kategori
  const buildingTypeText = buildingTypeCategory === 'blokk' ? 'leiligheter' : 'eneboliger';

  // Toggle mellom bydel og delbydel-visning
  const hasSubdistrict = Boolean(subdistrictName && subdistrictStats);

  // Bestem aktiv statistikk og omradenavn basert pa valgt niva
  const activeStats = comparisonLevel === 'subdistrict' && subdistrictStats
    ? subdistrictStats
    : districtStats;
  const activeAreaName = comparisonLevel === 'subdistrict' && subdistrictName
    ? subdistrictName
    : districtName;

  // Navigasjon til nytt kort med animasjon
  const goToCard = (newIndex: number) => {
    if (isAnimating || newIndex === activeIndex) return;
    if (newIndex < 0 || newIndex >= CARDS.length) return;

    setSlideDirection(newIndex > activeIndex ? 'left' : 'right');
    setIncomingIndex(newIndex);
    setIsAnimating(true);

    // Start animasjon, deretter oppdater index
    setTimeout(() => {
      setActiveIndex(newIndex);
      setIncomingIndex(null);
      setIsAnimating(false);
      setSlideDirection(null);
    }, 300); // Match CSS transition duration
  };

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || isAnimating) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;

    if (Math.abs(diff) > 50) {
      if (diff < 0 && activeIndex < CARDS.length - 1) {
        goToCard(activeIndex + 1); // Swipe left → next
      } else if (diff > 0 && activeIndex > 0) {
        goToCard(activeIndex - 1); // Swipe right → prev
      }
    }
    touchStartX.current = null;
  };

  // Map boligtype-kategori til BuildingType for sentralisert energiberegning
  const mappedBuildingType = useMemo(() => mapCategoryToBuildingType(buildingTypeCategory), [buildingTypeCategory]);

  // Beregninger for alle kort
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

  // Handler for dropdown-endring
  const handleLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setComparisonLevel(event.target.value as ComparisonLevel);
  };

  // Render kort basert på index
  const renderCard = (index: number) => {
    if (!calculatedData) return null;

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

  if (!isOpen) return null;

  // Ikke vis hvis vi ikke har gyldig data
  if (calculatedData === null) {
    return null;
  }

  return (
    <div className="mobile-district-overlay" onClick={onClose}>
      <div
        className="mobile-district-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kompakt header med kun lukk-knapp */}
        <div className="mobile-district-header">
          <PktButton
            skin="tertiary"
            size="small"
            variant="icon-only"
            iconName="close"
            onClick={onClose}
            aria-label="Lukk"
          />
        </div>

        {/* Tittel med ikon for aktivt kort (som desktop) */}
        <div className="mobile-district-card-title">
          <PktIcon name={CARDS[activeIndex].iconName} className="mobile-district-card-title__icon" />
          <span className="mobile-district-card-title__text">{CARDS[activeIndex].title}</span>
          <span className="mobile-district-card-title__indicator">{activeIndex + 1} / {CARDS.length}</span>
        </div>

        {/* Energiattest-varsel overlay (over hele modalen) */}
        {showEnovaNotice && isUsingEnovaBulkData && (
          <div className="mobile-district-enova-notice-overlay">
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

        {/* Karusell-innhold med chevron-navigasjon */}
        <div className="mobile-district-carousel">
          {/* Venstre chevron - vises kun når det er kort til venstre */}
          {activeIndex > 0 && (
            <button
              className="mobile-district-chevron mobile-district-chevron--left"
              onClick={() => goToCard(activeIndex - 1)}
              aria-label="Forrige kort"
            >
              <PktIcon name="chevron-thin-left" />
            </button>
          )}

          <div
            className={`mobile-district-cards-container ${
              slideDirection ? `mobile-district-cards--slide-${slideDirection}` : ''
            }`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Utgående kort (animeres ut) */}
            <div className={`mobile-district-card mobile-district-card--outgoing ${
              slideDirection === 'left' ? 'mobile-district-card--exit-left' : ''
            }${slideDirection === 'right' ? 'mobile-district-card--exit-right' : ''}`}>
              {renderCard(activeIndex)}
            </div>

            {/* Innkommende kort (animeres inn) - vises kun under animasjon */}
            {isAnimating && incomingIndex !== null && (
              <div className={`mobile-district-card mobile-district-card--incoming ${
                slideDirection === 'left' ? 'mobile-district-card--enter-left' : ''
              }${slideDirection === 'right' ? 'mobile-district-card--enter-right' : ''}`}>
                {renderCard(incomingIndex)}
              </div>
            )}
          </div>

          {/* Høyre chevron - vises kun når det er kort til høyre */}
          {activeIndex < CARDS.length - 1 && (
            <button
              className="mobile-district-chevron mobile-district-chevron--right"
              onClick={() => goToCard(activeIndex + 1)}
              aria-label="Neste kort"
            >
              <PktIcon name="chevron-thin-right" />
            </button>
          )}

        </div>

        {/* Dot-indikatorer */}
        <div className="mobile-district-nav">
          <div className="mobile-district-dots">
            {CARDS.map((card, i) => (
              <button
                key={card.id}
                className={`mobile-district-dot ${i === activeIndex ? 'mobile-district-dot--active' : ''}`}
                onClick={() => goToCard(i)}
                aria-label={card.title}
              />
            ))}
          </div>
        </div>

        {/* Footer med dropdown og kildeinfo */}
        <div className="mobile-district-footer">
          {/* Dropdown for bydel/delbydel */}
          {hasSubdistrict && (
            <div className="mobile-district-level-select">
              <PktSelect
                id="mobile-district-level"
                name="district-level"
                label=" "
                value={comparisonLevel}
                onChange={handleLevelChange}
              >
                <option value="district">Sammenlign med {districtName}</option>
                <option value="subdistrict">Sammenlign med {subdistrictName}</option>
              </PktSelect>
            </div>
          )}

          {/* Kildeinfo */}
          <div className="mobile-district-meta">
            <span>Basert på {activeStats.count.toLocaleString('nb-NO')} {buildingTypeText} i {activeAreaName}</span>
            {isUsingEnovaBulkData ? (
              <span className="mobile-district-source-info mobile-district-source-info--enova">
                *Energiforbruket for din bolig er hentet fra registrert energiattest.
              </span>
            ) : (
              <span className="mobile-district-source-info mobile-district-source-info--estimated">
                *Energiforbruket for din bolig er estimert basert på byggeår og areal.
              </span>
            )}
            <span className="mobile-district-data-source">
              Kilde: Enova energimerkeregisteret
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileDistrictComparison;

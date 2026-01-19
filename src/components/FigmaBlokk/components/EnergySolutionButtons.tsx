import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PktButton, PktCheckbox, PktIcon } from '@oslokommune/punkt-react';
import { ENERGY_SOLUTIONS } from '../constants';
import { AddressLookupResponse } from '../../../services/buildingApi';
import { useTiltakCatalog } from '../../../hooks/contentHooks';
import type { TiltakCatalogItem } from '../../../types/contentCatalog';
import {
  calculateCombinedSavings,
  getRateForTiltak,
  hasEnergyEffect,
  type TiltakSavingsInfo,
  type TekPeriodInput,
  type Boligtype,
} from '../../../utils/energySavingsData';
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateTEK } from '../../../utils/tekEnergyCalculations';
import { getCanonicalKey, type TiltakCanonicalKey } from '../utils/tiltakCanonicalKeys';
import type { ContentAudience } from '../../../../content/schema-helpers';
import './EnergySolutionButtons.css';

const ENERGY_RATING_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

const isRatingBetter = (first: string, second: string): boolean => {
  const index1 = ENERGY_RATING_ORDER.indexOf(first.toUpperCase() as typeof ENERGY_RATING_ORDER[number]);
  const index2 = ENERGY_RATING_ORDER.indexOf(second.toUpperCase() as typeof ENERGY_RATING_ORDER[number]);
  if (index1 === -1 || index2 === -1) {
    return false;
  }
  return index1 < index2;
};

/**
 * Mapper bygningstypekode og -navn til katalog-byggtypenøkkel.
 * Returnerer undefined hvis bygningstypen ikke kan bestemmes.
 */
const determineBuildingTypeKey = (
  buildingTypeCode: string,
  buildingTypeNameLower: string
): string | undefined => {
  // Enebolig og småhus (kode 11)
  if (buildingTypeCode === '11' || buildingTypeNameLower.includes('enebolig')) {
    return 'enebolig';
  }
  // Tomannsbolig (kode 12)
  if (buildingTypeCode === '12' || buildingTypeNameLower.includes('tomannsbolig')) {
    return 'tomannsbolig';
  }
  // Rekkehus og kjedet (kode 13)
  if (
    buildingTypeCode === '13' ||
    buildingTypeNameLower.includes('rekkehus') ||
    buildingTypeNameLower.includes('kjedehus') ||
    buildingTypeNameLower.includes('kjedet')
  ) {
    return 'rekkehus';
  }
  // Blokk og leilighetsbygg (kode 14-17)
  if (
    ['14', '15', '16', '17'].includes(buildingTypeCode) ||
    buildingTypeNameLower.includes('blokk') ||
    buildingTypeNameLower.includes('leilighet') ||
    buildingTypeNameLower.includes('boligbygg')
  ) {
    return 'blokk';
  }
  return undefined;
};

/**
 * Filtrer tiltak basert på byggtype, byggår og energieffekt.
 * - visibleForBuildingTypes: Tom array = vis for alle. Ellers vis kun for angitte byggtyper.
 * - minBuildingYear: Vis kun for bygg bygget FØR dette året.
 * - Skjuler tiltak der alle tre rates er 100% (ingen effekt) for den aktuelle TEK-standarden.
 */
const filterTiltakForBuilding = (
  tiltak: TiltakCatalogItem[],
  buildingTypeKey: string | undefined,
  buildingYear: number | undefined,
  tekPeriod: TekPeriodInput | null,
  boligtype: Boligtype | null,
  erPaaGulListe: boolean
): TiltakCatalogItem[] => {
  return tiltak.filter((t) => {
    // Byggtype-filter
    const buildingTypeMatch =
      t.visibleForBuildingTypes.length === 0 || // Tom = vis for alle
      (buildingTypeKey && t.visibleForBuildingTypes.includes(buildingTypeKey));

    // Byggår-filter: vis kun for bygg bygget FØR minBuildingYear
    const buildingYearMatch =
      t.minBuildingYear === undefined || // Ingen filter = vis alltid
      (buildingYear !== undefined && buildingYear < t.minBuildingYear);

    // Energieffekt-filter: skjul tiltak uten effekt for denne TEK-standarden
    // Unntak: Solenergi har alltid effekt (det er produksjon, ikke besparelse)
    let energyEffectMatch = true;
    if (tekPeriod && boligtype && t.title !== 'Solenergi') {
      const rates = getRateForTiltak(t.title, tekPeriod, boligtype, erPaaGulListe);
      if (rates !== null && !hasEnergyEffect(rates)) {
        energyEffectMatch = false; // Skjul tiltak uten effekt
      }
    }

    return buildingTypeMatch && buildingYearMatch && energyEffectMatch;
  });
};

interface EnergySolutionButtonsProps {
  showHeader: boolean;
  isExpanded: boolean;
  onExpand: (expanded: boolean) => void;
  onSelectSolution: (solution: string) => void;
  buildingData?: AddressLookupResponse;
  yearlyConsumption?: string;
  onTotalSavingsChange?: (savings: number) => void;
  /** Callback when tiltak selection changes. Uses canonical keys (not display titles) for stability. */
  onSelectionChange?: (activeTiltak: TiltakCanonicalKey[], finalRating?: string | null) => void;
  /** Audience for tiltak content - determines gul liste status */
  audience?: ContentAudience;
}

export const EnergySolutionButtons: React.FC<EnergySolutionButtonsProps> = ({ showHeader, isExpanded, onExpand, onSelectSolution, buildingData, yearlyConsumption = '', onTotalSavingsChange, onSelectionChange, audience = 'standard' }) => {
  // Utled gul liste-status fra audience prop (FigmaMainScript er "single source of truth" via PBE-oppslag)
  const erPaaGulListe = audience === 'gulliste';
  // Animasjoner (fadeIn, slideUpFadeIn) er definert i EnergySolutionButtons.css
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Scrollbar-refs og state
  const scrollContainerRef = useRef<HTMLUListElement>(null);
  const [hasScroll, setHasScroll] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  // Hent tiltakskatalog dynamisk
  const { data: catalogData, isLoading: isCatalogLoading } = useTiltakCatalog();

  const bruksareal = React.useMemo(() => {
    const candidate = typeof buildingData?.bruksarealM2 === 'number'
      ? buildingData.bruksarealM2
      : buildingData?.csvData?.bruksareal_totalt
        ? Number(buildingData.csvData.bruksareal_totalt)
        : undefined;

    if (candidate && !Number.isNaN(candidate) && candidate > 0) {
      return candidate;
    }
    return undefined;
  }, [buildingData]);

  const buildingTypeCode = React.useMemo(() => {
    return (
      buildingData?.bygningstypeKode?.substring(0, 2) ||
      buildingData?.csvData?.bygningstypekode?.substring(0, 2) ||
      ''
    );
  }, [buildingData]);

  const buildingTypeName = React.useMemo(() => {
    return buildingData?.bygningstype || buildingData?.csvData?.bygningstype || '';
  }, [buildingData]);

  const buildingTypeNameLower = React.useMemo(() => buildingTypeName.toLowerCase(), [buildingTypeName]);

  // Bestem byggtype-nøkkel for katalog-filtrering
  const buildingTypeKey = useMemo(() => {
    return determineBuildingTypeKey(buildingTypeCode, buildingTypeNameLower);
  }, [buildingTypeCode, buildingTypeNameLower]);

  // Hent byggeår fra building data
  const buildingYear = useMemo(() => {
    const candidate = typeof buildingData?.byggeaar === 'number'
      ? buildingData.byggeaar
      : buildingData?.csvData?.byggeaar
        ? Number(buildingData.csvData.byggeaar)
        : undefined;

    if (candidate && !Number.isNaN(candidate) && candidate > 0) {
      return candidate;
    }
    return undefined;
  }, [buildingData]);

  // TEK-periode for energibesparelses-oppslag (moved up to use in filteredTiltak)
  const tekPeriod = React.useMemo(() => {
    const byggeaarCandidate = typeof buildingData?.byggeaar === 'number'
      ? buildingData.byggeaar
      : buildingData?.csvData?.byggeaar
        ? Number(buildingData.csvData.byggeaar)
        : undefined;

    if (!byggeaarCandidate) return null;
    return calculateTEK(byggeaarCandidate) as TekPeriodInput;
  }, [buildingData]);

  const isBlokk = React.useMemo(() => {
    return ['14', '15', '16', '17'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('blokk') ||
      buildingTypeNameLower.includes('leilighet') ||
      buildingTypeNameLower.includes('boligbygg') ||
      buildingTypeNameLower === 'store boligbygg';
  }, [buildingTypeCode, buildingTypeNameLower]);

  // Boligtype for energibesparelses-beregninger (småhus eller blokk)
  const boligtype: Boligtype | null = React.useMemo(() => {
    if (buildingTypeKey) {
      if (['enebolig', 'tomannsbolig', 'rekkehus'].includes(buildingTypeKey)) {
        return 'småhus';
      }
      if (buildingTypeKey === 'blokk') {
        return 'blokk';
      }
    }
    if (['11', '12', '13'].includes(buildingTypeCode)) {
      return 'småhus';
    }
    if (isBlokk) {
      return 'blokk';
    }
    return null;
  }, [buildingTypeKey, buildingTypeCode, isBlokk]);

  // Filtrer tiltak fra katalog basert på byggtype, byggår og energieffekt
  const filteredTiltak = useMemo(() => {
    if (!catalogData?.items || catalogData.items.length === 0) {
      return [];
    }

    // Filtrer bare publiserte tiltak (ikke drafts)
    const publishedTiltak = catalogData.items.filter(
      (t) => t.status === 'published'
    );

    return filterTiltakForBuilding(publishedTiltak, buildingTypeKey, buildingYear, tekPeriod, boligtype, erPaaGulListe);
  }, [catalogData, buildingTypeKey, buildingYear, tekPeriod, boligtype, erPaaGulListe]);

  // Dynamisk tiltak-liste: bruk katalog hvis tilgjengelig, ellers fallback til ENERGY_SOLUTIONS
  // Each item includes a canonicalKey for stable SVG overlay matching
  const displayTiltak: Array<{ id: string; title: string; canonicalKey: TiltakCanonicalKey | null }> = useMemo(() => {
    if (isCatalogLoading || filteredTiltak.length === 0) {
      // Fallback til hardkodede tiltak mens katalog lastes eller er tom
      return ENERGY_SOLUTIONS.map((title, index) => ({
        id: `fallback-${index}`,
        title: title as string,
        canonicalKey: getCanonicalKey(undefined, title as string)
      }));
    }

    return filteredTiltak.map((t) => ({
      id: t.id,
      title: t.title,
      canonicalKey: getCanonicalKey(t.id, t.title)
    }));
  }, [isCatalogLoading, filteredTiltak]);

  const enovaRating = buildingData?.energiattest?.energikarakter?.toUpperCase();

  const calculatedRating = React.useMemo(() => {
    const consumptionNum = parseFloat(yearlyConsumption);
    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0 || !bruksareal) {
      return null;
    }

    const intensity = consumptionNum / bruksareal;
    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('enebolig') ||
      buildingTypeNameLower.includes('tomannsbolig') ||
      buildingTypeNameLower.includes('rekkehus') ||
      buildingTypeNameLower.includes('kjedehus');

    const isBlokkCandidate = ['14', '15', '16', '17'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('blokk') ||
      buildingTypeNameLower.includes('leilighet') ||
      buildingTypeNameLower.includes('boligbygg') ||
      buildingTypeNameLower === 'store boligbygg';

    let rating = 'G';
    if (isSmåhus) {
      if (intensity <= 95 + 800 / bruksareal) rating = 'A';
      else if (intensity <= 120 + 1600 / bruksareal) rating = 'B';
      else if (intensity <= 145 + 2500 / bruksareal) rating = 'C';
      else if (intensity <= 175 + 4100 / bruksareal) rating = 'D';
      else if (intensity <= 205 + 5800 / bruksareal) rating = 'E';
      else if (intensity <= 250 + 8000 / bruksareal) rating = 'F';
    } else if (isBlokkCandidate) {
      if (intensity <= 85 + 600 / bruksareal) rating = 'A';
      else if (intensity <= 95 + 1000 / bruksareal) rating = 'B';
      else if (intensity <= 100 + 1500 / bruksareal) rating = 'C';
      else if (intensity <= 135 + 2200 / bruksareal) rating = 'D';
      else if (intensity <= 160 + 3000 / bruksareal) rating = 'E';
      else if (intensity <= 200 + 4000 / bruksareal) rating = 'F';
    } else {
      if (intensity <= 90 + 700 / bruksareal) rating = 'A';
      else if (intensity <= 107.5 + 1300 / bruksareal) rating = 'B';
      else if (intensity <= 122.5 + 2000 / bruksareal) rating = 'C';
      else if (intensity <= 155 + 3150 / bruksareal) rating = 'D';
      else if (intensity <= 182.5 + 4400 / bruksareal) rating = 'E';
      else if (intensity <= 225 + 6000 / bruksareal) rating = 'F';
    }

    return rating;
  }, [yearlyConsumption, bruksareal, buildingTypeCode, buildingTypeNameLower]);

  const estimatedRating = enovaRating || calculatedRating;

  // Beregn estimert årlig energiforbruk basert på byggeår og areal (for bruk i prosent-beregninger)
  const estimatedAnnualConsumption = React.useMemo(() => {
    const byggeaarCandidate = typeof buildingData?.byggeaar === 'number'
      ? buildingData.byggeaar
      : buildingData?.csvData?.byggeaar
        ? Number(buildingData.csvData.byggeaar)
        : undefined;

    const buildingType = determineBuildingType(
      buildingData?.bygningstypeKode || buildingData?.csvData?.bygningstypekode,
      buildingData?.bygningstype || buildingData?.csvData?.bygningstype
    );

    return calculateAnnualEnergyConsumption(byggeaarCandidate, bruksareal, buildingType);
  }, [buildingData, bruksareal]);

    // Beregn kombinert besparelse med multiplikativ metode
  const totalSavingsKWh = React.useMemo(() => {
    if (checkedItems.size === 0 || !boligtype || !tekPeriod) {
      return 0;
    }

    // Bruk yearlyConsumption hvis tilgjengelig, ellers estimert forbruk
    const consumptionNum = yearlyConsumption ? parseFloat(yearlyConsumption) : estimatedAnnualConsumption;
    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0) {
      return 0;
    }

    // Bygg liste med tiltak og deres rates for multiplikativ beregning
    const tiltakInfo: TiltakSavingsInfo[] = [];

    checkedItems.forEach((tiltakId) => {
      const tiltak = displayTiltak.find((t) => t.id === tiltakId);
      if (!tiltak) return;

      // Solenergi håndteres spesielt - det er produksjon, ikke besparelse
      if (tiltak.title === 'Solenergi') {
        const solarEnergy = buildingData?.filteredSolarEnergy || 0;
        if (solarEnergy > 0) {
          tiltakInfo.push({
            title: tiltak.title,
            rates: null,
            solarProductionKwh: solarEnergy
          });
        }
      } else {
        // Hent rates for dette tiltaket (romoppvarming, tappevann, elspesifikt)
        const rates = getRateForTiltak(tiltak.title, tekPeriod, boligtype);
        if (rates !== null) {
          tiltakInfo.push({
            title: tiltak.title,
            rates
          });
        }
      }
    });

    // Bruk den sentrale multiplikative beregningen med forbruksfordeling per energitype
    return calculateCombinedSavings(consumptionNum, tiltakInfo, tekPeriod, boligtype, bruksareal);
  }, [
    boligtype,
    bruksareal,
    buildingData?.filteredSolarEnergy,
    checkedItems,
    displayTiltak,
    estimatedAnnualConsumption,
    tekPeriod,
    yearlyConsumption,
  ]);

  const newRating = React.useMemo(() => {
    if (!estimatedRating || !yearlyConsumption || checkedItems.size === 0 || !bruksareal) {
      return null;
    }

    const consumptionNum = parseFloat(yearlyConsumption);
    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0) {
      return null;
    }

    const newConsumption = Math.max(0, consumptionNum - totalSavingsKWh);
    const newIntensity = newConsumption / bruksareal;

    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('enebolig') ||
      buildingTypeNameLower.includes('tomannsbolig') ||
      buildingTypeNameLower.includes('rekkehus') ||
      buildingTypeNameLower.includes('kjedehus');

    const isBlokkCandidate = ['14', '15', '16', '17'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('blokk') ||
      buildingTypeNameLower.includes('leilighet') ||
      buildingTypeNameLower.includes('boligbygg') ||
      buildingTypeNameLower === 'store boligbygg';

    let rating = 'G';
    if (isSmåhus) {
      if (newIntensity <= 95 + 800 / bruksareal) rating = 'A';
      else if (newIntensity <= 120 + 1600 / bruksareal) rating = 'B';
      else if (newIntensity <= 145 + 2500 / bruksareal) rating = 'C';
      else if (newIntensity <= 175 + 4100 / bruksareal) rating = 'D';
      else if (newIntensity <= 205 + 5800 / bruksareal) rating = 'E';
      else if (newIntensity <= 250 + 8000 / bruksareal) rating = 'F';
    } else if (isBlokkCandidate) {
      if (newIntensity <= 85 + 600 / bruksareal) rating = 'A';
      else if (newIntensity <= 95 + 1000 / bruksareal) rating = 'B';
      else if (newIntensity <= 100 + 1500 / bruksareal) rating = 'C';
      else if (newIntensity <= 135 + 2200 / bruksareal) rating = 'D';
      else if (newIntensity <= 160 + 3000 / bruksareal) rating = 'E';
      else if (newIntensity <= 200 + 4000 / bruksareal) rating = 'F';
    } else {
      if (newIntensity <= 90 + 700 / bruksareal) rating = 'A';
      else if (newIntensity <= 107.5 + 1300 / bruksareal) rating = 'B';
      else if (newIntensity <= 122.5 + 2000 / bruksareal) rating = 'C';
      else if (newIntensity <= 155 + 3150 / bruksareal) rating = 'D';
      else if (newIntensity <= 182.5 + 4400 / bruksareal) rating = 'E';
      else if (newIntensity <= 225 + 6000 / bruksareal) rating = 'F';
    }

    if (estimatedRating && !isRatingBetter(rating, estimatedRating)) {
      return estimatedRating;
    }

    return rating;
  }, [
    bruksareal,
    buildingTypeCode,
    buildingTypeNameLower,
    checkedItems.size,
    estimatedRating,
    totalSavingsKWh,
    yearlyConsumption,
  ]);

  const toggleChecked = useCallback((tiltakId: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tiltakId)) {
        newSet.delete(tiltakId);
      } else {
        newSet.add(tiltakId);
      }
      return newSet;
    });
  }, []);

  // Notify parent of selection changes for tiltak animations
  // Map IDs to canonical keys so SVG components can match CSS classes (e.g., tiltak-ventilasjon)
  // Using canonical keys ensures stability even if display titles change
  useEffect(() => {
    if (onSelectionChange) {
      const activeTiltakCanonicalKeys = Array.from(checkedItems)
        .map(id => displayTiltak.find(t => t.id === id)?.canonicalKey)
        .filter((key): key is TiltakCanonicalKey => key !== undefined && key !== null);

      // Log warning in development if IDs couldn't be mapped to canonical keys
      if (process.env.NODE_ENV === 'development' && activeTiltakCanonicalKeys.length !== checkedItems.size) {
        console.warn('[EnergySolutionButtons] Some tiltak IDs could not be mapped to canonical keys:',
          Array.from(checkedItems).filter(id => !displayTiltak.find(t => t.id === id)?.canonicalKey));
      }

      onSelectionChange(activeTiltakCanonicalKeys, newRating);
    }
  }, [checkedItems, newRating, onSelectionChange, displayTiltak]);
  
  // Send total savings til parent-komponenten når den endres
  useEffect(() => {
    if (onTotalSavingsChange) {
      onTotalSavingsChange(totalSavingsKWh);
    }
  }, [onTotalSavingsChange, totalSavingsKWh]);

  // Oppdater scroll-status
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const hasScrollContent = container.scrollHeight > container.clientHeight;
      setHasScroll(hasScrollContent);

      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
      setScrolledToBottom(isAtBottom);
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [displayTiltak]);

  return (
    <div
      className="energy-solution-buttons"
      style={{
        opacity: showHeader && !isExpanded ? 1 : 0,
        transition: 'opacity 0.5s ease-in-out' + (showHeader && !isExpanded ? ' 0.5s' : isExpanded ? '' : ' 0.8s'),
        pointerEvents: showHeader && !isExpanded ? 'auto' : 'none'
      }}
    >
      
      {/* Title text with info tooltip trigger */}
      <div className="energy-solution-buttons__title-row">
        <h2
          style={{
            fontFamily: 'Oslo Sans, sans-serif',
            fontWeight: 700,
            fontStyle: 'normal',
            fontSize: '26px',
            lineHeight: '36px',
            letterSpacing: '-0.2px',
            color: 'var(--pkt-color-brand-dark-blue-1000, #2a2859)',
            margin: 0
          }}
        >
          Velg tiltak for din bolig
        </h2>
        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="information"
          aria-label="Hvordan fungerer siden?"
          onClick={() => setShowInfoModal(true)}
        />
      </div>
      {/* Scrollbar-container for tiltakslisten */}
      <div
        className={`tiltak-list-wrapper${hasScroll ? ' has-scroll' : ''}${scrolledToBottom ? ' scrolled-to-bottom' : ''}`}
      >
        <ul
          ref={scrollContainerRef}
          className="tiltak-list-container energy-solution-buttons__list"
        >
          {displayTiltak.map((tiltak) => {
            const isSelected = checkedItems.has(tiltak.id);

            return (
              <li
                key={tiltak.id}
                className={`energy-solution-buttons__item${isSelected ? ' energy-solution-buttons__item--selected' : ''}`}
              >
                <div className="energy-solution-buttons__item-content">
                  <PktCheckbox
                    id={`tiltak-${tiltak.id}`}
                    label={tiltak.title}
                    checked={isSelected}
                    onChange={() => toggleChecked(tiltak.id)}
                  />
                </div>
                <div className="energy-solution-buttons__actions">
                  <PktButton
                    skin="secondary"
                    size="small"
                    variant="label-only"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSolution(tiltak.id);
                      onExpand(true);
                    }}
                  >
                    Les mer
                  </PktButton>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Info modal - "Hvordan fungerer siden?" */}
      {showInfoModal && (
        <div className="energy-solution-buttons__modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div
            className="energy-solution-buttons__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="energy-solution-buttons__modal-close"
              onClick={() => setShowInfoModal(false)}
              aria-label="Lukk"
              type="button"
            >
              <PktIcon name="close" />
            </button>

            <h2 className="energy-solution-buttons__modal-title">
              Hvordan fungerer siden?
            </h2>

            <div className="energy-solution-buttons__modal-content">
              <h3 className="energy-solution-buttons__modal-section-title">
                Innhenting av data
              </h3>
              <p className="energy-solution-buttons__modal-paragraph">
                Informasjon om bygningen din hentes automatisk fra Matrikkelen (Norges offisielle eiendomsregister).
                Dette inkluderer bygningstype, byggeår, bruksareal (BRA) og om bygningen er på Gul liste.
              </p>

              <h3 className="energy-solution-buttons__modal-section-title energy-solution-buttons__modal-section-title--spaced">
                Energikarakter
              </h3>
              <p className="energy-solution-buttons__modal-paragraph">
                Energikarakteren viser hvor energieffektiv bygningen din er på en skala fra A til G, hvor A er best.
                Karakteren beregnes ut fra grenseverdier fra{' '}
                <a
                  href="https://www.enova.no/energimerking/karakterskalaen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="energy-solution-buttons__modal-link"
                >
                  Enova
                </a>
                {' '}for bygningens årlige energiforbruk per kvadratmeter (kWh/m²/år).
              </p>

              <p className="energy-solution-buttons__modal-paragraph">
                {enovaRating ? (
                  isBlokk ? (
                    <>Blokkens energiforbruk beregnes fra energikarakteren til en av leilighetene. Deretter brukes de samme grenseverdiene fra Enova for å beregne energiforbruket for hele blokken basert på blokkens bruksareal.</>
                  ) : (
                    <>Din nåværende energikarakter og energiforbruk er hentet direkte fra bygningens energiattest registrert hos Enova.</>
                  )
                ) : (
                  <>Siden bygningen ikke har en registrert energiattest, estimeres energiforbruket basert på byggeår og gjeldende teknisk forskrift (TEK) ved byggeåret. Vi bruker deretter de samme grenseverdiene fra Enova for å beregne en estimert energikarakter.</>
                )}
              </p>

              <h3 className="energy-solution-buttons__modal-section-title energy-solution-buttons__modal-section-title--spaced">
                Beregning av besparelser
              </h3>
              <p className="energy-solution-buttons__modal-paragraph">
                Besparelsene beregnes fra datasett som gir estimert besparelse basert på bygningstype, bruksareal (BRA) og
                teknisk forskrift (TEK). Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som gjør at det ikke blir tatt hensyn til om bygget har tidligere blitt oppgradert.
              </p>
              <p className="energy-solution-buttons__modal-paragraph">
                For solenergi hentes data fra Oslo kommunes{' '}
                <a
                  href="https://od2.pbe.oslo.kommune.no/solkart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="energy-solution-buttons__modal-link"
                >
                  Solkart
                </a>
                . Alle takflater med solpotensial over 800 kWh/m² summeres og multipliseres. Deretter antas det at 85% av takarealet kan utnyttes til solceller, og at solcellene har en virkningsgrad på 20%.
              </p>

              <p className="energy-solution-buttons__modal-note">
                Merk: Alle beregninger er estimater. Faktiske besparelser varierer ut ifra mange forskjellige faktorer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  PktButton,
  PktCheckbox,
  PktTag,
  PktIcon,
} from '@oslokommune/punkt-react';
import { AddressLookupResponse } from '../../services/buildingApi';
import { EneboligSvg, BlokkSvg } from '../FigmaBlokk/components/BuildingSprites';
import { useTiltakCatalog } from '../../hooks/contentHooks';
import type { TiltakCatalogItem } from '../../types/contentCatalog';
import { OsloLogo } from '../FigmaBlokk/components/OsloLogo';
import { ENERGY_SOLUTIONS } from '../FigmaBlokk/constants';
import { MobileInfoBox } from './MobileInfoBox';
import { MobileSavingsFooter } from './MobileSavingsFooter';
import { calculateAnnualEnergyConsumption } from '../../utils/tekEnergyCalculations';
import './MobileEnergySolutions.css';

// Energy rating types and constants
const ENERGY_RATING_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

// Besparelsesdata per TEK-periode og byggkategori (kWh/m² per tiltak)
type EnergySavingsLookup = Record<string | number, Record<'småhus' | 'blokk', Record<string | number, number>>>;

const ENERGY_SAVINGS_DATA: EnergySavingsLookup = {
  eldre: {
    blokk: { 0.75: 38.9, 1.2: 32.1, etteriso_yttervegg: 81.7, etteriso_takloft: 24.4 },
    småhus: { 0.75: 42.2, 1.2: 34.3, etteriso_yttervegg: 94.1, etteriso_takloft: 41.2 },
  },
  49: {
    blokk: { 0.75: 38.9, 1.2: 32.1, etteriso_yttervegg: 81.7, etteriso_takloft: 24.4 },
    småhus: { 0.75: 42.2, 1.2: 34.3, etteriso_yttervegg: 94.1, etteriso_takloft: 41.2 },
  },
  69: {
    blokk: { 0.75: 38.3, 1.2: 31.3, etteriso_yttervegg: 39.7, etteriso_takloft: 8.4 },
    småhus: { 0.75: 41.7, 1.2: 33.7, etteriso_yttervegg: 27.7, etteriso_takloft: 11.4 },
  },
  87: {
    blokk: { 0.75: 28.1, 1.2: 21, etteriso_yttervegg: 9.7, etteriso_takloft: 2.8 },
    småhus: { 0.75: 31.4, 1.2: 23.4, etteriso_yttervegg: 15, etteriso_takloft: 4.7 },
  },
  97: {
    blokk: { 0.75: 12.1, 1.2: 5, etteriso_yttervegg: 7.3, etteriso_takloft: 0.4 },
    småhus: { 0.75: 14.2, 1.2: 6.1, etteriso_yttervegg: 3.7, etteriso_takloft: 0.6 },
  },
  7: {
    blokk: { 0.75: 7.2, 1.2: 0, etteriso_yttervegg: 1.3, etteriso_takloft: 0.4 },
    småhus: { 0.75: 8.2, 1.2: 0, etteriso_yttervegg: 0, etteriso_takloft: 0 },
  },
};

/**
 * Bestem TEK-periode basert på byggeår
 */
const determineTek = (byggeaar: number): string => {
  const threshold = 2;
  if (byggeaar >= 2007 + threshold) return 'TEK7';
  if (byggeaar >= 1997 + threshold) return 'TEK97';
  if (byggeaar >= 1987 + threshold) return 'TEK87';
  if (byggeaar >= 1969 + threshold) return 'TEK69';
  if (byggeaar >= 1949 + threshold) return 'TEK49';
  return 'eldre';
};

const ENERGY_RATING_COLORS: Record<string, string> = {
  A: '#097E3E',
  B: '#32A548',
  C: '#96C133',
  D: '#EFE61E',
  E: '#F7AD24',
  F: '#EA6927',
  G: '#E31829',
};

/**
 * Sjekk om første rating er bedre enn andre (A er best, G er dårligst)
 */
const isRatingBetter = (first: string, second: string): boolean => {
  const index1 = ENERGY_RATING_ORDER.indexOf(first.toUpperCase() as typeof ENERGY_RATING_ORDER[number]);
  const index2 = ENERGY_RATING_ORDER.indexOf(second.toUpperCase() as typeof ENERGY_RATING_ORDER[number]);
  if (index1 === -1 || index2 === -1) {
    return false;
  }
  return index1 < index2;
};

/**
 * Beregn energikarakter basert på kWh/m² og byggtype
 */
const calculateEnergyRating = (
  intensity: number,
  bruksareal: number,
  isSmåhus: boolean,
  isBlokk: boolean
): string => {
  let rating = 'G';

  if (isSmåhus) {
    if (intensity <= 95 + 800 / bruksareal) rating = 'A';
    else if (intensity <= 120 + 1600 / bruksareal) rating = 'B';
    else if (intensity <= 145 + 2500 / bruksareal) rating = 'C';
    else if (intensity <= 175 + 4100 / bruksareal) rating = 'D';
    else if (intensity <= 205 + 5800 / bruksareal) rating = 'E';
    else if (intensity <= 250 + 8000 / bruksareal) rating = 'F';
  } else if (isBlokk) {
    if (intensity <= 85 + 600 / bruksareal) rating = 'A';
    else if (intensity <= 95 + 1000 / bruksareal) rating = 'B';
    else if (intensity <= 100 + 1500 / bruksareal) rating = 'C';
    else if (intensity <= 135 + 2200 / bruksareal) rating = 'D';
    else if (intensity <= 160 + 3000 / bruksareal) rating = 'E';
    else if (intensity <= 200 + 4000 / bruksareal) rating = 'F';
  } else {
    // Default/andre byggtyper
    if (intensity <= 90 + 700 / bruksareal) rating = 'A';
    else if (intensity <= 107.5 + 1300 / bruksareal) rating = 'B';
    else if (intensity <= 122.5 + 2000 / bruksareal) rating = 'C';
    else if (intensity <= 155 + 3150 / bruksareal) rating = 'D';
    else if (intensity <= 182.5 + 4400 / bruksareal) rating = 'E';
    else if (intensity <= 225 + 6000 / bruksareal) rating = 'F';
  }

  return rating;
};

interface MobileEnergySolutionsProps {
  searchAddress: string;
  buildingData: AddressLookupResponse;
  onBack: () => void;
  onSelectTiltak: (tiltakId: string, savingsKwh?: number) => void;
  yearlyConsumption?: string;
  estimatedRating?: string | null;
  solarData?: { filteredSolarEnergy?: number } | null;
  mapCoordinates?: { lat: number; lng: number } | null;
  showYellowBox?: boolean;
  totalEnergySavings?: number;
}

/**
 * Bestem byggtype-nøkkel for katalog-filtrering
 */
const determineBuildingTypeKey = (
  buildingTypeCode: string,
  buildingTypeNameLower: string
): string | undefined => {
  if (buildingTypeCode === '11' || buildingTypeNameLower.includes('enebolig')) {
    return 'enebolig';
  }
  if (buildingTypeCode === '12' || buildingTypeNameLower.includes('tomannsbolig')) {
    return 'tomannsbolig';
  }
  if (
    buildingTypeCode === '13' ||
    buildingTypeNameLower.includes('rekkehus') ||
    buildingTypeNameLower.includes('kjedehus') ||
    buildingTypeNameLower.includes('kjedet')
  ) {
    return 'rekkehus';
  }
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
 * Filtrer tiltak basert på byggtype og byggår
 */
const filterTiltakForBuilding = (
  tiltak: TiltakCatalogItem[],
  buildingTypeKey: string | undefined,
  buildingYear: number | undefined
): TiltakCatalogItem[] => {
  return tiltak.filter((t) => {
    const buildingTypeMatch =
      t.visibleForBuildingTypes.length === 0 ||
      (buildingTypeKey && t.visibleForBuildingTypes.includes(buildingTypeKey));

    const buildingYearMatch =
      t.minBuildingYear === undefined ||
      (buildingYear !== undefined && buildingYear < t.minBuildingYear);

    return buildingTypeMatch && buildingYearMatch;
  });
};

export const MobileEnergySolutions: React.FC<MobileEnergySolutionsProps> = ({
  searchAddress,
  buildingData,
  onBack,
  onSelectTiltak,
  yearlyConsumption = '',
  estimatedRating,
  solarData,
  mapCoordinates = null,
  showYellowBox = false,
  totalEnergySavings = 0,
}) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showEnergyInfo, setShowEnergyInfo] = useState(false);
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const tiltakSectionRef = useRef<HTMLDivElement>(null);

  // Hent tiltakskatalog dynamisk
  const { data: catalogData, isLoading: isCatalogLoading } = useTiltakCatalog();

  // Bygningstypedata
  const buildingTypeCode = useMemo(() => {
    return (
      buildingData?.bygningstypeKode?.substring(0, 2) ||
      buildingData?.csvData?.bygningstypekode?.substring(0, 2) ||
      ''
    );
  }, [buildingData]);

  const buildingTypeName = useMemo(() => {
    return buildingData?.bygningstype || buildingData?.csvData?.bygningstype || '';
  }, [buildingData]);

  const buildingTypeNameLower = useMemo(() => buildingTypeName.toLowerCase(), [buildingTypeName]);

  const buildingTypeKey = useMemo(() => {
    return determineBuildingTypeKey(buildingTypeCode, buildingTypeNameLower);
  }, [buildingTypeCode, buildingTypeNameLower]);

  const buildingYear = useMemo(() => {
    const candidate =
      typeof buildingData?.byggeaar === 'number'
        ? buildingData.byggeaar
        : buildingData?.csvData?.byggeaar
          ? Number(buildingData.csvData.byggeaar)
          : undefined;

    if (candidate && !Number.isNaN(candidate) && candidate > 0) {
      return candidate;
    }
    return undefined;
  }, [buildingData]);

  // Bruksareal - sjekk flere mulige feltnavn
  const bruksareal = useMemo(() => {
    const bra =
      buildingData?.bruksarealM2 ||
      buildingData?.bruksareal ||
      buildingData?.csvData?.bruksareal_totalt ||
      buildingData?.csvData?.bruksareal;
    if (bra && !Number.isNaN(Number(bra))) {
      return Number(bra);
    }
    return undefined;
  }, [buildingData]);

  // Er dette en blokk?
  const isBlokk = useMemo(() => {
    return (
      ['14', '15', '16', '17'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('blokk') ||
      buildingTypeNameLower.includes('leilighet') ||
      buildingTypeNameLower.includes('boligbygg') ||
      buildingTypeNameLower === 'store boligbygg'
    );
  }, [buildingTypeCode, buildingTypeNameLower]);

  // Beregn årlig energiforbruk hvis ikke oppgitt
  const calculatedYearlyConsumption = useMemo(() => {
    // Bruk prop hvis oppgitt
    if (yearlyConsumption) {
      return yearlyConsumption;
    }

    // Sjekk om vi har energiattest-data
    const enovaConsumption = buildingData?.energiattest?.registering?.beregnetLevertEnergiTotaltkWh;
    if (enovaConsumption) {
      return String(enovaConsumption);
    }

    // Beregn basert på byggeår og bruksareal
    if (buildingYear && bruksareal) {
      const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode) ||
        buildingTypeNameLower.includes('enebolig') ||
        buildingTypeNameLower.includes('tomannsbolig') ||
        buildingTypeNameLower.includes('rekkehus') ||
        buildingTypeNameLower.includes('kjedehus');

      const buildingType = isSmåhus ? 'småhus' : 'blokk';
      const consumption = calculateAnnualEnergyConsumption(buildingYear, bruksareal, buildingType);
      return String(consumption);
    }

    return '';
  }, [yearlyConsumption, buildingData, buildingYear, bruksareal, buildingTypeCode, buildingTypeNameLower]);

  // Beregn besparelse for en kategori
  const calculateSavingsForCategory = useCallback(
    (buildingCategory: 'småhus' | 'blokk', measure: string, tek: string): number => {
      const tekNumber = tek.startsWith('TEK') ? Number.parseInt(tek.substring(3), 10) : tek;
      const tekKey = Number.isNaN(Number(tekNumber)) ? tek : tekNumber;
      const savingsData = ENERGY_SAVINGS_DATA[tekKey];
      if (!savingsData || !bruksareal) {
        return 0;
      }

      if (measure === 'Oppgradering av vindu' || measure === 'Oppgradering av vinduer') {
        return (savingsData[buildingCategory][0.75] || 0) * bruksareal;
      }
      if (measure === 'Etterisolering av yttervegg') {
        return (savingsData[buildingCategory].etteriso_yttervegg || 0) * bruksareal;
      }
      if (measure === 'Isolering av kjeller og loft' || measure === 'Etterisolering av kjeller og loft') {
        return (savingsData[buildingCategory].etteriso_takloft || 0) * bruksareal;
      }

      return 0;
    },
    [bruksareal]
  );

  // Beregn besparelse for et tiltak
  const calculateSavings = useCallback(
    (measure: string): number => {
      // Solenergi har egen beregning - bruk solarData prop eller buildingData som fallback
      if (measure === 'Solenergi') {
        return solarData?.filteredSolarEnergy || buildingData?.filteredSolarEnergy || 0;
      }

      if (!buildingYear || !calculatedYearlyConsumption) {
        return 0;
      }

      const tek = determineTek(buildingYear);
      const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode);
      const buildingCategory = isSmåhus ? 'småhus' : isBlokk ? 'blokk' : null;

      if (!buildingCategory) {
        // Fallback til string matching
        if (
          buildingTypeNameLower.includes('enebolig') ||
          buildingTypeNameLower.includes('tomannsbolig') ||
          buildingTypeNameLower.includes('rekkehus') ||
          buildingTypeNameLower.includes('kjedehus')
        ) {
          return calculateSavingsForCategory('småhus', measure, tek);
        } else if (
          buildingTypeNameLower.includes('blokk') ||
          buildingTypeNameLower.includes('leilighet') ||
          buildingTypeNameLower.includes('boligbygg')
        ) {
          return calculateSavingsForCategory('blokk', measure, tek);
        }
        return 0;
      }

      return calculateSavingsForCategory(buildingCategory, measure, tek);
    },
    [
      buildingData?.filteredSolarEnergy,
      buildingTypeCode,
      buildingTypeNameLower,
      buildingYear,
      calculateSavingsForCategory,
      isBlokk,
      solarData,
      calculatedYearlyConsumption,
    ]
  );

  // Beregn total besparelse basert på valgte tiltak
  const [calculatedSavings, setCalculatedSavings] = useState(0);

  // Filtrer tiltak fra katalog
  const filteredTiltak = useMemo(() => {
    if (!catalogData?.items || catalogData.items.length === 0) {
      return [];
    }

    const publishedTiltak = catalogData.items.filter((t) => t.status === 'published');
    return filterTiltakForBuilding(publishedTiltak, buildingTypeKey, buildingYear);
  }, [catalogData, buildingTypeKey, buildingYear]);

  // Dynamisk tiltak-liste: bruk katalog hvis tilgjengelig, ellers fallback til ENERGY_SOLUTIONS
  const displayTiltak: Array<{ id: string; title: string }> = useMemo(() => {
    if (isCatalogLoading || filteredTiltak.length === 0) {
      // Fallback til hardkodede tiltak mens katalog lastes eller er tom
      return ENERGY_SOLUTIONS.map((title, index) => ({
        id: `fallback-${index}`,
        title: title as string,
      }));
    }

    return filteredTiltak.map((t) => ({
      id: t.id,
      title: t.title,
    }));
  }, [isCatalogLoading, filteredTiltak]);

  // Beregn total besparelse når valgte tiltak endres
  useEffect(() => {
    let total = 0;
    checkedItems.forEach((tiltakId) => {
      const tiltak = displayTiltak.find((t) => t.id === tiltakId);
      if (tiltak) {
        total += calculateSavings(tiltak.title);
      }
    });
    setCalculatedSavings(total);
  }, [checkedItems, displayTiltak, calculateSavings]);

  // Beregn ny energikarakter basert på valgte tiltak
  const newRating = useMemo(() => {
    // Trenger estimatedRating, yearlyConsumption, tiltak valgt og bruksareal
    if (!estimatedRating || !yearlyConsumption || checkedItems.size === 0 || !bruksareal) {
      return null;
    }

    const consumptionNum = parseFloat(yearlyConsumption);
    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0) {
      return null;
    }

    // Beregn nytt forbruk etter besparelse
    const newConsumption = Math.max(0, consumptionNum - calculatedSavings);
    const newIntensity = newConsumption / bruksareal;

    // Bestem byggtype for rating-beregning
    const isSmåhus = ['11', '12', '13'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('enebolig') ||
      buildingTypeNameLower.includes('tomannsbolig') ||
      buildingTypeNameLower.includes('rekkehus') ||
      buildingTypeNameLower.includes('kjedehus');

    const isBlokkType = ['14', '15', '16', '17'].includes(buildingTypeCode) ||
      buildingTypeNameLower.includes('blokk') ||
      buildingTypeNameLower.includes('leilighet') ||
      buildingTypeNameLower.includes('boligbygg');

    const rating = calculateEnergyRating(newIntensity, bruksareal, isSmåhus, isBlokkType);

    // Returner kun hvis bedre enn estimert
    if (!isRatingBetter(rating, estimatedRating)) {
      return null;
    }

    return rating;
  }, [
    bruksareal,
    buildingTypeCode,
    buildingTypeNameLower,
    calculatedSavings,
    checkedItems.size,
    estimatedRating,
    yearlyConsumption,
  ]);

  const toggleChecked = useCallback((tiltakId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tiltakId)) {
        newSet.delete(tiltakId);
      } else {
        newSet.add(tiltakId);
      }
      return newSet;
    });
  }, []);

  // Adresse og bydel
  const addressOnly = searchAddress.split(',')[0];
  const districtName = buildingData.csvData?.bydelsnavn || '';

  // Sjekk om footer skal vises
  const showFooter = checkedItems.size > 0 && calculatedSavings > 0;

  // Håndter scroll på tiltakslisten for å skjule scroll-indikatoren
  const handleTiltakScroll = useCallback(() => {
    if (!hasScrolled) {
      setHasScrolled(true);
    }
  }, [hasScrolled]);

  // Sjekk om listen trenger scroll (mer innhold enn synlig område)
  const [needsScrollIndicator, setNeedsScrollIndicator] = useState(false);

  useEffect(() => {
    const section = tiltakSectionRef.current;
    if (section) {
      const checkScrollable = () => {
        setNeedsScrollIndicator(section.scrollHeight > section.clientHeight + 20);
      };
      checkScrollable();
      // Sjekk på nytt når vinduet endrer størrelse
      window.addEventListener('resize', checkScrollable);
      return () => window.removeEventListener('resize', checkScrollable);
    }
  }, [displayTiltak]);

  return (
    <div className={`mobile-energy-solutions${showFooter ? ' mobile-energy-solutions--has-footer' : ''}`}>
      {/* Header med tilbake-knapp */}
      <header className="mobile-energy-solutions__header">
        <div className="mobile-energy-solutions__header-content">
          <OsloLogo className="mobile-energy-solutions__logo" />
          <span className="mobile-energy-solutions__header-title">Energinøkkelen</span>
        </div>
        <PktButton
          skin="secondary"
          size="small"
          variant="icon-left"
          iconName="arrow-return"
          onClick={onBack}
          className="mobile-energy-solutions__back-button"
        >
          <span>Tilbake</span>
        </PktButton>
      </header>

      {/* Hovedinnhold */}
      <main className="mobile-energy-solutions__main">
        {/* Adresse og nøkkelinfo - midtstilt */}
        <section className="mobile-energy-solutions__address-section">
          <h1 className="mobile-energy-solutions__address">{addressOnly}</h1>
          <div className="mobile-energy-solutions__tags">
            {districtName && (
              <PktTag skin="green">
                <span>{districtName}</span>
              </PktTag>
            )}
            {buildingTypeName && (
              <PktTag skin="blue">
                <span>{buildingTypeName}</span>
              </PktTag>
            )}
            {buildingYear && (
              <PktTag skin="beige">
                <span>Byggeår {buildingYear}</span>
              </PktTag>
            )}
          </div>
          {/* Vis mer om boligen */}
          <button
            className="mobile-energy-solutions__show-more-trigger"
            onClick={() => setShowInfoBox(true)}
            aria-label="Vis mer om boligen"
          >
            <span className="mobile-energy-solutions__show-more-text">Vis mer om boligen</span>
            <span className="mobile-energy-solutions__show-more-icon">
              <PktIcon name="chevron-thin-down" className="pkt-icon--medium" />
            </span>
          </button>
        </section>

        {/* Energiskala */}
        <section className="mobile-energy-solutions__energy-section">
          <div className="mobile-energy-solutions__energy-header">
            <div className="mobile-energy-solutions__energy-title-row">
              <h2 className="mobile-energy-solutions__section-title">
                {estimatedRating ? 'Energikarakter' : 'Beregner...'}
              </h2>
              <button
                className="mobile-energy-solutions__info-button"
                onClick={() => setShowEnergyInfo(true)}
                aria-label="Mer informasjon om energikarakter"
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M15.93 7.6C17.1356 7.5897 18.3022 8.02698 19.204 8.82721C20.1058 9.62744 20.6787 10.7337 20.8118 11.932C20.945 13.1303 20.6289 14.3354 19.9247 15.314C19.2206 16.2927 18.1785 16.9754 17 17.23H16.94V18.91H14.94V15.35H15.94C16.479 15.3516 17.0077 15.2019 17.4658 14.9179C17.924 14.634 18.2932 14.2271 18.5316 13.7437C18.77 13.2602 18.8679 12.7196 18.8142 12.1832C18.7606 11.6469 18.5574 11.1364 18.228 10.7098C17.8986 10.2831 17.456 9.95754 16.9507 9.76998C16.4453 9.58243 15.8975 9.54045 15.3695 9.64883C14.8415 9.75721 14.3545 10.0116 13.9639 10.383C13.5733 10.7545 13.2948 11.2281 13.16 11.75V11.92L11.16 11.53C11.3793 10.425 11.9741 9.42996 12.8436 8.71364C13.713 7.99731 14.8035 7.60384 15.93 7.6ZM16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.97351 8.64968 3.98957 11.0251C3.00563 13.4006 2.74818 16.0144 3.24979 18.5362C3.7514 21.0579 4.98953 23.3743 6.80761 25.1924C8.62569 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5994 28.9944 20.9749 28.0104C23.3503 27.0265 25.3806 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C29 12.5522 27.6304 9.24558 25.1924 6.80761C22.7544 4.36964 19.4478 3 16 3Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M17.65 22.38C17.648 22.7197 17.5455 23.0513 17.3553 23.3328C17.1651 23.6144 16.8958 23.8333 16.5813 23.9619C16.2669 24.0906 15.9213 24.1232 15.5884 24.0557C15.2554 23.9882 14.9498 23.8236 14.7103 23.5827C14.4707 23.3418 14.3079 23.0353 14.2424 22.7019C14.1768 22.3685 14.2114 22.0232 14.3419 21.7095C14.4724 21.3958 14.6928 21.1277 14.9755 20.9392C15.2581 20.7506 15.5902 20.65 15.93 20.65C16.3867 20.65 16.8198 20.8289 17.1498 21.1573C17.4798 21.4857 17.65 21.9233 17.65 22.38Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Energi-bokser med bygningsillustrasjon */}
          <div className="mobile-energy-solutions__energy-row">
            <div className="mobile-energy-solutions__energy-scale">
              {ENERGY_RATING_ORDER.map((letter) => {
                const isEstimated = estimatedRating === letter;
                const isNew = newRating === letter;
                const isActive = isEstimated || isNew;
                return (
                  <div
                    key={letter}
                    className={`mobile-energy-solutions__energy-box ${isActive ? 'mobile-energy-solutions__energy-box--active' : ''} ${isNew ? 'mobile-energy-solutions__energy-box--new' : ''}`}
                    style={{ backgroundColor: ENERGY_RATING_COLORS[letter] }}
                  >
                    <span>{letter}</span>
                    {isNew && (
                      <span className="mobile-energy-solutions__energy-box-label">Ny</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Bygningsillustrasjon */}
            <div className="mobile-energy-solutions__building-illustration">
              {isBlokk ? (
                <BlokkSvg className="mobile-energy-solutions__building-svg mobile-energy-solutions__building-svg--blokk" />
              ) : (
                <EneboligSvg className="mobile-energy-solutions__building-svg mobile-energy-solutions__building-svg--enebolig" />
              )}
            </div>
          </div>
          {newRating && (
            <p className="mobile-energy-solutions__energy-improvement">
              Med valgte tiltak kan du oppnå energikarakter {newRating}
            </p>
          )}
        </section>

        {/* Tiltaksliste - tittel fast, kort scrollbart */}
        <h2 className="mobile-energy-solutions__section-title mobile-energy-solutions__tiltak-title">Velg tiltak for din bolig</h2>

        <section
          className="mobile-energy-solutions__tiltak-section"
          ref={tiltakSectionRef}
          onScroll={handleTiltakScroll}
        >
          {/* Kort som inneholder alle tiltak */}
          <div className="mobile-energy-solutions__tiltak-card">
            {isCatalogLoading ? (
              <p className="mobile-energy-solutions__loading">Laster tiltak...</p>
            ) : displayTiltak.length === 0 ? (
              <p className="mobile-energy-solutions__empty">Ingen tiltak tilgjengelig for denne bygningstypen.</p>
            ) : (
              <ul className="mobile-energy-solutions__tiltak-list">
                {displayTiltak.map((tiltak, index) => (
                  <li key={tiltak.id} className={`mobile-energy-solutions__tiltak-item ${index === displayTiltak.length - 1 ? 'mobile-energy-solutions__tiltak-item--last' : ''}`}>
                    <div className="mobile-energy-solutions__tiltak-content">
                      <PktCheckbox
                        id={`tiltak-${tiltak.id}`}
                        label={tiltak.title}
                        checked={checkedItems.has(tiltak.id)}
                        onChange={() => toggleChecked(tiltak.id)}
                      />
                    </div>
                    <PktButton
                      skin="secondary"
                      size="small"
                      variant="label-only"
                      onClick={() => onSelectTiltak(tiltak.id, calculateSavings(tiltak.title))}
                      className="mobile-energy-solutions__tiltak-button"
                    >
                      Les mer
                    </PktButton>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Scroll-indikator - vises kun når listen kan scrolles og brukeren ikke har scrollet ennå */}
          {needsScrollIndicator && !hasScrolled && (
            <div className="mobile-energy-solutions__scroll-indicator">
              <PktIcon name="chevron-thin-down" className="pkt-icon--medium" />
            </div>
          )}
        </section>


      </main>

      {/* InfoBox modal - animerer nedover fra toppen */}
      {showInfoBox && (
        <div
          className="mobile-energy-solutions__infobox-overlay"
          onClick={() => setShowInfoBox(false)}
        >
          <div
            className="mobile-energy-solutions__infobox-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="mobile-energy-solutions__infobox-close"
              onClick={() => setShowInfoBox(false)}
              aria-label="Lukk"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <MobileInfoBox
              addressOnly={addressOnly}
              districtName={districtName}
              buildingTypeName={buildingTypeName}
              buildingData={buildingData}
              mapCoordinates={mapCoordinates}
              showYellowBox={showYellowBox}
              totalEnergySavings={calculatedSavings}
            />
          </div>
        </div>
      )}

      {/* Info-modal */}
      {showEnergyInfo && (
        <div
          className="mobile-energy-solutions__modal-overlay"
          onClick={() => setShowEnergyInfo(false)}
        >
          <div
            className="mobile-energy-solutions__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="mobile-energy-solutions__modal-close"
              onClick={() => setShowEnergyInfo(false)}
              aria-label="Lukk"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <h2 className="mobile-energy-solutions__modal-title">Om energikarakter</h2>
            <div className="mobile-energy-solutions__modal-content">
              <p>
                Energikarakteren viser hvor energieffektiv bygningen din er på en skala fra A til G,
                hvor A er best.
              </p>
              <p>
                Karakteren beregnes ut fra bygningens årlige energiforbruk per kvadratmeter
                (kWh/m²/år).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Besparelsesfooter - alltid synlig når tiltak er valgt */}
      <MobileSavingsFooter
        totalSavingsKwh={calculatedSavings}
        isVisible={showFooter}
      />
    </div>
  );
};

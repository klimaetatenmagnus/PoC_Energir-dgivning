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
import { calculateAnnualEnergyConsumption, determineBuildingType } from '../../utils/tekEnergyCalculations';
import { calculateTekPeriod, parseNumericValue } from '../FigmaBlokk/components/Tiltak/shared';
import {
  getEnergySavingsRate,
  getWindowEnergySavingsRate,
  calculateSavingsFromRate,
  calculateCombinedSavings,
  getRateForTiltak,
  type TiltakSavingsInfo,
  type Boligtype,
  type TekPeriodInput,
} from '../../utils/energySavingsData';
import { useGulListeStatus } from '../../hooks/useGulListeStatus';
import { useTransitionOverlay, toViewportRect } from '../../context/useTransitionOverlay';
import type { BuildingKind } from '../../context/TransitionOverlayTypes';
import { getBuildingKind } from '../../utils/buildingTypeUtils';
import './MobileEnergySolutions.css';

// Energy rating types and constants
const ENERGY_RATING_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

// Farger for energikarakter-bokser (tilgjengelig for fremtidig bruk)
const _ENERGY_RATING_COLORS: Record<string, string> = {
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
  totalEnergySavings: _totalEnergySavings = 0,
}) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [_showEnergyInfo, _setShowEnergyInfo] = useState(false); // Beholdes for fremtidig bruk i energibesparelses-boksen
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const tiltakSectionRef = useRef<HTMLDivElement>(null);
  const buildingIllustrationRef = useRef<HTMLDivElement>(null);
  const { setTargetRect, buildingType, phase: overlayPhase, finalizeTransition } = useTransitionOverlay();

  // Hide building illustration during animation phases (like desktop does)
  // During 'settling', the static illustration should be visible BEHIND the overlay
  // so when the overlay disappears, the static illustration is already in place (no blink)
  const buildingIllustrationOpacity =
    overlayPhase === 'captured' || overlayPhase === 'animating' ? 0 : 1;

  // Hent tiltakskatalog dynamisk
  const { data: catalogData, isLoading: isCatalogLoading } = useTiltakCatalog();

  // Hent gul liste-status for bygningen
  const { status: gulListeStatus } = useGulListeStatus({
    adresse: searchAddress,
  });
  const erPaaGulListe = gulListeStatus?.erPaaGulListe ?? false;

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

  // Boligtype for energibesparelses-beregninger (småhus eller blokk)
  const boligtype: Boligtype | null = useMemo(() => {
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

  // TEK-periode for energibesparelses-oppslag
  const tekPeriod: TekPeriodInput | null = useMemo(() => {
    if (!buildingYear) return null;
    return calculateTekPeriod(buildingYear);
  }, [buildingYear]);

  // Estimert årlig energiforbruk
  const estimatedAnnualConsumption = useMemo(() => {
    if (!buildingYear || !bruksareal || !boligtype) return 0;
    return calculateAnnualEnergyConsumption(buildingYear, bruksareal, boligtype);
  }, [buildingYear, bruksareal, boligtype]);

  // Beregn årlig energiforbruk hvis ikke oppgitt (brukes for energikarakter-beregning)
  const _calculatedYearlyConsumption = useMemo(() => {
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

  // Beregn besparelse for et tiltak med CSV-baserte prosentsatser
  // Returnerer null hvis besparelse ikke kan beregnes (manglende data)
  const calculateSavings = useCallback(
    (measure: string): number | null => {
      // Solenergi har egen beregning - bruk solarData prop eller buildingData som fallback
      if (measure === 'Solenergi') {
        const solarValue = solarData?.filteredSolarEnergy || buildingData?.filteredSolarEnergy;
        return solarValue && solarValue > 0 ? solarValue : null;
      }

      // Temperaturstyring - validering som matcher desktop-implementasjon
      if (measure === 'Temperaturstyring') {
        // Bruk parseNumericValue for konsistent parsing (som desktop)
        const parsedBruksareal = parseNumericValue(bruksareal);
        const parsedByggeaar = Math.trunc(parseNumericValue(buildingYear));

        // Bestem byggkategori med determineBuildingType (som desktop)
        const buildingCategory = determineBuildingType(buildingTypeCode, buildingTypeName);

        // Valider alle nødvendige inputs (matcher desktop)
        if (
          !buildingCategory ||
          !Number.isFinite(parsedByggeaar) ||
          parsedByggeaar <= 0 ||
          !Number.isFinite(parsedBruksareal) ||
          parsedBruksareal <= 0
        ) {
          return null;
        }

        // Bruk calculateTekPeriod fra shared (som desktop)
        const tekPeriod = calculateTekPeriod(parsedByggeaar);
        const originalEnergy = calculateAnnualEnergyConsumption(parsedByggeaar, parsedBruksareal, buildingCategory);
        const rate = getEnergySavingsRate('temperaturstyring', tekPeriod, buildingCategory);

        if (rate === null) {
          return null;
        }

        const totalSavings = calculateSavingsFromRate(originalEnergy, rate);
        return totalSavings > 0 ? totalSavings : null;
      }

      // Andre tiltak krever byggeår og bruksareal
      const parsedBruksareal = parseNumericValue(bruksareal);
      const parsedByggeaar = Math.trunc(parseNumericValue(buildingYear));

      if (
        !Number.isFinite(parsedByggeaar) ||
        parsedByggeaar <= 0 ||
        !Number.isFinite(parsedBruksareal) ||
        parsedBruksareal <= 0
      ) {
        return null;
      }

      // Bestem byggkategori med determineBuildingType for konsistens
      const buildingCategory = determineBuildingType(buildingTypeCode, buildingTypeName);
      if (!buildingCategory) {
        return null;
      }

      // Beregn TEK-periode og opprinnelig energiforbruk
      const tekPeriod = calculateTekPeriod(parsedByggeaar);
      const originalEnergy = calculateAnnualEnergyConsumption(parsedByggeaar, parsedBruksareal, buildingCategory);

      // Map tiltak-navn til tiltak-ID og hent prosentsats
      let rate: number | null = null;

      if (measure === 'Oppgradering av vindu' || measure === 'Oppgradering av vinduer') {
        rate = getWindowEnergySavingsRate(tekPeriod, buildingCategory, erPaaGulListe);
      } else if (measure === 'Etterisolering av yttervegg') {
        rate = getEnergySavingsRate('etterisolering_yttervegg', tekPeriod, buildingCategory);
      } else if (measure === 'Isolering av kjeller og loft' || measure === 'Etterisolering av kjeller og loft') {
        rate = getEnergySavingsRate('etterisolering_kjeller_loft', tekPeriod, buildingCategory);
      }

      if (rate === null) {
        return null;
      }

      const totalSavings = calculateSavingsFromRate(originalEnergy, rate);
      return totalSavings > 0 ? totalSavings : null;
    },
    [
      buildingData?.filteredSolarEnergy,
      buildingTypeCode,
      buildingTypeName,
      buildingYear,
      bruksareal,
      erPaaGulListe,
      solarData,
    ]
  );

  // Beregn total besparelse basert på valgte tiltak
  const [calculatedSavings, setCalculatedSavings] = useState(0);
  // Antall valgte tiltak som ikke kunne beregnes (manglende data)
  const [uncalculableCount, setUncalculableCount] = useState(0);

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

  // Beregn total besparelse med multiplikativ metode når valgte tiltak endres
  // Holder også styr på hvor mange tiltak som ikke kunne beregnes
  useEffect(() => {
    if (checkedItems.size === 0) {
      setCalculatedSavings(0);
      setUncalculableCount(0);
      return;
    }

    // Bruk yearlyConsumption hvis tilgjengelig, ellers estimert forbruk
    const consumptionNum = yearlyConsumption ? parseFloat(yearlyConsumption) : estimatedAnnualConsumption;

    // Bygg liste med tiltak og deres rates for multiplikativ beregning
    const tiltakInfo: TiltakSavingsInfo[] = [];
    let uncalculable = 0;

    checkedItems.forEach((tiltakId) => {
      const tiltak = displayTiltak.find((t) => t.id === tiltakId);
      if (!tiltak) return;

      // Solenergi håndteres spesielt - det er produksjon, ikke besparelse
      if (tiltak.title === 'Solenergi') {
        const solarValue = solarData?.filteredSolarEnergy || buildingData?.filteredSolarEnergy;
        if (solarValue && solarValue > 0) {
          tiltakInfo.push({
            title: tiltak.title,
            rate: null,
            solarProductionKwh: solarValue
          });
        } else {
          uncalculable += 1;
        }
      } else if (boligtype && tekPeriod) {
        // Hent rate for dette tiltaket
        const rate = getRateForTiltak(tiltak.title, tekPeriod, boligtype, erPaaGulListe);
        if (rate !== null) {
          tiltakInfo.push({
            title: tiltak.title,
            rate
          });
        } else {
          uncalculable += 1;
        }
      } else {
        // Mangler nødvendig data for beregning
        uncalculable += 1;
      }
    });

    // Bruk den sentrale multiplikative beregningen
    const total = calculateCombinedSavings(consumptionNum, tiltakInfo);

    setCalculatedSavings(total);
    setUncalculableCount(uncalculable);
  }, [
    boligtype,
    buildingData?.filteredSolarEnergy,
    checkedItems,
    displayTiltak,
    erPaaGulListe,
    estimatedAnnualConsumption,
    solarData?.filteredSolarEnergy,
    tekPeriod,
    yearlyConsumption,
  ]);

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
  // Viser footer hvis tiltak er valgt OG (besparelse > 0 ELLER det finnes tiltak som ikke kunne beregnes)
  const showFooter = checkedItems.size > 0 && (calculatedSavings > 0 || uncalculableCount > 0);

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

  // Reset scroll-posisjon når komponenten monteres
  // Dette forhindrer at scroll-offset fra forrige visning (f.eks. når tastatur var åpent) forplanter seg
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Register target rect for building transition animation
  // Uses shared getBuildingKind helper to ensure consistent classification with useFigmaAddressSearch
  useEffect(() => {
    if (!buildingType) return;

    // Use shared helper for consistent BuildingKind classification
    const currentBuildingKind: BuildingKind = getBuildingKind({
      bygningstypeKode: buildingTypeCode,
      csvData: { bygningstypeNavn: buildingTypeName },
    });

    // Defensive fallback: if buildingType is defined but doesn't match currentBuildingKind,
    // still register a rect for buildingType so the overlay always receives a valid targetRect
    const kindToRegister = buildingType === currentBuildingKind ? buildingType : buildingType;

    let registered = false;

    const registerRect = () => {
      if (registered) return;
      const svgEl = buildingIllustrationRef.current?.querySelector('svg');
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        setTargetRect(kindToRegister, toViewportRect(rect));
        registered = true;
      }
    };

    // Try immediately
    const rafId = requestAnimationFrame(registerRect);

    // Fallback timeout if ref isn't ready
    const timeoutId = setTimeout(() => {
      if (!registered) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            '[MobileEnergySolutions] Target rect registration delayed - using fallback rect'
          );
        }
        // Fallback rect: center of viewport with estimated size
        const fallbackRect = {
          left: window.innerWidth / 2 - 60,
          top: window.innerHeight * 0.3,
          width: 120,
          height: 150,
        };
        setTargetRect(kindToRegister, fallbackRect);
        registered = true;
      }
    }, 500);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [buildingType, buildingTypeCode, buildingTypeName, setTargetRect]);

  // Finalize transition after settling phase (like desktop does in FigmaMainScript)
  // This removes the overlay and makes the static illustration visible
  useEffect(() => {
    if (overlayPhase !== 'settling') {
      return;
    }

    // Match desktop timing for smooth handoff
    const SETTLE_DURATION_MS = 450;
    const settleTimer = window.setTimeout(() => {
      finalizeTransition();
    }, SETTLE_DURATION_MS);

    return () => window.clearTimeout(settleTimer);
  }, [overlayPhase, finalizeTransition]);

  return (
    <div
      className={`mobile-energy-solutions${showFooter ? ' mobile-energy-solutions--has-footer' : ''} mobile-energy-solutions--fade-in`}
    >
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

        {/* Tiltaksliste header - overskrift og bygningsillustrasjon på linje */}
        <div className="mobile-energy-solutions__tiltak-header">
          <h2 className="mobile-energy-solutions__section-title mobile-energy-solutions__tiltak-title">Velg tiltak for din bolig</h2>
          {/* Bygningsillustrasjon */}
          <div
            className="mobile-energy-solutions__building-illustration"
            ref={buildingIllustrationRef}
            style={{
              opacity: buildingIllustrationOpacity,
              transition: overlayPhase === 'settling' ? 'none' : undefined,
            }}
          >
            {isBlokk ? (
              <BlokkSvg id="mobile-target-blokk" className="mobile-energy-solutions__building-svg mobile-energy-solutions__building-svg--blokk" />
            ) : (
              <EneboligSvg id="mobile-target-enebolig" className="mobile-energy-solutions__building-svg mobile-energy-solutions__building-svg--enebolig" />
            )}
          </div>
        </div>

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
                      onClick={() => onSelectTiltak(tiltak.id, calculateSavings(tiltak.title) ?? undefined)}
                      className="mobile-energy-solutions__tiltak-button"
                    >
                      Les mer
                    </PktButton>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Scroll-indikator - vises kun når listen kan scrolles, brukeren ikke har scrollet, og footeren ikke vises */}
          {needsScrollIndicator && !hasScrolled && !showFooter && (
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
              <MobileInfoBox
              addressOnly={addressOnly}
              districtName={districtName}
              buildingTypeName={buildingTypeName}
              buildingData={buildingData}
              mapCoordinates={mapCoordinates}
              showYellowBox={showYellowBox}
              totalEnergySavings={calculatedSavings}
              onCollapse={() => setShowInfoBox(false)}
            />
          </div>
        </div>
      )}

      {/* Besparelsesfooter - alltid synlig når tiltak er valgt */}
      <MobileSavingsFooter
        totalSavingsKwh={calculatedSavings}
        isVisible={showFooter}
        uncalculableCount={uncalculableCount}
        estimatedRating={estimatedRating}
        newRating={newRating}
      />
    </div>
  );
};

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  PktButton,
  PktCheckbox,
  PktTag,
  PktIcon,
  PktRadioButton,
} from '@oslokommune/punkt-react';
import { AddressLookupResponse } from '../../services/buildingApi';
import {
  DISTRICT_BADGE,
  BUILDING_YEAR_BADGE,
  getBuildingTypeBadgeConfig,
  getDisplayBuildingTypeName,
} from '../../config/badgeConfig';
import '../../config/badges.css';
import { Enebolig2LayerSvg, Blokk2LayerSvg } from '../FigmaBlokk/components/BuildingSprites';
import { getCanonicalKey, type TiltakCanonicalKey } from '../FigmaBlokk/utils/tiltakCanonicalKeys';
import { useTiltakCatalog } from '../../hooks/contentHooks';
import type { TiltakCatalogItem } from '../../types/contentCatalog';
import { OsloLogo } from '../FigmaBlokk/components/OsloLogo';
import { MobileInfoBox } from './MobileInfoBox';
import { MobileSavingsFooter } from './MobileSavingsFooter';
import { MobileDistrictComparison } from './MobileDistrictComparison';
import { MobileProsessenVidere } from './MobileProsessenVidere';
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating } from '../../utils/tekEnergyCalculations';
import { calculateTekPeriod, parseNumericValue } from '../FigmaBlokk/components/Tiltak/shared';
import {
  calculateCombinedSavings,
  calculateComparisonSavings,
  getRateForTiltakId,
  hasEnergyEffect,
  type TiltakSavingsInfo,
  type Boligtype,
  type TekPeriodInput,
} from '../../utils/energySavingsData';
import type { ContentAudience } from '../../../content/schema-helpers';
import { useTransitionOverlay, toViewportRect } from '../../context/useTransitionOverlay';
import type { BuildingKind } from '../../context/TransitionOverlayTypes';
import { getBuildingKind } from '../../utils/buildingTypeUtils';
import {
  getDistrictStatistics,
  getStatsForDistrict,
  getStatsForSubdistrict,
  lookupBuildingFromEnovaData,
  type EnovaBuildingData,
} from '../../services/districtStatisticsService';
import type { DistrictStats, EnergyGrade } from '../../types/districtStatistics';
import './MobileEnergySolutions.css';

// Energy rating types and constants
const ENERGY_RATING_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

// Energy rating colors used for arrow animations
const ENERGY_RATING_COLORS: Record<string, string> = {
  A: '#097E3E',
  B: '#32A548',
  C: '#96C133',
  D: '#EFE61E',
  E: '#F7AD24',
  F: '#EA6927',
  G: '#E31829',
};

const getEnergyRatingColor = (rating?: string | null): string => {
  if (!rating) return '#32A548';
  return ENERGY_RATING_COLORS[rating.toUpperCase()] ?? '#32A548';
};

// Varmepumpe-typer med energibesparelsesdata (fra CSV)
const VARMEPUMPE_TYPES = [
  { id: 'luft-luft', label: 'Luft-luft', description: 'Rimeligst, enkel installasjon' },
  { id: 'luft-vann', label: 'Luft-vann', description: 'Varmer også tappevann' },
  { id: 'vaeske-vann', label: 'Væske-vann', description: 'Høyest besparelse' },
] as const;

type VarmepumpeType = typeof VARMEPUMPE_TYPES[number]['id'];

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
  /** Audience for tiltak content - determines gul liste status */
  audience?: ContentAudience;
  /** Om brukerens energiforbruk er basert på Enova-data (true) eller TEK-estimering (false) */
  isUsingEnovaData?: boolean;
  /** Om tiltaksdetalj-visningen er aktiv (skjuler hovedinnhold, beholder footer) */
  isDetailViewActive?: boolean;
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
 * Filtrer tiltak basert på byggtype, byggår og energieffekt.
 * Tom visibleForBuildingTypes-array = vis for ingen byggtyper.
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
    // Byggtype-filter: tom array = vis for ingen
    const buildingTypeMatch =
      t.visibleForBuildingTypes.length > 0 &&
      buildingTypeKey &&
      t.visibleForBuildingTypes.includes(buildingTypeKey);

    const buildingYearMatch =
      t.minBuildingYear === undefined ||
      (buildingYear !== undefined && buildingYear < t.minBuildingYear);

    // Energieffekt-filter (som desktop)
    let energyEffectMatch = true;
    if (tekPeriod && boligtype && t.id !== 'solenergi') {
      const rates = getRateForTiltakId(t.id, tekPeriod, boligtype, { erPaaGulListe });
      if (rates !== null && !hasEnergyEffect(rates)) {
        energyEffectMatch = false;
      }
    }

    return buildingTypeMatch && buildingYearMatch && energyEffectMatch;
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
  audience = 'standard',
  isUsingEnovaData: _isUsingEnovaData = false,
  isDetailViewActive = false,
}) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [_showEnergyInfo, _setShowEnergyInfo] = useState(false); // Beholdes for fremtidig bruk i energibesparelses-boksen
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [isInfoBoxExiting, setIsInfoBoxExiting] = useState(false);

  // Bydelssammenligning state
  const [showDistrictComparison, setShowDistrictComparison] = useState(false);
  // Prosessen videre state
  const [showProsessenVidere, setShowProsessenVidere] = useState(false);
  const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);
  const [subdistrictStats, setSubdistrictStats] = useState<DistrictStats | null>(null);

  // Enova bulk-data for brukerens bolig (for "Sammenlign deg med naboen")
  // Brukes kun til sammenligning, ikke til tiltaksberegninger
  const [enovaBulkData, setEnovaBulkData] = useState<EnovaBuildingData | null>(null);

  // Varmepumpe-spesifikk state
  const [selectedVarmepumpeType, setSelectedVarmepumpeType] = useState<VarmepumpeType>('luft-luft');
  const [varmepumpeExpanded, setVarmepumpeExpanded] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const tiltakSectionRef = useRef<HTMLDivElement>(null);
  const buildingIllustrationRef = useRef<HTMLDivElement>(null);
  const { setTargetRect, buildingType, phase: overlayPhase, finalizeTransition } = useTransitionOverlay();

  // State for tiltak animations and arrow feedback
  const [activeTiltak, setActiveTiltak] = useState<TiltakCanonicalKey[]>([]);
  const [arrowState, setArrowState] = useState<'add' | 'remove' | null>(null);
  const [arrowColor, setArrowColor] = useState<string>('#32A548');
  const prevTiltakRef = useRef(new Set<TiltakCanonicalKey>());

  // Hide building illustration during animation phases (like desktop does)
  // During 'settling', the static illustration should be visible BEHIND the overlay
  // so when the overlay disappears, the static illustration is already in place (no blink)
  const buildingIllustrationOpacity =
    overlayPhase === 'captured' || overlayPhase === 'animating' ? 0 : 1;

  // Hent tiltakskatalog dynamisk
  const { data: catalogData, isLoading: isCatalogLoading } = useTiltakCatalog();

  // Utled gul liste-status fra audience prop (App.tsx er "single source of truth" via PBE-oppslag)
  const erPaaGulListe = audience === 'gulliste';

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
  // Bruker sentralisert determineBuildingType() for konsistens med desktop
  const boligtype: Boligtype | null = useMemo(() => {
    return determineBuildingType(
      buildingData?.bygningstypeKode || buildingData?.csvData?.bygningstypekode,
      buildingData?.bygningstype || buildingData?.csvData?.bygningstype
    );
  }, [buildingData]);

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

    // Beregn basert på byggeår og bruksareal, bruk sentralisert boligtype
    if (buildingYear && bruksareal && boligtype) {
      const consumption = calculateAnnualEnergyConsumption(buildingYear, bruksareal, boligtype);
      return String(consumption);
    }

    return '';
  }, [yearlyConsumption, buildingData, buildingYear, bruksareal, boligtype]);

  // Beregn besparelse for et tiltak med CSV-baserte prosentsatser
  // Bruker samme metode som desktop (getRateForTiltakId + calculateCombinedSavings)
  // Returnerer null hvis besparelse ikke kan beregnes (manglende data)
  const calculateSavingsForTiltak = useCallback(
    (tiltakId: string): number | null => {
      // Solenergi har egen beregning - bruk solarData prop eller buildingData som fallback
      if (tiltakId === 'solenergi') {
        const solarValue = solarData?.filteredSolarEnergy || buildingData?.filteredSolarEnergy;
        return solarValue && solarValue > 0 ? solarValue : null;
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
      const tekPeriodCalc = calculateTekPeriod(parsedByggeaar);
      const originalEnergy = calculateAnnualEnergyConsumption(parsedByggeaar, parsedBruksareal, buildingCategory);

      // Bruk getRateForTiltakId direkte med tiltakId (samme som desktop)
      const energyBuildingCategory: Boligtype = buildingCategory === 'blokk' ? 'blokk' : 'småhus';
      const rates = getRateForTiltakId(tiltakId, tekPeriodCalc, energyBuildingCategory, {
        erPaaGulListe,
        varmepumpeTab: tiltakId === 'varmepumpe' ? selectedVarmepumpeType : undefined,
      });

      if (!rates) {
        return null;
      }

      // Bruk calculateCombinedSavings for konsistent beregning med desktop
      const tiltakInfo: TiltakSavingsInfo[] = [{
        title: tiltakId,
        rates: rates
      }];

      const totalSavings = calculateCombinedSavings(
        originalEnergy,
        tiltakInfo,
        tekPeriodCalc,
        energyBuildingCategory,
        parsedBruksareal
      );

      return totalSavings > 0 ? totalSavings : null;
    },
    [
      buildingData?.filteredSolarEnergy,
      buildingTypeCode,
      buildingTypeName,
      buildingYear,
      bruksareal,
      erPaaGulListe,
      selectedVarmepumpeType,
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
    return filterTiltakForBuilding(
      publishedTiltak,
      buildingTypeKey,
      buildingYear,
      tekPeriod,
      boligtype,
      erPaaGulListe
    );
  }, [catalogData, buildingTypeKey, buildingYear, tekPeriod, boligtype, erPaaGulListe]);

  // Dynamisk tiltak-liste fra katalogen (filtrert på byggtype, audience og energieffekt)
  const displayTiltak: Array<{ id: string; title: string; canonicalKey: TiltakCanonicalKey | null }> = useMemo(() => {
    // Vis tom liste mens katalog lastes
    if (isCatalogLoading) {
      return [];
    }

    return filteredTiltak.map((t) => ({
      id: t.id,
      title: t.title,
      canonicalKey: getCanonicalKey(t.id, t.title)
    }));
  }, [isCatalogLoading, filteredTiltak]);

  // Beregn total besparelse med multiplikativ metode når valgte tiltak endres
  // VIKTIG: Bruker ALLTID TEK/byggtype-basert beregning for energibesparelser
  // (Enova-data brukes KUN i sammenligningsmodulen)
  useEffect(() => {
    if (checkedItems.size === 0) {
      setCalculatedSavings(0);
      setUncalculableCount(0);
      return;
    }

    // Beregn verdier direkte
    const parsedBruksareal = parseNumericValue(bruksareal);
    const parsedByggeaar = Math.trunc(parseNumericValue(buildingYear));

    // Valider inputs
    if (
      !Number.isFinite(parsedByggeaar) ||
      parsedByggeaar <= 0 ||
      !Number.isFinite(parsedBruksareal) ||
      parsedBruksareal <= 0
    ) {
      // Kan ikke beregne - merk alle som uncalculable
      setCalculatedSavings(0);
      setUncalculableCount(checkedItems.size);
      return;
    }

    // Bestem byggkategori og TEK-periode direkte
    const buildingCategory = determineBuildingType(buildingTypeCode, buildingTypeName);
    if (!buildingCategory) {
      setCalculatedSavings(0);
      setUncalculableCount(checkedItems.size);
      return;
    }

    const tekPeriodCalc = calculateTekPeriod(parsedByggeaar);
    const energyBuildingCategory: Boligtype = buildingCategory === 'blokk' ? 'blokk' : 'småhus';

    // ALLTID bruk TEK-basert beregning for energibesparelser (ikke Enova-data)
    const consumptionNum = calculateAnnualEnergyConsumption(parsedByggeaar, parsedBruksareal, energyBuildingCategory);

    // Bygg liste med tiltak og deres rates for multiplikativ beregning
    const tiltakInfo: TiltakSavingsInfo[] = [];
    let uncalculable = 0;

    checkedItems.forEach((tiltakId) => {
      const tiltak = displayTiltak.find((t) => t.id === tiltakId);
      if (!tiltak) return;

      // Solenergi håndteres spesielt - det er produksjon, ikke besparelse
      if (tiltak.id === 'solenergi') {
        const solarValue = solarData?.filteredSolarEnergy || buildingData?.filteredSolarEnergy;
        if (solarValue && solarValue > 0) {
          tiltakInfo.push({
            title: tiltak.id,
            rates: null,
            solarProductionKwh: solarValue
          });
        } else {
          uncalculable += 1;
        }
      } else {
        // Hent rates for dette tiltaket (romoppvarming, tappevann, elspesifikt)
        const rates = getRateForTiltakId(tiltak.id, tekPeriodCalc, energyBuildingCategory, {
          erPaaGulListe,
          varmepumpeTab: tiltak.id === 'varmepumpe' ? selectedVarmepumpeType : undefined,
        });
        if (rates !== null) {
          tiltakInfo.push({
            title: tiltak.id,
            rates
          });
        } else {
          uncalculable += 1;
        }
      }
    });

    // Bruk den sentrale multiplikative beregningen med forbruksfordeling per energitype
    const total = calculateCombinedSavings(
      consumptionNum,
      tiltakInfo,
      tekPeriodCalc,
      energyBuildingCategory,
      parsedBruksareal
    );

    setCalculatedSavings(total);
    setUncalculableCount(uncalculable);
  }, [
    bruksareal,
    buildingData?.filteredSolarEnergy,
    buildingTypeCode,
    buildingTypeName,
    buildingYear,
    checkedItems,
    displayTiltak,
    erPaaGulListe,
    selectedVarmepumpeType,
    solarData?.filteredSolarEnergy,
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

    // Bruk sentralisert boligtype for rating-beregning (konsistent med desktop)
    const rating = calculateEnergyRating(newIntensity, bruksareal, boligtype);

    // Returner kun hvis bedre enn estimert
    if (!isRatingBetter(rating, estimatedRating)) {
      return null;
    }

    return rating;
  }, [
    bruksareal,
    boligtype,
    calculatedSavings,
    checkedItems.size,
    estimatedRating,
    yearlyConsumption,
  ]);

  // Sync checkedItems to activeTiltak and trigger arrow animations
  useEffect(() => {
    const nextCanonicalKeys = Array.from(checkedItems)
      .map(id => displayTiltak.find(t => t.id === id)?.canonicalKey)
      .filter((key): key is TiltakCanonicalKey => key !== undefined && key !== null);

    const nextSet = new Set(nextCanonicalKeys);
    const prevSet = prevTiltakRef.current;

    let mode: 'add' | 'remove' | null = null;
    for (const tiltak of nextSet) {
      if (!prevSet.has(tiltak)) { mode = 'add'; break; }
    }
    if (!mode) {
      for (const tiltak of prevSet) {
        if (!nextSet.has(tiltak)) { mode = 'remove'; break; }
      }
    }

    setArrowColor(getEnergyRatingColor(newRating ?? estimatedRating));
    setActiveTiltak(nextCanonicalKeys);
    if (mode) setArrowState(mode);
    prevTiltakRef.current = nextSet;
  }, [checkedItems, displayTiltak, newRating, estimatedRating]);

  // Auto-clear arrow state after animation completes
  useEffect(() => {
    if (!arrowState) return;
    const timer = setTimeout(() => setArrowState(null), 900);
    return () => clearTimeout(timer);
  }, [arrowState]);

  // Lukk InfoBox med exit-animasjon
  const closeInfoBox = useCallback(() => {
    setIsInfoBoxExiting(true);
    setTimeout(() => {
      setShowInfoBox(false);
      setIsInfoBoxExiting(false);
    }, 300); // Matcher slideUp-animasjonens varighet
  }, []);

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

  // Hent bydelsstatistikk ved mount
  useEffect(() => {
    if (!districtName || !boligtype) return;

    getDistrictStatistics().then(data => {
      const bydelStats = getStatsForDistrict(data, districtName, boligtype);
      setDistrictStats(bydelStats);

      // Hent delbydel hvis tilgjengelig
      const subdistrictName = buildingData.csvData?.delbydelsnavn;
      if (subdistrictName) {
        const delbydelStats = getStatsForSubdistrict(data, districtName, subdistrictName, boligtype);
        setSubdistrictStats(delbydelStats);
      }
    });
  }, [districtName, boligtype, buildingData.csvData?.delbydelsnavn]);

  // Hent Enova bulk-data for brukerens bolig (for "Sammenlign deg med naboen")
  // Dette sikrer at sammenligningen bruker samme datakilde som bydelsstatistikken
  useEffect(() => {
    const gnr = String(buildingData?.gnr || buildingData?.csvData?.gnr || '');
    const bnr = String(buildingData?.bnr || buildingData?.csvData?.bnr || '');
    const snr = String(buildingData?.seksjonsnummer || '0');
    const bygningsnummer = buildingData?.bygningsnummer || '';

    lookupBuildingFromEnovaData(bygningsnummer, gnr, bnr, snr)
      .then(setEnovaBulkData);
  }, [buildingData]);

  // Beregn kWh/m2 for bydelssammenligning
  // Prioriterer Enova bulk-data for å sikre "epler med epler"-sammenligning
  // Hvis boligen ikke finnes i Enova bulk-data, brukes TEK-estimering
  const currentKwhPerM2 = useMemo(() => {
    // Hvis brukerens bolig finnes i Enova bulk-data, bruk den verdien
    // Dette sikrer at sammenligningen er basert på samme datakilde som bydelsstatistikken
    if (enovaBulkData?.kwhPerM2 && enovaBulkData.kwhPerM2 > 0) {
      return enovaBulkData.kwhPerM2;
    }

    // Fallback til TEK-estimering hvis Enova-data ikke finnes
    const consumption = yearlyConsumption ? parseFloat(yearlyConsumption) : estimatedAnnualConsumption;
    return bruksareal && bruksareal > 0 ? consumption / bruksareal : 0;
  }, [enovaBulkData, yearlyConsumption, estimatedAnnualConsumption, bruksareal]);

  // Beregn besparelse for sammenligningsmodulen
  // Hvis Enova-data finnes, bruker vi calculateComparisonSavings som:
  // 1. Estimerer en "effektiv TEK-periode" basert på Enova kwhPerM2
  // 2. Henter besparelsesfaktorer fra CSV for denne TEK-perioden
  // 3. Beregner besparelser basert på Enova-forbruk og disse faktorene
  // Dette gir realistiske besparelser for allerede oppgraderte boliger
  const comparisonSavings = useMemo(() => {
    // Hvis ingen Enova-data eller ingen valgte tiltak, bruk calculatedSavings uendret
    if (!enovaBulkData?.kwhPerM2 || enovaBulkData.kwhPerM2 <= 0 || !boligtype || !bruksareal || bruksareal <= 0) {
      return calculatedSavings;
    }

    // Beregn TEK-basert forbruk
    const tekBasedKwhPerM2 = estimatedAnnualConsumption / bruksareal;

    // Hvis Enova-forbruk er høyere enn eller lik TEK, bruk calculatedSavings uendret
    // (boligen er ikke oppgradert, så TEK-basert beregning er riktig)
    if (enovaBulkData.kwhPerM2 >= tekBasedKwhPerM2) {
      return calculatedSavings;
    }

    // Bygg tiltak-liste med rates for Enova-basert beregning
    const tiltakInfo: TiltakSavingsInfo[] = [];

    checkedItems.forEach((tiltakId) => {
      const tiltak = displayTiltak.find((t) => t.id === tiltakId);
      if (!tiltak) return;

      // Solenergi håndteres spesielt - det er produksjon, ikke besparelse
      if (tiltak.id === 'solenergi') {
        const solarValue = solarData?.filteredSolarEnergy || buildingData?.filteredSolarEnergy;
        if (solarValue && solarValue > 0) {
          tiltakInfo.push({
            title: tiltak.id,
            rates: null,
            solarProductionKwh: solarValue
          });
        }
      } else {
        // Hent rates for dette tiltaket basert på effektiv TEK
        // (calculateComparisonSavings vil hente riktig TEK basert på Enova kwhPerM2)
        const rates = getRateForTiltakId(tiltak.id, tekPeriod || 'TEK69', boligtype, {
          erPaaGulListe,
          varmepumpeTab: tiltak.id === 'varmepumpe' ? selectedVarmepumpeType : undefined,
        });
        if (rates !== null) {
          tiltakInfo.push({
            title: tiltak.id,
            rates
          });
        }
      }
    });

    // Hvis ingen tiltak med rates, bruk calculatedSavings
    if (tiltakInfo.length === 0) {
      return calculatedSavings;
    }

    // Bruk calculateComparisonSavings som beregner besparelser basert på
    // effektiv TEK-periode (estimert fra Enova kwhPerM2)
    return calculateComparisonSavings(
      enovaBulkData.kwhPerM2,
      bruksareal,
      boligtype,
      tiltakInfo
    );
  }, [
    enovaBulkData,
    calculatedSavings,
    estimatedAnnualConsumption,
    bruksareal,
    boligtype,
    checkedItems,
    displayTiltak,
    tekPeriod,
    erPaaGulListe,
    selectedVarmepumpeType,
    solarData?.filteredSolarEnergy,
    buildingData?.filteredSolarEnergy,
  ]);

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
    <>
    <div
      className={`mobile-energy-solutions${showFooter ? ' mobile-energy-solutions--has-footer' : ''} mobile-energy-solutions--fade-in`}
      style={isDetailViewActive ? { display: 'none' } : undefined}
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
              <PktTag
                skin={DISTRICT_BADGE.skin}
                aria-label={`${DISTRICT_BADGE.ariaLabelPrefix}: ${districtName}`}
              >
                <PktIcon name={DISTRICT_BADGE.iconName} />
                <span>{districtName}</span>
              </PktTag>
            )}
            {buildingTypeName && (() => {
              const displayName = getDisplayBuildingTypeName(buildingTypeName);
              const badgeConfig = getBuildingTypeBadgeConfig(buildingTypeName);
              return (
                <PktTag
                  skin={badgeConfig.skin}
                  aria-label={`${badgeConfig.ariaLabelPrefix}: ${displayName}`}
                >
                  <PktIcon name={badgeConfig.iconName} />
                  <span>{displayName}</span>
                </PktTag>
              );
            })()}
            {buildingYear && (
              <PktTag
                skin={BUILDING_YEAR_BADGE.skin}
                aria-label={`${BUILDING_YEAR_BADGE.ariaLabelPrefix}: ${buildingYear}`}
              >
                <PktIcon name={BUILDING_YEAR_BADGE.iconName} />
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
              <Blokk2LayerSvg
                id="mobile-target-blokk"
                className="mobile-energy-solutions__building-svg mobile-energy-solutions__building-svg--blokk"
                activeTiltak={activeTiltak}
                arrowState={arrowState}
                arrowColor={arrowColor}
              />
            ) : (
              <Enebolig2LayerSvg
                id="mobile-target-enebolig"
                className="mobile-energy-solutions__building-svg mobile-energy-solutions__building-svg--enebolig"
                activeTiltak={activeTiltak}
                arrowState={arrowState}
                arrowColor={arrowColor}
              />
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
                {displayTiltak.map((tiltak, index) => {
                  const isVarmepumpe = tiltak.id === 'varmepumpe';
                  const isSelected = checkedItems.has(tiltak.id);
                  const isLast = index === displayTiltak.length - 1;

                  // Standard tiltak-rad (ikke varmepumpe)
                  if (!isVarmepumpe) {
                    return (
                      <li key={tiltak.id} className={`mobile-energy-solutions__tiltak-item ${isLast ? 'mobile-energy-solutions__tiltak-item--last' : ''}`}>
                        <div className="mobile-energy-solutions__tiltak-content">
                          <PktCheckbox
                            id={`tiltak-${tiltak.id}`}
                            label={tiltak.title}
                            checked={isSelected}
                            onChange={() => toggleChecked(tiltak.id)}
                          />
                        </div>
                        <PktButton
                          skin="secondary"
                          size="small"
                          variant="label-only"
                          onClick={() => onSelectTiltak(tiltak.id, calculateSavingsForTiltak(tiltak.id) ?? undefined)}
                          className="mobile-energy-solutions__tiltak-button"
                        >
                          Les mer
                        </PktButton>
                      </li>
                    );
                  }

                  // Varmepumpe med utvidbar seksjon
                  return (
                    <li key={tiltak.id} className={`mobile-energy-solutions__tiltak-item mobile-energy-solutions__tiltak-item--expandable ${isLast ? 'mobile-energy-solutions__tiltak-item--last' : ''}`}>
                      <div className="mobile-energy-solutions__varmepumpe-header">
                        <button
                          type="button"
                          className="mobile-energy-solutions__varmepumpe-toggle"
                          onClick={() => setVarmepumpeExpanded(!varmepumpeExpanded)}
                          aria-expanded={varmepumpeExpanded}
                        >
                          <PktIcon
                            name="chevron-thin-down"
                            className={`mobile-energy-solutions__chevron${varmepumpeExpanded ? ' mobile-energy-solutions__chevron--expanded' : ''}`}
                          />
                          <span className="mobile-energy-solutions__varmepumpe-label">{tiltak.title}</span>
                        </button>
                        <PktButton
                          skin="secondary"
                          size="small"
                          variant="label-only"
                          onClick={() => onSelectTiltak(tiltak.id, calculateSavingsForTiltak(tiltak.id) ?? undefined)}
                          className="mobile-energy-solutions__tiltak-button"
                        >
                          Les mer
                        </PktButton>
                      </div>

                      {/* Utvidbar seksjon for varmepumpe-typer */}
                      {varmepumpeExpanded && (
                        <div className="mobile-energy-solutions__varmepumpe-options">
                          {VARMEPUMPE_TYPES.map((type) => {
                            const isTypeSelected = isSelected && selectedVarmepumpeType === type.id;
                            return (
                              <div
                                key={type.id}
                                className={`mobile-energy-solutions__varmepumpe-option${isTypeSelected ? ' mobile-energy-solutions__varmepumpe-option--selected' : ''}`}
                              >
                                <PktRadioButton
                                  id={`varmepumpe-type-${type.id}`}
                                  name="varmepumpe-type"
                                  label={type.label}
                                  value={type.id}
                                  checked={isTypeSelected}
                                  checkHelptext={type.description}
                                  onChange={() => {
                                    setSelectedVarmepumpeType(type.id);
                                    // Sørg for at varmepumpe er valgt når en type velges
                                    if (!checkedItems.has('varmepumpe')) {
                                      toggleChecked('varmepumpe');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
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

      {/* InfoBox modal - animerer nedover fra toppen, opp ved lukking */}
      {showInfoBox && (
        <div
          className={`mobile-energy-solutions__infobox-overlay${isInfoBoxExiting ? ' mobile-energy-solutions__infobox-overlay--exiting' : ''}`}
          onClick={closeInfoBox}
        >
          <div
            className={`mobile-energy-solutions__infobox-container${isInfoBoxExiting ? ' mobile-energy-solutions__infobox-container--exiting' : ''}`}
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
              onCollapse={closeInfoBox}
              showCompareButton={!!districtStats}
              onCompareClick={() => {
                closeInfoBox();
                // Åpne bydelssammenligning etter exit-animasjonen
                setTimeout(() => setShowDistrictComparison(true), 300);
              }}
            />
          </div>
        </div>
      )}

      {/* Bydelssammenligning modal */}
      {districtStats && (
        <MobileDistrictComparison
          isOpen={showDistrictComparison}
          onClose={() => setShowDistrictComparison(false)}
          currentKwhPerM2={currentKwhPerM2}
          totalEnergySavings={comparisonSavings}
          bruksareal={bruksareal || 0}
          districtName={districtName}
          districtStats={districtStats}
          subdistrictName={buildingData.csvData?.delbydelsnavn}
          subdistrictStats={subdistrictStats ?? undefined}
          userEnergyGrade={estimatedRating as EnergyGrade | null}
          buildingTypeCategory={boligtype || 'småhus'}
          isUsingEnovaBulkData={enovaBulkData !== null}
        />
      )}

      {/* Prosessen videre modal */}
      <MobileProsessenVidere
        isOpen={showProsessenVidere}
        onClose={() => setShowProsessenVidere(false)}
        isGulliste={erPaaGulListe}
      />

    </div>

      {/* Besparelsesfooter - alltid synlig når tiltak er valgt, også i detaljvisning */}
      <MobileSavingsFooter
        totalSavingsKwh={calculatedSavings}
        isVisible={showFooter && !showDistrictComparison && !showProsessenVidere}
        uncalculableCount={uncalculableCount}
        estimatedRating={estimatedRating}
        newRating={newRating}
        selectedTiltakCount={checkedItems.size}
        forceCollapsed={isDetailViewActive}
        onNavigateForward={() => {
          setShowProsessenVidere(true);
        }}
      />
    </>
  );
};

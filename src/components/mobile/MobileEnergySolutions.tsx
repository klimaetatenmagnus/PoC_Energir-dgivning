import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  PktButton,
  PktCheckbox,
  PktTag,
  PktIcon,
  PktRadioButton,
  PktTabs,
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
  TILTAK_ID_TO_TYPE,
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
      const isRateBasedTiltak = t.id in TILTAK_ID_TO_TYPE && TILTAK_ID_TO_TYPE[t.id] !== null;
      if (rates === null && isRateBasedTiltak) {
        energyEffectMatch = false; // Skjul rate-basert tiltak uten data for denne TEK-perioden
      } else if (rates !== null && !hasEnergyEffect(rates)) {
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
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [_showEnergyInfo, _setShowEnergyInfo] = useState(false); // Beholdes for fremtidig bruk i energibesparelses-boksen
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [isInfoBoxExiting, setIsInfoBoxExiting] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isHowItWorksExiting, setIsHowItWorksExiting] = useState(false);

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

  // Tab-state for tiltakslisten
  const [activeTab, setActiveTab] = useState<'nye' | 'gjennomforte'>('nye');

  // Override-state for redigerte bygningsdata (speiler desktop-mønsteret i FigmaMainScript)
  const [updatedBuildingData, setUpdatedBuildingData] = useState(buildingData);
  const [effectiveYearlyConsumption, setEffectiveYearlyConsumption] = useState(yearlyConsumption);

  // Sjekk om brukeren har redigert nøkkelinformasjon
  // Brukes til å bestemme om Enova bulk-data skal hoppes over i sammenligningsmodulen
  // Ved tilbakestilling matcher verdiene originalene → hasUserEdited = false → Enova brukes igjen
  // Sjekker bygningsdata OG energiforbruk (brukeren kan redigere energi direkte)
  const hasUserEdited = useMemo(() => {
    if (updatedBuildingData === buildingData && effectiveYearlyConsumption === yearlyConsumption) return false;
    return updatedBuildingData.byggeaar !== buildingData.byggeaar ||
      updatedBuildingData.bruksarealM2 !== buildingData.bruksarealM2 ||
      updatedBuildingData.arealLeilighet !== buildingData.arealLeilighet ||
      effectiveYearlyConsumption !== yearlyConsumption;
  }, [updatedBuildingData, buildingData, effectiveYearlyConsumption, yearlyConsumption]);

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
      updatedBuildingData?.bygningstypeKode?.substring(0, 2) ||
      updatedBuildingData?.csvData?.bygningstypekode?.substring(0, 2) ||
      ''
    );
  }, [updatedBuildingData]);

  const buildingTypeName = useMemo(() => {
    return updatedBuildingData?.bygningstype || updatedBuildingData?.csvData?.bygningstype || '';
  }, [updatedBuildingData]);

  const buildingTypeNameLower = useMemo(() => buildingTypeName.toLowerCase(), [buildingTypeName]);

  const buildingTypeKey = useMemo(() => {
    return determineBuildingTypeKey(buildingTypeCode, buildingTypeNameLower);
  }, [buildingTypeCode, buildingTypeNameLower]);

  const buildingYear = useMemo(() => {
    const candidate =
      typeof updatedBuildingData?.byggeaar === 'number'
        ? updatedBuildingData.byggeaar
        : updatedBuildingData?.csvData?.byggeaar
          ? Number(updatedBuildingData.csvData.byggeaar)
          : undefined;

    if (candidate && !Number.isNaN(candidate) && candidate > 0) {
      return candidate;
    }
    return undefined;
  }, [updatedBuildingData]);

  // Bruksareal - sjekk flere mulige feltnavn
  const bruksareal = useMemo(() => {
    const bra =
      updatedBuildingData?.bruksarealM2 ||
      updatedBuildingData?.bruksareal ||
      updatedBuildingData?.csvData?.bruksareal_totalt ||
      updatedBuildingData?.csvData?.bruksareal;
    if (bra && !Number.isNaN(Number(bra))) {
      return Number(bra);
    }
    return undefined;
  }, [updatedBuildingData]);

  // Opprinnelig bruksareal (før redigering) for solenergi-skalering
  const originalBruksareal = useMemo(() => {
    const raw =
      buildingData?.bruksarealM2 ||
      buildingData?.bruksareal ||
      buildingData?.csvData?.bruksareal_totalt ||
      buildingData?.csvData?.bruksareal;
    if (raw && !Number.isNaN(Number(raw))) {
      return Number(raw);
    }
    return undefined;
  }, [buildingData]);

  // Skalert solenergi: nedjusteres proporsjonalt hvis brukeren har redusert bruksareal
  const scaledSolarEnergy = useMemo(() => {
    const rawSolar = solarData?.filteredSolarEnergy || buildingData?.filteredSolarEnergy;
    if (!rawSolar || rawSolar <= 0 || !originalBruksareal || !bruksareal) return rawSolar;

    // Kun nedjustering — hvis arealet er økt eller uendret, returner uendret solenergi
    if (bruksareal >= originalBruksareal) return rawSolar;

    const scaleFactor = bruksareal / originalBruksareal;
    return Math.round(rawSolar * scaleFactor);
  }, [solarData?.filteredSolarEnergy, buildingData?.filteredSolarEnergy, originalBruksareal, bruksareal]);

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
      updatedBuildingData?.bygningstypeKode || updatedBuildingData?.csvData?.bygningstypekode,
      updatedBuildingData?.bygningstype || updatedBuildingData?.csvData?.bygningstype
    );
  }, [updatedBuildingData]);

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
      // Solenergi har egen beregning - bruk skalert verdi (tar høyde for nedjustert bruksareal)
      if (tiltakId === 'solenergi') {
        return scaledSolarEnergy && scaledSolarEnergy > 0 ? scaledSolarEnergy : null;
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
      scaledSolarEnergy,
      buildingTypeCode,
      buildingTypeName,
      buildingYear,
      bruksareal,
      erPaaGulListe,
      selectedVarmepumpeType,
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

  // "Velg energioppgraderinger" – alle minus de som er avkrysset i gjennomførte
  const nyeTiltak = useMemo(() =>
    displayTiltak.filter(t => !completedItems.has(t.id)),
    [displayTiltak, completedItems]
  );

  // "Gjennomførte energioppgraderinger" – alle minus de som er avkrysset i nye
  const gjennomforteTiltak = useMemo(() =>
    displayTiltak.filter(t => !checkedItems.has(t.id)),
    [displayTiltak, checkedItems]
  );

  // Tiltak-info for gjennomførte tiltak (speiler desktop completedTiltakInfo)
  const completedTiltakInfo = useMemo<TiltakSavingsInfo[]>(() => {
    if (completedItems.size === 0 || !boligtype || !tekPeriod) return [];
    const info: TiltakSavingsInfo[] = [];
    completedItems.forEach((tiltakId) => {
      const tiltak = displayTiltak.find((t) => t.id === tiltakId);
      if (!tiltak) return;
      if (tiltak.id === 'solenergi') {
        const solarEnergy = scaledSolarEnergy || 0;
        if (solarEnergy > 0) info.push({ title: tiltak.id, rates: null, solarProductionKwh: solarEnergy });
      } else {
        const rates = getRateForTiltakId(tiltak.id, tekPeriod, boligtype, {
          erPaaGulListe,
          varmepumpeTab: tiltak.id === 'varmepumpe' ? selectedVarmepumpeType : undefined,
        });
        if (rates !== null) info.push({ title: tiltak.id, rates });
      }
    });
    return info;
  }, [boligtype, scaledSolarEnergy, completedItems, displayTiltak, erPaaGulListe, selectedVarmepumpeType, tekPeriod]);

  // Besparelse fra gjennomførte tiltak (baseline-reduksjon)
  const completedSavingsKWh = useMemo(() => {
    if (completedTiltakInfo.length === 0) return 0;
    const consumptionNum = effectiveYearlyConsumption ? parseFloat(effectiveYearlyConsumption) : estimatedAnnualConsumption;
    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0 || !tekPeriod || !boligtype) return 0;
    return calculateCombinedSavings(consumptionNum, completedTiltakInfo, tekPeriod, boligtype, bruksareal);
  }, [completedTiltakInfo, effectiveYearlyConsumption, estimatedAnnualConsumption, tekPeriod, boligtype, bruksareal]);

  // Beregn total besparelse med multiplikativ metode når valgte tiltak endres
  // VIKTIG: Bruker ALLTID TEK/byggtype-basert beregning for energibesparelser
  // (Enova-data brukes KUN i sammenligningsmodulen)
  useEffect(() => {
    if (checkedItems.size === 0 && completedItems.size === 0) {
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

    // Bygg liste med tiltak og deres rates for multiplikativ beregning (kun nye tiltak)
    const tiltakInfo: TiltakSavingsInfo[] = [];
    let uncalculable = 0;

    checkedItems.forEach((tiltakId) => {
      const tiltak = displayTiltak.find((t) => t.id === tiltakId);
      if (!tiltak) return;

      // Solenergi håndteres spesielt - bruk skalert verdi (tar høyde for nedjustert bruksareal)
      if (tiltak.id === 'solenergi') {
        if (scaledSolarEnergy && scaledSolarEnergy > 0) {
          tiltakInfo.push({
            title: tiltak.id,
            rates: null,
            solarProductionKwh: scaledSolarEnergy
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

    // Samlet besparelse for alle tiltak (gjennomførte + nye)
    const allTiltakInfo = [...completedTiltakInfo, ...tiltakInfo];
    const totalCombinedSavings = allTiltakInfo.length > 0
      ? calculateCombinedSavings(consumptionNum, allTiltakInfo, tekPeriodCalc, energyBuildingCategory, parsedBruksareal)
      : 0;

    // Marginal besparelse = total - gjennomførte (det brukeren ser)
    const marginalSavings = Math.max(0, totalCombinedSavings - completedSavingsKWh);

    setCalculatedSavings(marginalSavings);
    setUncalculableCount(uncalculable);
  }, [
    bruksareal,
    scaledSolarEnergy,
    buildingTypeCode,
    buildingTypeName,
    buildingYear,
    checkedItems,
    completedItems,
    completedTiltakInfo,
    completedSavingsKWh,
    displayTiltak,
    erPaaGulListe,
    selectedVarmepumpeType,
  ]);

  // Lokal effektiv energikarakter — oppdateres ved redigering og gjennomførte tiltak
  // Bruker justert forbruk (etter gjennomførte tiltak) slik at baseline-karakteren oppdateres
  const effectiveEstimatedRating = useMemo(() => {
    const baseConsumption = parseFloat(effectiveYearlyConsumption);
    if (!Number.isFinite(baseConsumption) || baseConsumption <= 0 || !bruksareal) {
      return estimatedRating ?? null;
    }
    // Juster for gjennomførte tiltak
    const adjustedConsumption = completedSavingsKWh > 0
      ? Math.max(0, baseConsumption - completedSavingsKWh)
      : baseConsumption;
    const intensity = adjustedConsumption / bruksareal;
    return calculateEnergyRating(intensity, bruksareal, boligtype);
  }, [effectiveYearlyConsumption, bruksareal, boligtype, estimatedRating, completedSavingsKWh]);

  // Beregn ny energikarakter basert på valgte tiltak (inkl. gjennomførte)
  const newRating = useMemo(() => {
    // Trenger effectiveEstimatedRating, effectiveYearlyConsumption, tiltak valgt og bruksareal
    if (!effectiveEstimatedRating || !effectiveYearlyConsumption || (checkedItems.size === 0 && completedItems.size === 0) || !bruksareal) {
      return null;
    }

    const consumptionNum = parseFloat(effectiveYearlyConsumption);
    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0) {
      return null;
    }

    // Beregn nytt forbruk etter besparelse (marginal + gjennomførte)
    const totalSavings = calculatedSavings + completedSavingsKWh;
    const newConsumption = Math.max(0, consumptionNum - totalSavings);
    const newIntensity = newConsumption / bruksareal;

    // Bruk sentralisert boligtype for rating-beregning (konsistent med desktop)
    const rating = calculateEnergyRating(newIntensity, bruksareal, boligtype);

    // Returner kun hvis bedre enn estimert
    if (!isRatingBetter(rating, effectiveEstimatedRating)) {
      return null;
    }

    return rating;
  }, [
    bruksareal,
    boligtype,
    calculatedSavings,
    completedSavingsKWh,
    checkedItems.size,
    completedItems.size,
    effectiveEstimatedRating,
    effectiveYearlyConsumption,
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

    setArrowColor(getEnergyRatingColor(newRating ?? effectiveEstimatedRating));
    setActiveTiltak(nextCanonicalKeys);
    if (mode) setArrowState(mode);
    prevTiltakRef.current = nextSet;
  }, [checkedItems, displayTiltak, newRating, effectiveEstimatedRating]);

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

  // Lukk "Hvordan fungerer" modal med exit-animasjon
  const closeHowItWorks = useCallback(() => {
    setIsHowItWorksExiting(true);
    setTimeout(() => {
      setShowHowItWorks(false);
      setIsHowItWorksExiting(false);
    }, 300);
  }, []);

  const toggleChecked = useCallback((tiltakId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tiltakId)) {
        newSet.delete(tiltakId);
      } else {
        newSet.add(tiltakId);
        // Gjensidig ekskludering: fjern fra completedItems
        setCompletedItems(prevCompleted => {
          if (prevCompleted.has(tiltakId)) {
            const updated = new Set(prevCompleted);
            updated.delete(tiltakId);
            return updated;
          }
          return prevCompleted;
        });
      }
      return newSet;
    });
  }, []);

  const toggleCompleted = useCallback((tiltakId: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tiltakId)) {
        newSet.delete(tiltakId);
      } else {
        newSet.add(tiltakId);
        // Gjensidig ekskludering: fjern fra checkedItems
        setCheckedItems(prevChecked => {
          if (prevChecked.has(tiltakId)) {
            const updated = new Set(prevChecked);
            updated.delete(tiltakId);
            return updated;
          }
          return prevChecked;
        });
      }
      return newSet;
    });
  }, []);

  // Callback for redigering av bygningsdata fra MobileInfoBox (speiler FigmaMainScript)
  const handleUpdateBuildingData = useCallback((
    byggeaar: string, areal: string, arealLeilighet: string, energiforbruk: string
  ) => {
    setUpdatedBuildingData(prev => ({
      ...prev,
      byggeaar: byggeaar ? Number(byggeaar) : undefined,
      bruksarealM2: areal ? Number(areal) : undefined,
      arealLeilighet: arealLeilighet ? Number(arealLeilighet) : undefined,
      csvData: { ...prev.csvData, byggeaar, bruksareal_totalt: areal, areal_leilighet: arealLeilighet },
    }));
    setEffectiveYearlyConsumption(energiforbruk);
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
  // Prioriterer Enova bulk-data for å sikre "epler med epler"-sammenligning,
  // MEN bare hvis brukeren IKKE har redigert nøkkelinformasjon
  const currentKwhPerM2 = useMemo(() => {
    let baseKwhPerM2: number;
    // Hvis brukerens bolig finnes i Enova bulk-data og bruker ikke har redigert, bruk den verdien
    if (!hasUserEdited && enovaBulkData?.kwhPerM2 && enovaBulkData.kwhPerM2 > 0) {
      baseKwhPerM2 = enovaBulkData.kwhPerM2;
    } else {
      // Bruk TEK-estimering hvis Enova-data ikke finnes eller bruker har redigert
      const consumption = effectiveYearlyConsumption ? parseFloat(effectiveYearlyConsumption) : estimatedAnnualConsumption;
      baseKwhPerM2 = bruksareal && bruksareal > 0 ? consumption / bruksareal : 0;
    }
    // Juster for gjennomførte tiltak
    if (completedSavingsKWh > 0 && bruksareal && bruksareal > 0) {
      baseKwhPerM2 = Math.max(0, baseKwhPerM2 - (completedSavingsKWh / bruksareal));
    }
    return baseKwhPerM2;
  }, [hasUserEdited, enovaBulkData, effectiveYearlyConsumption, estimatedAnnualConsumption, bruksareal, completedSavingsKWh]);

  // Beregn besparelse for sammenligningsmodulen
  // Hvis Enova-data finnes, bruker vi calculateComparisonSavings som:
  // 1. Estimerer en "effektiv TEK-periode" basert på Enova kwhPerM2
  // 2. Henter besparelsesfaktorer fra CSV for denne TEK-perioden
  // 3. Beregner besparelser basert på Enova-forbruk og disse faktorene
  // Dette gir realistiske besparelser for allerede oppgraderte boliger
  const comparisonSavings = useMemo(() => {
    // Hopp over Enova-basert beregning hvis bruker har redigert, eller Enova-data mangler
    if (hasUserEdited || !enovaBulkData?.kwhPerM2 || enovaBulkData.kwhPerM2 <= 0 || !boligtype || !bruksareal || bruksareal <= 0) {
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

      // Solenergi håndteres spesielt - bruk skalert verdi (tar høyde for nedjustert bruksareal)
      if (tiltak.id === 'solenergi') {
        if (scaledSolarEnergy && scaledSolarEnergy > 0) {
          tiltakInfo.push({
            title: tiltak.id,
            rates: null,
            solarProductionKwh: scaledSolarEnergy
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
    hasUserEdited,
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
    scaledSolarEnergy,
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

  // Scroll reset ved tab-bytte
  useEffect(() => {
    if (tiltakSectionRef.current) {
      tiltakSectionRef.current.scrollTop = 0;
    }
  }, [activeTab]);

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
          <div className="mobile-energy-solutions__tiltak-title-row">
            <h2 className="mobile-energy-solutions__section-title mobile-energy-solutions__tiltak-title">Velg energioppgraderinger</h2>
            <PktButton
              skin="tertiary"
              size="small"
              variant="icon-only"
              iconName="information"
              aria-label="Hvordan fungerer Energinøkkelen?"
              onClick={() => setShowHowItWorks(true)}
            />
          </div>
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

        {/* Tabs for tiltakslisten */}
        <div className="mobile-energy-solutions__tabs">
          <PktTabs
            tabs={[
              {
                text: 'Nye energioppgraderinger',
                active: activeTab === 'nye',
              },
              {
                text: 'Gjennomførte energioppgraderinger',
                active: activeTab === 'gjennomforte',
              },
            ]}
            onTabSelected={(index) => setActiveTab(index === 0 ? 'nye' : 'gjennomforte')}
          />
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
            ) : activeTab === 'nye' ? (
              <ul className="mobile-energy-solutions__tiltak-list">
                {nyeTiltak.map((tiltak, index) => {
                  const isVarmepumpe = tiltak.id === 'varmepumpe';
                  const isSelected = checkedItems.has(tiltak.id);
                  const isLast = index === nyeTiltak.length - 1;

                  if (!isVarmepumpe) {
                    return (
                      <li key={tiltak.id} className={`mobile-energy-solutions__tiltak-item${isLast ? ' mobile-energy-solutions__tiltak-item--last' : ''}${isSelected ? ' mobile-energy-solutions__tiltak-item--selected' : ''}`}>
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
                    <li key={tiltak.id} className={`mobile-energy-solutions__tiltak-item mobile-energy-solutions__tiltak-item--expandable${isLast ? ' mobile-energy-solutions__tiltak-item--last' : ''}${isSelected ? ' mobile-energy-solutions__tiltak-item--selected' : ''}`}>
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
                      {isSelected && varmepumpeExpanded && (
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
            ) : (
              <ul className="mobile-energy-solutions__tiltak-list">
                {gjennomforteTiltak.map((tiltak, index) => {
                  const isCompleted = completedItems.has(tiltak.id);
                  const isLast = index === gjennomforteTiltak.length - 1;

                  return (
                    <li key={tiltak.id} className={`mobile-energy-solutions__tiltak-item${isLast ? ' mobile-energy-solutions__tiltak-item--last' : ''}${isCompleted ? ' mobile-energy-solutions__tiltak-item--selected' : ''}`}>
                      <div className="mobile-energy-solutions__tiltak-content">
                        <PktCheckbox
                          id={`tiltak-completed-${tiltak.id}`}
                          label={tiltak.title}
                          checked={isCompleted}
                          onChange={() => toggleCompleted(tiltak.id)}
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
              buildingData={updatedBuildingData}
              originalBuildingData={buildingData}
              onUpdateBuildingData={handleUpdateBuildingData}
              mapCoordinates={mapCoordinates}
              showYellowBox={showYellowBox}
              totalEnergySavings={calculatedSavings}
              onCollapse={closeInfoBox}
              showCompareButton={!!districtStats}
              completedSavings={completedSavingsKWh}
              onCompareClick={() => {
                closeInfoBox();
                // Åpne bydelssammenligning etter exit-animasjonen
                setTimeout(() => setShowDistrictComparison(true), 300);
              }}
            />
          </div>
        </div>
      )}

      {/* "Hvordan fungerer Energinøkkelen?" modal */}
      {showHowItWorks && (
        <div
          className={`mobile-energy-solutions__infobox-overlay${isHowItWorksExiting ? ' mobile-energy-solutions__infobox-overlay--exiting' : ''}`}
          onClick={closeHowItWorks}
        >
          <div
            className={`mobile-energy-solutions__infobox-container${isHowItWorksExiting ? ' mobile-energy-solutions__infobox-container--exiting' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="mobile-energy-solutions__how-it-works-close" onClick={closeHowItWorks} aria-label="Lukk">
              <PktIcon name="close" />
            </button>
            <div className="mobile-energy-solutions__how-it-works-content">
              <h2>Hvordan fungerer Energinøkkelen?</h2>

              <h3>Innhenting av data</h3>
              <p>
                Informasjon om bygningen din hentes automatisk fra Matrikkelen (Norges offisielle eiendomsregister).
                Dette inkluderer bygningstype, byggeår, bruksareal (BRA) og om bygningen er på Gul liste.
              </p>
              <p>
                Energinøkkelen henter data for hele bygningen. For bygninger med flere boenheter, presenteres totalt areal og totalt estimert energibruk. Du kan redigere arealet for å få estimert energiforbruket for din leilighet.
              </p>

              <h3>Har du allerede gjennomført tiltak?</h3>
              <p>
                Energinøkkelen har ikke informasjon om hvilke tiltak som allerede er gjort på bygningen. Kryss gjerne av for allerede utførte tiltak først og noter ned besparelsen som allerede er oppnådd før du legger til nye tiltak.
              </p>

              <h3>Energikarakter</h3>
              <p>
                Energikarakteren viser hvor energieffektiv bygningen din er på en skala fra A til G, hvor A er best.
                Karakteren beregnes ut fra grenseverdier fra{' '}
                <a
                  href="https://www.enova.no/energimerking/karakterskalaen"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Enova
                </a>
                {' '}for bygningens årlige energiforbruk per kvadratmeter (kWh/m²/år).
                Energiforbruket estimeres basert på byggeår og gjeldende teknisk forskrift (TEK) ved byggeåret.
              </p>
              <p>
                Estimert energikarakter kan avvike fra registrerte energiattester hos Enova for samme bygning.
              </p>

              <h3>Beregning av besparelser</h3>
              <p>
                Besparelsene beregnes fra datasett som gir estimert besparelse basert på bygningstype, bruksareal (BRA) og
                teknisk forskrift (TEK). Disse variablene hentes automatisk fra Matrikkelen, utenom TEK som estimeres ut fra byggeår. Dette er en forenkling som gjør at det ikke blir tatt hensyn til om bygget har tidligere blitt oppgradert.
              </p>
              <p>
                For solenergi hentes data fra Oslo kommunes{' '}
                <a
                  href="https://od2.pbe.oslo.kommune.no/solkart/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Solkart
                </a>
                . Alle takflater med solpotensial over 800 kWh/m² summeres og multipliseres. Deretter antas det at 85% av takarealet kan utnyttes til solceller, og at solcellene har en virkningsgrad på 20%.
              </p>

              <p className="mobile-energy-solutions__how-it-works-note">
                Merk: Alle beregninger er estimater. Faktiske besparelser varierer ut ifra flere ulike faktorer.
              </p>
            </div>
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
          userEnergyGrade={effectiveEstimatedRating as EnergyGrade | null}
          buildingTypeCategory={boligtype || 'småhus'}
          isUsingEnovaBulkData={!hasUserEdited && enovaBulkData !== null && completedSavingsKWh <= 0}
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
        estimatedRating={effectiveEstimatedRating}
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

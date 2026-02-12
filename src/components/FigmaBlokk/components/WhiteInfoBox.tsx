import React from 'react';
import {
  PktTag,
  PktIcon,
  PktButton,
  PktAlert,
} from '@oslokommune/punkt-react';
import { LocationPin } from './LocationPin';
import {
  DISTRICT_BADGE,
  getBuildingTypeBadgeConfig,
  getDisplayBuildingTypeName,
} from '../../../config/badgeConfig';
import { useContentDictionary } from '../../../hooks/contentHooks';
import {
  renderParagraphWithGlossary,
  dictionaryTermsToGlossary,
} from './Tiltak/glossaryHelpers';
import dictionaryData from '../../../../content/dictionaries/index.json';
import { DesktopTiltakCard } from './Tiltak';
import { DistrictComparisonModal } from './DistrictComparison/DistrictComparisonModal';
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating } from '../../../utils/tekEnergyCalculations';
import { calculateComparisonSavings, type TiltakSavingsInfo } from '../../../utils/energySavingsData';
import {
  getDistrictStatistics,
  getStatsForDistrict,
  getStatsForSubdistrict,
  mapBuildingTypeToCategory,
  lookupBuildingFromEnovaData,
  type EnovaBuildingData,
} from '../../../services/districtStatisticsService';
import type { DistrictStats, EnergyGrade } from '../../../types/districtStatistics';

import { convertKwhToNok, formatCurrency, formatNumberWithSpaces } from '../../../utils/energy';
import { getOsloMapExportUrl } from '../../../utils/coordinateUtils';
import { AddressLookupResponse } from '../../../services/buildingApi';
import '../../../config/badges.css';
import './WhiteInfoBox.css';

const BOX_WIDTH = 360;
const MAP_WIDTH = BOX_WIDTH;
const MAP_HEIGHT = 204;
const MAP_TOP_Y = 496;
const SAVINGS_CARD_HEIGHT = 132;
const HEADER_VERTICAL_OFFSET = 42;
const SIDE_PADDING = 30;
const ADDRESS_TOP_MARGIN = SIDE_PADDING;
const MIN_BADGE_GAP_FROM_ADDRESS = 46;
const BADGE_ROW_BASE_Y = 94;
const BADGE_HEIGHT = 30;
const BADGE_ROW_Y = Math.max(
  BADGE_ROW_BASE_Y - HEADER_VERTICAL_OFFSET,
  ADDRESS_TOP_MARGIN + MIN_BADGE_GAP_FROM_ADDRESS
);
const BADGE_TOP_GAP = BADGE_ROW_Y - ADDRESS_TOP_MARGIN;
// Compensate for the title font's ascenders so optical gap matches address-to-badge spacing.
const SECTION_TITLE_ASCENT_ADJUSTMENT = 10;
const SECTION_TITLE_TOP_GAP = Math.max(0, BADGE_TOP_GAP - SECTION_TITLE_ASCENT_ADJUSTMENT);
const SECTION_TITLE_Y = BADGE_ROW_Y + BADGE_HEIGHT + SECTION_TITLE_TOP_GAP;
const SECTION_TITLE_TO_INFO_GAP = MIN_BADGE_GAP_FROM_ADDRESS;
const BASE_INFO_Y = SECTION_TITLE_Y + SECTION_TITLE_TO_INFO_GAP;
const INFO_ROW_GAP = 28;
const ENERGY_RATING_COLORS: Record<string, string> = {
  A: '#097E3E',
  B: '#32A548',
  C: '#96C133',
  D: '#EFE61E',
  E: '#F7AD24',
  F: '#EA6927',
  G: '#E31829',
};

type TiltakSolutionSlug = {
  slug: string;
};

const TILTAK_SOLUTION_SLUGS: Record<string, TiltakSolutionSlug> = {
  Varmepumpe: { slug: 'varmepumpe' },
  Solenergi: { slug: 'solenergi' },
  Tetting: { slug: 'tetting' },
  Temperaturstyring: { slug: 'temperaturstyring' },
  'Oppgradering av vindu': { slug: 'vinduer' },
  'Isolering av kjeller og loft': { slug: 'etterisolering-kjeller-loft' },
  'Etterisolering av yttervegg': { slug: 'etterisolering-yttervegg' },
  Ventilasjon: { slug: 'ventilasjon' }
};

function resolveTiltakSlug(solution: string | null): string | null {
  if (!solution) {
    return null;
  }
  // Først: sjekk om det er en kjent tittel (bakoverkompatibilitet)
  const mappedSlug = TILTAK_SOLUTION_SLUGS[solution]?.slug;
  if (mappedSlug) {
    return mappedSlug;
  }
  // Så: sjekk om verdien allerede er en gyldig slug (ID)
  // Gyldige slugs er lowercase med bindestreker, uten mellomrom
  if (/^[a-z0-9-]+$/.test(solution) && !solution.startsWith('fallback-')) {
    return solution;
  }
  return null;
}

function resolveTiltakBuildingType(
  buildingData: AddressLookupResponse,
  fallbackName?: string
): string | undefined {
  const resolveFromName = (name?: string | null): string | undefined => {
    if (!name) {
      return undefined;
    }
    const normalised = name.toLowerCase();
    if (normalised.includes('enebolig')) {
      return 'enebolig';
    }
    if (normalised.includes('tomanns')) {
      return 'tomannsbolig';
    }
    if (normalised.includes('rekke')) {
      return 'rekkehus';
    }
    if (normalised.includes('småhus')) {
      return 'enebolig';
    }
    if (
      normalised.includes('blokk') ||
      normalised.includes('leilig') ||
      normalised.includes('boligbygg')
    ) {
      return 'blokk';
    }
    return undefined;
  };

  const codeCandidate =
    buildingData?.bygningstypeKode ||
    buildingData?.csvData?.bygningstypekode ||
    buildingData?.csvData?.bygningstypeKode;

  if (codeCandidate && codeCandidate.length >= 2) {
    const prefix = codeCandidate.slice(0, 2);
    if (['11'].includes(prefix)) {
      return 'enebolig';
    }
    if (['12', '13'].includes(prefix)) {
      return 'rekkehus';
    }
    if (['14', '15', '16', '17'].includes(prefix)) {
      return 'blokk';
    }
  }

  const fromNames =
    resolveFromName(buildingData?.bygningstype) ||
    resolveFromName(buildingData?.bygningstypeNavn) ||
    resolveFromName(buildingData?.csvData?.bygningstype) ||
    resolveFromName(buildingData?.csvData?.bygningstypeNavn) ||
    resolveFromName(fallbackName);

  return fromNames ?? undefined;
}


const roundToNearestThousandValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value / 1000) * 1000;
};

const roundToNearestThousand = (value: number): string => {
  return formatNumberWithSpaces(roundToNearestThousandValue(value));
};

interface WhiteInfoBoxProps {
  showHeader: boolean;
  isExpanded: boolean;
  selectedSolution: string | null;
  addressOnly: string;
  districtName: string;
  buildingTypeName: string;
  mapCoordinates: { lat: number; lng: number } | null;
  buildingData: AddressLookupResponse;
  newEnergyRating?: string | null;
  onExpand?: (expanded: boolean) => void;
  onBackToSolutions?: () => void;
  showYellowBox?: boolean;
  onUpdateBuildingData?: (byggeaar: string, areal: string, arealLeilighet: string, energiforbruk: string) => void;
  totalEnergySavings?: number;
  tiltakInfo?: TiltakSavingsInfo[];
  gulListeLoading?: boolean;
  energyPricePerKwh?: number;
  animateSavings?: boolean;
  onShowInfo?: () => void;
}

export const WhiteInfoBox: React.FC<WhiteInfoBoxProps> = ({
  showHeader,
  isExpanded,
  selectedSolution,
  addressOnly,
  districtName,
  buildingTypeName,
  mapCoordinates,
  buildingData,
  newEnergyRating = null,
  onExpand,
  onBackToSolutions,
  showYellowBox = true,
  onUpdateBuildingData,
  totalEnergySavings = 0,
  tiltakInfo,
  gulListeLoading = false,
  energyPricePerKwh = 1.1,
  animateSavings = true,
  onShowInfo
}) => {
  // State for delayed height expansion
  const [expandHeight, setExpandHeight] = React.useState(false);

  const shouldShowYellowBox = showYellowBox && !gulListeLoading;
  const [isGulListeInfoOpen, setIsGulListeInfoOpen] = React.useState(false);
  const [isDropdownExpanded, setIsDropdownExpanded] = React.useState(false);
  const kulturminnerAccordionRef = React.useRef<HTMLDivElement>(null);
  const gulListeScrollRef = React.useRef<HTMLDivElement>(null);
  const [hoveredGlossaryTerm, setHoveredGlossaryTerm] = React.useState<string | null>(null);
  const [isEditMode, setIsEditMode] = React.useState(false);

  // State for bydelssammenligning (modal)
  const [isComparisonModalOpen, setIsComparisonModalOpen] = React.useState(false);
  const [districtStats, setDistrictStats] = React.useState<DistrictStats | null>(null);
  const [subdistrictStats, setSubdistrictStats] = React.useState<DistrictStats | null>(null);

  // Enova bulk-data for brukerens bolig (for "Sammenlign deg med naboen")
  // Brukes kun til sammenligning, ikke til energikarakter-visning
  const [enovaBulkData, setEnovaBulkData] = React.useState<EnovaBuildingData | null>(null);

  // Hent delbydelsnavn fra csvData
  const subdistrictName = buildingData?.csvData?.delbydelsnavn || null;

  // Hent ordforklaringer fra sentralt dictionary (med fallback til statisk import)
  const { data: dictionary } = useContentDictionary();

  const glossaryEntries = React.useMemo(
    () => dictionaryTermsToGlossary(dictionary?.glossaryTerms ?? dictionaryData.glossaryTerms ?? []),
    [dictionary?.glossaryTerms]
  );
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hasShownSavings, setHasShownSavings] = React.useState(false);
  const [displayedSavings, setDisplayedSavings] = React.useState(0);
  const savingsAnimationFrame = React.useRef<number | null>(null);
  const previousSavingsRef = React.useRef(0);
  
  // Check if building has Enova energy certificate
  const hasEnovaRating = buildingData?.energiattest?.energikarakter ? true : false;
  const shouldShowSavingsCard = totalEnergySavings > 0;
  const isApartmentBuilding =
    buildingTypeName === 'Store boligbygg' || buildingTypeName.toLowerCase() === 'blokk';
  const isBlockBuilding = buildingTypeName.toLowerCase() === 'blokk';
  const buildingTypeCode = buildingData?.bygningstypeKode || buildingData?.csvData?.bygningstypekode || '';
  const roundedSavingsKwh = React.useMemo(
    () => roundToNearestThousandValue(totalEnergySavings),
    [totalEnergySavings]
  );
  const roundedSavingsNok = React.useMemo(
    () => roundToNearestThousandValue(convertKwhToNok(totalEnergySavings, energyPricePerKwh)),
    [totalEnergySavings, energyPricePerKwh]
  );
  const formattedSavingsKwh = React.useMemo(
    () => formatNumberWithSpaces(roundedSavingsKwh),
    [roundedSavingsKwh]
  );
  const formattedSavingsCurrency = React.useMemo(
    () => formatCurrency(roundedSavingsNok),
    [roundedSavingsNok]
  );
  
  React.useEffect(() => {
    if (shouldShowSavingsCard && !hasShownSavings) {
      setHasShownSavings(true);
    }
  }, [shouldShowSavingsCard, hasShownSavings]);

  React.useEffect(() => {
    if (!shouldShowSavingsCard) {
      return;
    }

    const target = roundedSavingsNok;

    if (!animateSavings || prefersReducedMotion) {
      previousSavingsRef.current = target;
      setDisplayedSavings(target);
      return;
    }

    const startValue = previousSavingsRef.current;
    if (startValue === target) {
      return;
    }

    const duration = 900;
    const startTime = performance.now();

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(
        startValue + (target - startValue) * easedProgress
      );
      setDisplayedSavings(nextValue);

      if (progress < 1) {
        savingsAnimationFrame.current = requestAnimationFrame(tick);
      } else {
        previousSavingsRef.current = target;
        savingsAnimationFrame.current = null;
      }
    };

    savingsAnimationFrame.current = requestAnimationFrame(tick);

    return () => {
      if (savingsAnimationFrame.current !== null) {
        cancelAnimationFrame(savingsAnimationFrame.current);
        savingsAnimationFrame.current = null;
      }
    };
  }, [
    roundedSavingsNok,
    animateSavings,
    prefersReducedMotion,
    shouldShowSavingsCard
  ]);

  React.useEffect(() => {
    return () => {
      if (savingsAnimationFrame.current !== null) {
        cancelAnimationFrame(savingsAnimationFrame.current);
      }
    };
  }, []);
  
  // State for address text scaling
  const [addressScale, setAddressScale] = React.useState(1);
  const textRef = React.useRef<SVGTextElement>(null);

  // Use the display text for building type (using central badge config)
  const displayBuildingTypeName = getDisplayBuildingTypeName(buildingTypeName);

  // Get badge configuration from central config
  const buildingBadgeConfig = getBuildingTypeBadgeConfig(buildingTypeName);

  const tiltakBuildingType = React.useMemo(
    () => resolveTiltakBuildingType(buildingData, buildingTypeName),
    [buildingData, buildingTypeName]
  );
  const selectedTiltakSlug = React.useMemo(
    () => resolveTiltakSlug(selectedSolution),
    [selectedSolution]
  );
const tiltakAudience = showYellowBox ? 'gulliste' : 'standard';

  const handleTiltakBack = React.useCallback(() => {
    onExpand?.(false);
    onBackToSolutions?.();
  }, [onBackToSolutions, onExpand]);

  // Store the original fetched values so "Tilbakestill" can always reset to them
  const originalByggeaar = React.useRef(String(buildingData?.byggeaar || '')).current;
  const originalAreal = React.useRef(String(buildingData?.bruksarealM2 || '')).current;
  const originalArealLeilighet = React.useRef(String(buildingData?.arealLeilighet || '')).current;
  // Original energiforbruk beregnes fra original byggeår/areal (for hasUserEdited-sjekk)
  const originalEnergiforbrukRef = React.useRef<string | null>(null);

  const [savedByggeaar, setSavedByggeaar] = React.useState(
    String(buildingData?.byggeaar || '')
  );
  const [savedAreal, setSavedAreal] = React.useState(
    String(buildingData?.bruksarealM2 || '')
  );
  const [savedArealLeilighet, setSavedArealLeilighet] = React.useState(
    String(buildingData?.arealLeilighet || '')
  );
  // Calculate estimated energy consumption based on TEK or energy rating
  // Use saved values if available (they might have been edited)
  const estimatedConsumption = React.useMemo(() => {
    const rawByggeaar = savedByggeaar || buildingData?.byggeaar?.toString() || buildingData?.csvData?.byggeaar;
    const parsedByggeaar = rawByggeaar ? Number(rawByggeaar) : undefined;

    const rawBruksareal =
      savedAreal ||
      (typeof buildingData?.bruksarealM2 === 'number'
        ? buildingData.bruksarealM2.toString()
        : undefined) ||
      buildingData?.csvData?.bruksareal_totalt;

    const bruksareal = rawBruksareal ? Number(rawBruksareal) : undefined;
    const buildingType = determineBuildingType(
      buildingData?.bygningstypeKode,
      buildingTypeName
    );
    
    // Bruker alltid TEK-basert estimering, ikke Enova-attest
    return calculateAnnualEnergyConsumption(parsedByggeaar, bruksareal, buildingType);
  }, [savedByggeaar, savedAreal, buildingData, buildingTypeName]);
  
  // VIKTIG: Nøkkelinformasjon skal ALLTID bruke TEK-estimering, ikke Enova-data.
  // Enova-data brukes KUN i sammenligningsmodulen.
  const [savedEnergiforbruk, setSavedEnergiforbruk] = React.useState(
    String(estimatedConsumption)
  );
  // Lagre original energiverdi ved første render (for hasUserEdited-sjekk)
  if (originalEnergiforbrukRef.current === null) {
    originalEnergiforbrukRef.current = String(estimatedConsumption);
  }
  const [editedByggeaar, setEditedByggeaar] = React.useState(savedByggeaar);
  const [editedAreal, setEditedAreal] = React.useState(savedAreal);
  const [editedArealLeilighet, setEditedArealLeilighet] = React.useState(savedArealLeilighet);
  const [editedEnergiforbruk, setEditedEnergiforbruk] = React.useState(savedEnergiforbruk);

  // Bruker sentral calculateEnergyRating fra tekEnergyCalculations.ts
  const energyRatingLabel = 'Estimert energikarakter';
  const computedEnergyRating = React.useMemo(() => {
    const consumptionNum = Number(savedEnergiforbruk);
    const areaCandidate = savedAreal || (typeof buildingData?.bruksarealM2 === 'number'
      ? String(buildingData.bruksarealM2)
      : buildingData?.csvData?.bruksareal_totalt);
    const areaNum = Number(areaCandidate);

    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0 || !Number.isFinite(areaNum) || areaNum <= 0) {
      return null;
    }

    const intensity = consumptionNum / areaNum;
    const buildingType = determineBuildingType(buildingTypeCode, buildingTypeName);

    return calculateEnergyRating(intensity, areaNum, buildingType);
  }, [
    buildingData?.bruksarealM2,
    buildingData?.csvData?.bruksareal_totalt,
    buildingTypeCode,
    buildingTypeName,
    savedAreal,
    savedEnergiforbruk,
  ]);

  const normalizedCurrentRating = computedEnergyRating?.toUpperCase() ?? null;
  const normalizedNewRating = newEnergyRating ? newEnergyRating.toUpperCase() : null;
  const shouldShowNewRating = Boolean(
    normalizedCurrentRating &&
      normalizedNewRating &&
      normalizedNewRating !== normalizedCurrentRating
  );
  
  // Track if user has manually edited energy consumption
  const [hasUserEditedEnergy, setHasUserEditedEnergy] = React.useState(false);
  const savedEnergyDisplayValue = React.useMemo(() => {
    const numeric = Number(savedEnergiforbruk || '0');
    if (!Number.isFinite(numeric)) {
      return '0';
    }
    if (hasEnovaRating && !isApartmentBuilding) {
      return roundToNearestThousand(numeric);
    }
    return formatNumberWithSpaces(Math.round(numeric));
  }, [savedEnergiforbruk, hasEnovaRating, isApartmentBuilding]);
  
  // Update saved energy consumption when estimated value changes (only if user hasn't edited it)
  // VIKTIG: Nøkkelinformasjon bruker ALLTID TEK-estimering, uavhengig av Enova-data.
  React.useEffect(() => {
    if (!hasUserEditedEnergy) {
      setSavedEnergiforbruk(String(estimatedConsumption));
      setEditedEnergiforbruk(String(estimatedConsumption));
    }
  }, [estimatedConsumption, hasUserEditedEnergy]);
  
  // Recalculate energy consumption when building year or area changes in edit mode (only if user hasn't edited it)
  // VIKTIG: Bruker ALLTID TEK-estimering i edit mode, uavhengig av Enova-data.
  React.useEffect(() => {
    if (isEditMode && !hasUserEditedEnergy) {
      const buildingType = determineBuildingType(
        buildingData?.bygningstypeKode,
        buildingTypeName
      );
      const newEstimate = calculateAnnualEnergyConsumption(editedByggeaar, editedAreal, buildingType);
      setEditedEnergiforbruk(String(newEstimate));
    }
  }, [editedByggeaar, editedAreal, isEditMode, buildingData?.bygningstypeKode, buildingTypeName, hasUserEditedEnergy]);
  
  const energyBlockHeight = isEditMode ? 108 : 96;
  const trimmedApartmentArea = (savedArealLeilighet || '').trim();
  const hasApartmentAreaValue = trimmedApartmentArea.length > 0;
  const shouldShowApartmentAreaRow = isBlockBuilding && (isEditMode || hasApartmentAreaValue);
  const missingVernestatusGap = shouldShowYellowBox ? 0 : INFO_ROW_GAP;

  // Calculate the last info row Y position for determining accordion height
  const lastInfoBaseline = React.useMemo(() => {
    let cursor = BASE_INFO_Y;
    cursor += INFO_ROW_GAP; // byggeaar
    cursor += INFO_ROW_GAP; // areal
    if (isBlockBuilding) cursor += INFO_ROW_GAP; // eierType
    if (shouldShowYellowBox) cursor += INFO_ROW_GAP; // vernestatus
    if (shouldShowApartmentAreaRow) cursor += INFO_ROW_GAP; // apartmentArea
    return cursor - INFO_ROW_GAP; // Go back one to get the last row's Y
  }, [isBlockBuilding, shouldShowYellowBox, shouldShowApartmentAreaRow]);

  const energyInfoTop = lastInfoBaseline + INFO_ROW_GAP + missingVernestatusGap;
  const energyBlockBottom = energyInfoTop + energyBlockHeight;
  const precedingContentBottom = energyBlockBottom;
  const totalAvailableCardSpace =
    MAP_TOP_Y - precedingContentBottom - SAVINGS_CARD_HEIGHT;
  let savingsCardY: number;

  if (totalAvailableCardSpace <= 0) {
    savingsCardY = MAP_TOP_Y - SAVINGS_CARD_HEIGHT;
  } else {
    const equalCardGap = totalAvailableCardSpace / 2;
    savingsCardY = precedingContentBottom + equalCardGap;
  }
  const shouldAnimateSavingsCardIntro =
    shouldShowSavingsCard && !hasShownSavings && animateSavings && !prefersReducedMotion;


  // Call the callback with initial values when component mounts or when savedEnergiforbruk changes
  React.useEffect(() => {
    if (!onUpdateBuildingData) {
      return;
    }
    onUpdateBuildingData(savedByggeaar, savedAreal, savedArealLeilighet, savedEnergiforbruk);
  }, [
    onUpdateBuildingData,
    savedAreal,
    savedArealLeilighet,
    savedByggeaar,
    savedEnergiforbruk,
  ]); // Update when energy consumption changes
  
  // Calculate address text scaling
  React.useEffect(() => {
    if (textRef.current && addressOnly) {
      // Temporarily set to default size to measure
      textRef.current.setAttribute('font-size', '36');
      const bbox = textRef.current.getBBox();
      const naturalWidth = bbox.width;
      
      // Calculate scale to fit within box with 30px margins
      const availableWidth = BOX_WIDTH - 60; // 30px margin on each side
      const scale = Math.min(1, availableWidth / naturalWidth);
      
      setAddressScale(scale);
    }
  }, [addressOnly]);

  // Hent bydels- og delbydel-statistikk for sammenligning
  // Slå også opp brukerens bolig i Enova bulk-data for å sikre "epler med epler"-sammenligning
  React.useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      const data = await getDistrictStatistics();
      if (cancelled || !districtName) return;

      const buildingCategory = mapBuildingTypeToCategory(buildingTypeName);

      // Hent bydel-statistikk
      const stats = getStatsForDistrict(data, districtName, buildingCategory);
      setDistrictStats(stats);

      // Hent delbydel-statistikk hvis tilgjengelig
      if (subdistrictName) {
        const subStats = getStatsForSubdistrict(data, districtName, subdistrictName, buildingCategory);
        setSubdistrictStats(subStats);
      } else {
        setSubdistrictStats(null);
      }

      // Slå opp brukerens bolig i Enova bulk-data
      // Dette brukes KUN for "Sammenlign deg med naboen"-modulen,
      // slik at både brukerdata og bydelsstatistikk kommer fra samme kilde
      const gnr = String(buildingData?.gnr || buildingData?.csvData?.gnr || '');
      const bnr = String(buildingData?.bnr || buildingData?.csvData?.bnr || '');
      const snr = String(buildingData?.seksjonsnummer || '0');
      const bygningsnummer = buildingData?.bygningsnummer || '';

      const enovaData = await lookupBuildingFromEnovaData(bygningsnummer, gnr, bnr, snr);
      if (!cancelled) {
        setEnovaBulkData(enovaData);
      }
    }

    loadStats();

    return () => { cancelled = true; };
  }, [districtName, subdistrictName, buildingTypeName, buildingData]);

  // Sjekk om brukeren har redigert nøkkelinformasjon (byggeår, areal eller energiforbruk)
  // Hvis redigert → Enova bulk-data skal ikke brukes i sammenligningsmodulen
  // Ved tilbakestilling matcher verdiene originalene igjen → hasUserEdited = false
  // Sjekker også energiforbruk (brukeren kan redigere energi direkte)
  const hasUserEdited = React.useMemo(() => {
    return savedByggeaar !== originalByggeaar ||
      savedAreal !== originalAreal ||
      savedArealLeilighet !== originalArealLeilighet ||
      savedEnergiforbruk !== originalEnergiforbrukRef.current;
  }, [savedByggeaar, savedAreal, savedArealLeilighet, savedEnergiforbruk, originalByggeaar, originalAreal, originalArealLeilighet]);

  // Beregn kWh/m² for bydelssammenligning
  // Prioriterer Enova bulk-data for å sikre "epler med epler"-sammenligning,
  // MEN bare hvis brukeren IKKE har redigert nøkkelinformasjon
  const currentKwhPerM2 = React.useMemo(() => {
    // Hvis brukerens bolig finnes i Enova bulk-data og bruker ikke har redigert, bruk den verdien
    if (!hasUserEdited && enovaBulkData?.kwhPerM2 && enovaBulkData.kwhPerM2 > 0) {
      return enovaBulkData.kwhPerM2;
    }

    // Bruk TEK-estimering hvis Enova-data ikke finnes eller bruker har redigert
    const consumption = Number(savedEnergiforbruk);
    const area = Number(savedAreal);
    if (!Number.isFinite(consumption) || consumption <= 0 || !Number.isFinite(area) || area <= 0) {
      return 0;
    }
    return consumption / area;
  }, [hasUserEdited, enovaBulkData, savedEnergiforbruk, savedAreal]);

  // Beregn boligtype-kategori for bydelssammenligning
  const buildingCategory = React.useMemo(
    () => mapBuildingTypeToCategory(buildingTypeName),
    [buildingTypeName]
  );

  // Beregn bruksareal for sammenligning med fallback-kjede
  // Viktig: Må ha gyldig verdi for at projisert energikarakter skal beregnes
  const bruksarealForComparison = React.useMemo(() => {
    const fromSaved = Number(savedAreal);
    if (fromSaved > 0) return fromSaved;

    const fromBuildingData = Number(buildingData?.bruksarealM2);
    if (fromBuildingData > 0) return fromBuildingData;

    const fromCsv = Number(buildingData?.csvData?.bruksareal_totalt);
    if (fromCsv > 0) return fromCsv;

    return 0;
  }, [savedAreal, buildingData?.bruksarealM2, buildingData?.csvData?.bruksareal_totalt]);

  // Beregn skalert besparelse for sammenligningsmodulen
  // Bruker samme calculateComparisonSavings() som mobil for konsistent beregning
  // Hopper over Enova-basert beregning hvis brukeren har redigert nøkkelinformasjon
  const comparisonSavings = React.useMemo(() => {
    if (hasUserEdited || !enovaBulkData?.kwhPerM2 || enovaBulkData.kwhPerM2 <= 0) {
      return totalEnergySavings;
    }
    if (!tiltakInfo || tiltakInfo.length === 0) {
      return totalEnergySavings;
    }
    if (!buildingCategory || (buildingCategory !== 'småhus' && buildingCategory !== 'blokk')) {
      return totalEnergySavings;
    }
    if (!bruksarealForComparison || bruksarealForComparison <= 0) {
      return totalEnergySavings;
    }
    return calculateComparisonSavings(
      enovaBulkData.kwhPerM2,
      bruksarealForComparison,
      buildingCategory as 'småhus' | 'blokk',
      tiltakInfo
    );
  }, [hasUserEdited, enovaBulkData, totalEnergySavings, tiltakInfo, buildingCategory, bruksarealForComparison]);

  // Beregn energikarakter for sammenligningsmodulen.
  // Bruk Enova-karakteren direkte når bulk data foreligger og bruker ikke har redigert,
  // ellers fall tilbake til NS 3031:2025-beregning.
  const comparisonEnergyGrade = React.useMemo(() => {
    if (currentKwhPerM2 <= 0 || bruksarealForComparison <= 0) return null;
    if (!hasUserEdited && enovaBulkData?.energikarakter) {
      return enovaBulkData.energikarakter;
    }
    return calculateEnergyRating(currentKwhPerM2, bruksarealForComparison, buildingCategory as 'småhus' | 'blokk' | null);
  }, [hasUserEdited, currentKwhPerM2, bruksarealForComparison, buildingCategory, enovaBulkData]);

  // Beregn variabler for bydelssammenligning (må være etter currentKwhPerM2)
  const showComparison = districtStats !== null && currentKwhPerM2 > 0;
  // Kartet har fast posisjon (modal overlayer i stedet for å flytte kartet)
  const dynamicMapTopY = MAP_TOP_Y;

  // Handle sequential animation - expand height after width
  React.useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        setExpandHeight(true);
      }, 800);
      return () => clearTimeout(timer);
    }

    setExpandHeight(false);
    return undefined;
  }, [isExpanded]);
  

const previewWrapperStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: 0,
  overflowX: 'hidden',
  overflowY: 'hidden'
};

const tiltakPreview = selectedTiltakSlug ? (
    <div style={previewWrapperStyle}>
      <DesktopTiltakCard
        tiltakId={selectedTiltakSlug}
        audience={tiltakAudience}
        buildingType={tiltakBuildingType}
        buildingData={buildingData}
        className="white-info-box__tiltak-card"
        onBack={handleTiltakBack}
      />
    </div>
  ) : null;
  
  // Shadow dimensions match visible area of white info box
  // Now positioned relative to parent flex container (.tiltak-side__info-panel)
  const shadowWidth = isExpanded ? 840 : 360;
  const shadowHeight = 790 - 90; // Subtract clip-path top inset
  const shadowLeft = isExpanded ? -480 : 0; // Relative to parent (was artboard-based)

  return (
    <>
      {/* Shadow layer - outside clip-path to be visible */}
      <div
        style={{
          position: 'absolute',
          left: `${shadowLeft}px`,
          bottom: 0,
          width: shadowWidth,
          height: shadowHeight,
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
          opacity: showHeader ? 1 : 0,
          transition: `opacity 1s ease-in-out 0.5s, width 0.8s ease-in-out, left 0.8s ease-in-out`,
          zIndex: 999,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          /* Positioned relative to parent flex container (.tiltak-side__info-panel)
           * Container is 840px wide, but only 360px visible in collapsed state
           * When expanded: translateX(-480px) moves container to left
           */
          left: 0,
          bottom: 0,
          width: 840,
          height: 790,
          transform: isExpanded ? 'translateX(-480px)' : 'translateX(0)',
          clipPath: expandHeight
            ? 'inset(0 0 0 0)'  // Fully expanded
            : isExpanded
              ? 'inset(90px 0 0 0)'  // Width expanded, height not
              : 'inset(90px 480px 0 0)',  // Fully collapsed - clip from RIGHT side (content is on left)
          opacity: showHeader ? 1 : 0,
          transition: `opacity 1s ease-in-out 0.5s, transform 0.8s ease-in-out, clip-path ${
            expandHeight && isExpanded ? '0.6s' : '0.8s'
          } ease-in-out ${
            expandHeight && isExpanded ? '0s' : '0s'
          }`,
          zIndex: 1000,
          overflow: 'hidden'
        }}
      >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <svg
          width="840"
          height="790"
          viewBox={`0 -90 840 790`}
          preserveAspectRatio="xMinYMin meet"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
          }}
        >
      <rect width="840" height="790" y="-90" fill="white"/>
      <g clipPath="url(#clip0_325_12689)">
        <g style={{ opacity: isExpanded ? 0 : 1, transition: isExpanded ? 'opacity 0.3s ease-in-out' : 'opacity 0.5s ease-in-out 0.5s' }}>
        {/* Address text with proportional scaling */}
        <text 
          ref={textRef}
          x="30" 
          y={ADDRESS_TOP_MARGIN}
          dominantBaseline="hanging"
          fontFamily="Oslo Sans, sans-serif" 
          fontWeight="500"
          fontStyle="normal"
          fontSize={36 * addressScale} 
          letterSpacing="-0.2"
          fill="#2A2859"
          textAnchor="start"
        >
          {addressOnly}
        </text>
        {/* Badges med PktTag - bruker sentral badge-konfigurasjon */}
        <foreignObject x="30" y={BADGE_ROW_Y} width={BOX_WIDTH - 60} height="36">
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="white-info-box__badges"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            {districtName && (
              <PktTag
                skin={DISTRICT_BADGE.skin}
                aria-label={`${DISTRICT_BADGE.ariaLabelPrefix}: ${districtName}`}
              >
                <PktIcon name={DISTRICT_BADGE.iconName} />
                <span>{districtName}</span>
              </PktTag>
            )}
            {displayBuildingTypeName && (
              <PktTag
                skin={buildingBadgeConfig.skin}
                aria-label={`${buildingBadgeConfig.ariaLabelPrefix}: ${displayBuildingTypeName}`}
              >
                <PktIcon name={buildingBadgeConfig.iconName} />
                <span>{displayBuildingTypeName}</span>
              </PktTag>
            )}
          </div>
        </foreignObject>
        
        {/* Nøkkelinformasjon - enkel seksjon med synlig innhold */}
        <foreignObject
          x="16"
          y={SECTION_TITLE_Y - 12}
          width={BOX_WIDTH - 32}
          height={energyBlockBottom - SECTION_TITLE_Y + 40}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="white-info-box__section"
          >
            <div className="white-info-box__section-header">
              <div className="white-info-box__section-title-row">
                <h3 className="white-info-box__section-title">Nøkkelinformasjon</h3>
                {onShowInfo && (
                  <PktButton
                    skin="tertiary"
                    size="small"
                    variant="icon-only"
                    iconName="information"
                    aria-label="Hvordan fungerer Energinøkkelen?"
                    onClick={onShowInfo}
                  />
                )}
              </div>
              <PktButton
                skin="tertiary"
                size="small"
                variant="icon-left"
                iconName={isEditMode ? 'check' : 'edit'}
                onClick={() => {
                  if (isEditMode) {
                    setSavedByggeaar(editedByggeaar);
                    setSavedAreal(editedAreal);
                    setSavedArealLeilighet(editedArealLeilighet);
                    setSavedEnergiforbruk(editedEnergiforbruk);
                    setIsEditMode(false);
                    if (onUpdateBuildingData) {
                      onUpdateBuildingData(editedByggeaar, editedAreal, editedArealLeilighet, editedEnergiforbruk);
                    }
                  } else {
                    setEditedByggeaar(savedByggeaar);
                    setEditedAreal(savedAreal);
                    setEditedArealLeilighet(savedArealLeilighet);
                    setEditedEnergiforbruk(savedEnergiforbruk);
                    setIsEditMode(true);
                    setHasUserEditedEnergy(false);
                  }
                }}
              >
                {isEditMode ? 'Lagre' : 'Rediger'}
              </PktButton>
            </div>
            <div className="white-info-box__key-info">
              {!isEditMode ? (
                <>
                  <div className="white-info-box__info-row">
                    <span className="white-info-box__info-label">Byggeår:</span>
                    <span className="white-info-box__info-value">{savedByggeaar || 'Ukjent'}</span>
                  </div>
                  <div className="white-info-box__info-row">
                    <span className="white-info-box__info-label">Areal:</span>
                    <span className="white-info-box__info-value">{savedAreal || 'Ukjent'} m²</span>
                  </div>
                  {isBlockBuilding && (
                    <div className="white-info-box__info-row">
                      <span className="white-info-box__info-label">Eiertype:</span>
                      <span className="white-info-box__info-value">Borettslag</span>
                    </div>
                  )}
                  {shouldShowYellowBox && (
                    <div className="white-info-box__info-row white-info-box__info-row--vernestatus">
                      <span className="white-info-box__info-label">Vernestatus:</span>
                      <span className="white-info-box__info-value">Gul liste</span>
                      <button
                        type="button"
                        className="white-info-box__vernestatus-button"
                        onClick={() => {
                          setIsGulListeInfoOpen(true);
                          setHoveredGlossaryTerm(null);
                        }}
                        title="Hva betyr Gul liste?"
                      >
                        !
                      </button>
                    </div>
                  )}
                  {shouldShowApartmentAreaRow && (
                    <div className="white-info-box__info-row">
                      <span className="white-info-box__info-label">Areal Leilighet:</span>
                      <span className="white-info-box__info-value">{savedArealLeilighet || 'Ukjent'} m²</span>
                    </div>
                  )}
                  <div className="white-info-box__energy-block">
                    <div className="white-info-box__energy-rating">
                      <span className="white-info-box__energy-rating-label">{energyRatingLabel}:</span>
                      <div className="white-info-box__energy-rating-value">
                        {normalizedCurrentRating ? (
                          <span
                            className="white-info-box__rating-box"
                            style={{ backgroundColor: ENERGY_RATING_COLORS[normalizedCurrentRating] }}
                          >
                            {normalizedCurrentRating}
                          </span>
                        ) : (
                          <span className="white-info-box__energy-rating-empty">Ukjent</span>
                        )}
                        {shouldShowNewRating && normalizedNewRating ? (
                          <>
                            <span className="white-info-box__rating-arrow">{'\u2192'}</span>
                            <span
                              className="white-info-box__rating-box white-info-box__rating-box--new"
                              style={{ backgroundColor: ENERGY_RATING_COLORS[normalizedNewRating] }}
                            >
                              {normalizedNewRating}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <span className="white-info-box__energy-label">Estimert energiforbruk:</span>
                    <div className="white-info-box__energy-value">
                      <span className="white-info-box__energy-amount">{savedEnergyDisplayValue}</span>
                      <span className="white-info-box__energy-unit">kWh/år</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="white-info-box__edit-row">
                    <label className="white-info-box__edit-label" htmlFor="edit-byggeaar-desktop">Byggeår:</label>
                    <input
                      id="edit-byggeaar-desktop"
                      type="text"
                      inputMode="numeric"
                      className="white-info-box__edit-input"
                      value={editedByggeaar}
                      onChange={(e) => setEditedByggeaar(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                  <div className="white-info-box__edit-row">
                    <label className="white-info-box__edit-label" htmlFor="edit-areal-desktop">Areal (m²):</label>
                    <input
                      id="edit-areal-desktop"
                      type="text"
                      inputMode="numeric"
                      className="white-info-box__edit-input"
                      value={editedAreal}
                      onChange={(e) => setEditedAreal(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                  {isBlockBuilding && (
                    <>
                      <div className="white-info-box__info-row">
                        <span className="white-info-box__info-label">Eiertype:</span>
                        <span className="white-info-box__info-value">Borettslag</span>
                      </div>
                      <div className="white-info-box__edit-row">
                        <label className="white-info-box__edit-label" htmlFor="edit-areal-leilighet-desktop">Areal leilighet (m²):</label>
                        <input
                          id="edit-areal-leilighet-desktop"
                          type="text"
                          inputMode="numeric"
                          className="white-info-box__edit-input"
                          value={editedArealLeilighet}
                          onChange={(e) => setEditedArealLeilighet(e.target.value.replace(/[^0-9]/g, ''))}
                        />
                      </div>
                    </>
                  )}
                  {shouldShowYellowBox && (
                    <div className="white-info-box__info-row white-info-box__info-row--vernestatus">
                      <span className="white-info-box__info-label">Vernestatus:</span>
                      <span className="white-info-box__info-value">Gul liste</span>
                      <button
                        type="button"
                        className="white-info-box__vernestatus-button"
                        onClick={() => {
                          setIsGulListeInfoOpen(true);
                          setHoveredGlossaryTerm(null);
                        }}
                        title="Hva betyr Gul liste?"
                      >
                        !
                      </button>
                    </div>
                  )}
                  <div className="white-info-box__edit-row">
                    <label className="white-info-box__edit-label" htmlFor="edit-energi-desktop">Energiforbruk (kWh/år):</label>
                    <input
                      id="edit-energi-desktop"
                      type="text"
                      inputMode="numeric"
                      className="white-info-box__edit-input"
                      value={editedEnergiforbruk}
                      onChange={(e) => {
                        setEditedEnergiforbruk(e.target.value.replace(/[^0-9]/g, ''));
                        setHasUserEditedEnergy(true);
                      }}
                    />
                  </div>
                  <div className="white-info-box__edit-actions">
                    <PktButton
                      skin="secondary"
                      size="small"
                      onClick={() => {
                        setEditedByggeaar(savedByggeaar);
                        setEditedAreal(savedAreal);
                        setEditedArealLeilighet(savedArealLeilighet);
                        setEditedEnergiforbruk(savedEnergiforbruk);
                        setIsEditMode(false);
                      }}
                    >
                      Avbryt
                    </PktButton>
                    <PktButton
                      skin="tertiary"
                      size="small"
                      variant="icon-left"
                      iconName="arrow-circle"
                      onClick={() => {
                        const buildingType = determineBuildingType(buildingData?.bygningstypeKode, buildingTypeName);
                        const origEnergy = String(calculateAnnualEnergyConsumption(
                          originalByggeaar ? Number(originalByggeaar) : undefined,
                          originalAreal ? Number(originalAreal) : undefined,
                          buildingType
                        ));
                        setSavedByggeaar(originalByggeaar);
                        setSavedAreal(originalAreal);
                        setSavedArealLeilighet(originalArealLeilighet);
                        setSavedEnergiforbruk(origEnergy);
                        setEditedByggeaar(originalByggeaar);
                        setEditedAreal(originalAreal);
                        setEditedArealLeilighet(originalArealLeilighet);
                        setEditedEnergiforbruk(origEnergy);
                        setHasUserEditedEnergy(false);
                        setIsEditMode(false);
                        if (onUpdateBuildingData) {
                          onUpdateBuildingData(originalByggeaar, originalAreal, originalArealLeilighet, origEnergy);
                        }
                      }}
                    >
                      Tilbakestill
                    </PktButton>
                  </div>
                </>
              )}
            </div>
          </div>
        </foreignObject>
        {shouldShowSavingsCard && (
          <foreignObject
            x="16"
            y={savingsCardY}
            width={BOX_WIDTH - 32}
            height={SAVINGS_CARD_HEIGHT}
            aria-label={`Estimert besparelse ${formattedSavingsCurrency}`}
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              className={`white-info-box__savings-card ${
                shouldAnimateSavingsCardIntro
                  ? 'white-info-box__savings-card--animating'
                  : 'white-info-box__savings-card--visible'
              }`}
            >
              <span className="white-info-box__savings-label">
                Estimert besparelse
              </span>
              <div className="white-info-box__savings-value">
                <div className="white-info-box__savings-amount-wrapper">
                  <RollingDigitsDisplay
                    value={displayedSavings}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </div>
                <span className="white-info-box__savings-unit">
                  kr/år
                </span>
              </div>
              <div className="white-info-box__savings-kwh">
                ≈ {formattedSavingsKwh} kWh/år
              </div>
            </div>
          </foreignObject>
        )}

        {/* Map placeholder rectangle - dynamisk posisjon basert på bydelssammenligning */}
        <rect x="0" y={dynamicMapTopY} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#E5E5E5" stroke="#D0D0D0" strokeWidth="1"/>

        {/* Map image if coordinates are available - Oslo kommune karttjeneste */}
        {mapCoordinates && (
          <>
            <clipPath id="mapClip">
              <rect x="0" y={dynamicMapTopY} width={MAP_WIDTH} height={MAP_HEIGHT} />
            </clipPath>
            <g clipPath="url(#mapClip)">
              <image
                x="0"
                y={dynamicMapTopY}
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                href={getOsloMapExportUrl(mapCoordinates.lat, mapCoordinates.lng, MAP_WIDTH, MAP_HEIGHT)}
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
            {/* Location pin centered on map */}
            <g transform={`translate(${MAP_WIDTH / 2 - 14} ${dynamicMapTopY + MAP_HEIGHT / 2 - 32})`}>
              <LocationPin />
            </g>
          </>
        )}

        {/* Map loading text */}
        {!mapCoordinates && (
          <text
            x={MAP_WIDTH / 2}
            y={dynamicMapTopY + MAP_HEIGHT / 2}
            fontFamily="Oslo Sans, sans-serif"
            fontSize="14"
            fill="#666666"
            textAnchor="middle"
          >
            Laster kart...
          </text>
        )}

        </g>

{/* Gul liste info overlay - plassert utenfor SVG for bedre tilgjengelighet */}
        
      </g>
      
      <defs>
        <clipPath id="clip0_325_12689">
          <rect width={BOX_WIDTH} height="760" fill="white"/>
        </clipPath>
      </defs>
    </svg>

      </div>

      {/* Modal for bydelssammenligning */}
      {showComparison && districtStats && (
        <DistrictComparisonModal
          isOpen={isComparisonModalOpen}
          onClose={() => setIsComparisonModalOpen(false)}
          currentKwhPerM2={currentKwhPerM2}
          totalEnergySavings={comparisonSavings}
          bruksareal={bruksarealForComparison}
          districtName={districtName}
          districtStats={districtStats}
          subdistrictName={subdistrictName ?? undefined}
          subdistrictStats={subdistrictStats ?? undefined}
buildingTypeCategory={buildingCategory}
          userEnergyGrade={comparisonEnergyGrade as EnergyGrade | null}
          isUsingEnovaBulkData={!hasUserEdited && enovaBulkData !== null}
        />
      )}

      {/* Gul liste info overlay - HTML/CSS-basert, matcher original SVG-design */}
      {shouldShowYellowBox && isGulListeInfoOpen && (
        <div
          style={{
            position: 'absolute',
            top: '440px',
            transform: 'translateY(-50%)',
            left: 0,
            width: `${BOX_WIDTH}px`,
            maxHeight: '700px',
            backgroundColor: '#FFE7BC',
            zIndex: 200,
            fontFamily: 'Oslo Sans, sans-serif',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Lukkeknapp */}
          <button
            onClick={() => {
              setIsGulListeInfoOpen(false);
              setIsDropdownExpanded(false);
              setHoveredGlossaryTerm(null);
            }}
            aria-label="Lukk Gul liste informasjon"
            style={{
              position: 'absolute',
              top: '16px',
              right: '30px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              zIndex: 10
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M14.5333 16L5 6.46667L6.46667 5L16 14.5333L25.5333 5L27 6.46667L17.4667 16L27 25.5333L25.5333 27L16 17.4667L6.46667 27L5 25.5333L14.5333 16Z" fill="#2A2859"/>
            </svg>
          </button>

          {/* Scrollbart innhold */}
          <div
            ref={gulListeScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '48px 32px 24px 32px'
            }}
          >
            {/* Tittel */}
            <h2
              style={{
                fontSize: '26px',
                fontWeight: 500,
                letterSpacing: '-0.2px',
                color: '#000000',
                margin: '0 0 20px 0',
                paddingRight: '30px'
              }}
            >
              Hva er Gul liste?
            </h2>

            {/* Hovedtekst */}
            <div
              style={{
                fontSize: '14px',
                lineHeight: '22px',
                fontWeight: 300,
                color: '#000000',
                marginBottom: '24px'
              }}
            >
              {renderParagraphWithGlossary({
                paragraph: 'Gul liste er Byantikvarens oversikt over verneverdige bygninger og kulturmiljøer i Oslo. Den inneholder blant annet bolighus, hager, parker, broer og veier med kulturhistorisk verdi. Listen brukes som et verktøy i arbeidet med å ta vare på viktige deler av byens historie. Gul liste oppdateres jevnlig, men er ikke en fullstendig oversikt over alle kulturminner i Oslo. Kulturminnene på Gul liste er delt inn i tre grupper: De kan være kommunalt listeført, vernet etter plan- og bygningsloven eller fredet.',
                glossary: glossaryEntries,
                hoveredTerm: hoveredGlossaryTerm,
                setHoveredTerm: setHoveredGlossaryTerm
              })}
            </div>

            {/* Ekstern lenke */}
            <a
              href="https://www.oslo.kommune.no/plan-bygg-og-eiendom/kulturminner-og-vern/gul-liste/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#000000',
                textDecoration: 'underline',
                fontSize: '14px',
                lineHeight: '22px',
                fontWeight: 500,
                display: 'inline-block',
                marginBottom: '16px'
              }}
            >
              Les mer om Gul liste
            </a>

            {/* Info-boks med PktAlert */}
            <div style={{ marginBottom: '16px' }}>
              <PktAlert skin="info" compact>
                <span>Du kan absolutt gjøre tiltak for å energieffektivisere det verneverdige bygget ditt!</span>
              </PktAlert>
            </div>

            {/* Custom accordion for "Hvorfor ta vare på kulturminner" */}
            <div ref={kulturminnerAccordionRef}>
              <button
                onClick={() => {
                  const willExpand = !isDropdownExpanded;
                  setIsDropdownExpanded(willExpand);
                  if (willExpand) {
                    requestAnimationFrame(() => {
                      const accordion = kulturminnerAccordionRef.current;
                      const scrollContainer = gulListeScrollRef.current;
                      if (accordion && scrollContainer) {
                        const accordionTop = accordion.offsetTop - scrollContainer.offsetTop;
                        scrollContainer.scrollTo({ top: accordionTop - 16, behavior: 'smooth' });
                      }
                    });
                  } else {
                    requestAnimationFrame(() => {
                      gulListeScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                  }
                }}
                style={{
                  width: '100%',
                  backgroundColor: '#2A2859',
                  border: 'none',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 400,
                    letterSpacing: '-0.2px',
                    color: '#ffffff'
                  }}
                >
                  Hvorfor ta vare på kulturminner
                </span>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{
                    transform: isDropdownExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease'
                  }}
                >
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 14.56L4.7466 7.5L3.75 8.47002L12 16.5L20.25 8.47002L19.2534 7.5L12 14.56Z" fill="white"/>
                </svg>
              </button>
              {isDropdownExpanded && (
                <div
                  style={{
                    backgroundColor: '#2A2859',
                    padding: '0 16px 16px 16px',
                    fontSize: '14px',
                    lineHeight: '22px',
                    fontWeight: 300,
                    color: '#ffffff'
                  }}
                >
                  <p style={{ margin: '0 0 16px 0' }}>
                    Kulturminner gir oss kunnskap om historien vår og hvordan tidligere generasjoner levde.
                    De forteller om samfunnsutvikling, byggetradisjoner og arkitektoniske løsninger,
                    og er en viktig del av vår identitet og felles hukommelse.
                    Ved å bevare kulturminner tar vi vare på en ressurs som ikke kan erstattes – og som kan være både miljøvennlig og bærekraftig i bruk.
                  </p>
                  <p style={{ margin: '0 0 16px 0' }}>
                    Gamle bygninger er ofte oppført i materialer og håndverk av høy kvalitet,
                    og med riktige tiltak kan de tilpasses moderne behov uten å miste sitt særpreg.
                    Bevaring gir ikke bare verdi til enkeltbygg, men styrker også byens mangfold og karakter.
                  </p>
                  <p style={{ margin: '0 0 16px 0' }}>
                    Kulturminner er ikke bare fortiden – de er også en del av fremtidens løsninger.
                  </p>
                  <a
                    href="https://kulturminnefondet.no/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#ffffff', textDecoration: 'underline' }}
                  >
                    Les mer fra Kulturminnefondet her.
                  </a>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Render tiltak preview outside SVG when expanded */}
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: isExpanded && selectedSolution ? 1 : 0, 
        transition: isExpanded ? 'opacity 0.5s ease-in-out 1s' : 'opacity 0.3s ease-in-out',
        pointerEvents: isExpanded ? 'auto' : 'none',
        visibility: selectedTiltakSlug ? 'visible' : 'hidden'
      }}>
        {tiltakPreview}
      </div>
    </div>

    {/* Knapp for bydelssammenligning - plassert utenfor animert container så den ligger fast over kartet */}
    {showComparison && (
      <div
        className="white-info-box__comparison-button-container"
        style={{
          position: 'absolute',
          left: '16px',
          bottom: '16px',
          zIndex: 1001,
          opacity: showHeader && !isExpanded ? 1 : 0,
          pointerEvents: isExpanded ? 'none' : 'auto',
          transition: isExpanded
            ? 'opacity 0.3s ease-in-out'
            : 'opacity 0.5s ease-in-out 0.8s',
        }}
      >
        <PktButton
          skin="primary"
          size="small"
          variant="icon-left"
          iconName="eye"
          onClick={() => setIsComparisonModalOpen(true)}
          className="white-info-box__comparison-button"
        >
          <span>Sammenlign deg med naboene dine</span>
        </PktButton>
      </div>
    )}
    </>
  );
};

const DIGITS = Array.from({ length: 10 }, (_, index) => index);
const DIGIT_HEIGHT_EM = 1.05;

interface RollingDigitProps {
  digit: string;
  prefersReducedMotion: boolean;
}

const RollingDigit: React.FC<RollingDigitProps> = ({ digit, prefersReducedMotion }) => {
  if (!/^\d$/.test(digit) || prefersReducedMotion) {
    return (
      <span className="white-info-box__rolling-digit">
        <span style={{ lineHeight: '1.1em' }}>{digit}</span>
      </span>
    );
  }

  const numericDigit = Number(digit);

  return (
    <span className="white-info-box__rolling-digit">
      <span
        className="white-info-box__rolling-digit-inner"
        style={{
          transform: `translateY(calc(-1 * ${numericDigit} * ${DIGIT_HEIGHT_EM}em))`
        }}
      >
        {DIGITS.map((stackDigit) => (
          <span
            key={stackDigit}
            className="white-info-box__rolling-digit-value"
          >
            {stackDigit}
          </span>
        ))}
      </span>
    </span>
  );
};

interface RollingDigitsDisplayProps {
  value: number;
  prefersReducedMotion: boolean;
}

const RollingDigitsDisplay: React.FC<RollingDigitsDisplayProps> = ({
  value,
  prefersReducedMotion
}) => {
  const formattedValue = React.useMemo(
    () => value.toLocaleString('nb-NO').replace(/\u00A0/g, ' '),
    [value]
  );

  return (
    <span className="white-info-box__rolling-digits">
      {formattedValue.split('').map((character, index) => {
        if (/^\d$/.test(character)) {
          return (
            <RollingDigit
              key={index}
              digit={character}
              prefersReducedMotion={prefersReducedMotion}
            />
          );
        }

        return (
          <span
            key={`separator-${index}`}
            className="white-info-box__rolling-digit-separator"
          >
            {character}
          </span>
        );
      })}
    </span>
  );
};

const usePrefersReducedMotion = () => {
  const [prefers, setPrefers] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefers(event.matches);
    };

    setPrefers(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return prefers;
};

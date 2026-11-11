import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AddressLookupResponse } from '../../services/buildingApi';
import {
  trackNeighborComparison,
  trackTiltakChecked,
  trackTiltakCompleted,
  trackTiltakExpanded,
  trackHowToImplement,
} from '../../analytics';
import { getDisplayBuildingTypeName } from '../../config/badgeConfig';
import { useTiltakCatalog, useTilskuddCatalog } from '../../hooks/contentHooks';
import type { TiltakCatalogItem } from '../../types/contentCatalog';
import { OsloLogo } from '../FigmaBlokk/components/OsloLogo';
import { MobileInfoBox } from './MobileInfoBox';
import { capitalizeAdresse } from '../../utils/adresseFormat';
import { useEiendomsgruppe } from '../../hooks/useEiendomsgruppe';
import { gruppenavn as gruppenavnFmt } from '../../utils/eiendomsgruppeFormat';
import {
  beregnGruppeBaselineForbruk,
  computeEiendomsgruppeSavings,
} from '../../utils/eiendomsgruppeSavings';
import { MobileDistrictComparison } from './MobileDistrictComparison';
import { MobileProsessenVidere } from './MobileProsessenVidere';
import { MobileSheet } from './MobileSheet';
import { MobileTiltakTile } from './MobileTiltakTile';
import { MobileBottomBar } from './MobileBottomBar';
import { MobileTypePickerSheet, type TypePickerOption } from './MobileTypePickerSheet';
import { MobileTiltakInfoSheet } from './MobileTiltakInfoSheet';
import { MobileHowItWorksSheet } from './MobileHowItWorksSheet';
import { formatSavingsNok } from './mobileFormat';
import {
  VARMEPUMPE_TYPES,
  VINDUER_TYPES,
  applyTiltakAction,
  defaultVinduerTypeNye,
  diffSelection,
  getTileStatus,
  isVinduerPartial,
  needsTypePicker,
  type PickerMode,
  type TiltakAction,
  type TiltakSelection,
  type VarmepumpeType,
  type VinduerType,
} from './tiltakSelection';
import { calculateAnnualEnergyConsumption, determineBuildingType, calculateEnergyRating, calculateEnergyRatingWithFjernvarme } from '../../utils/tekEnergyCalculations';
import { BLOCK_CODE_GROUPS, resolveBuildingTypeCodeString } from '../../utils/buildingTypeCode';
import { calculateTekPeriod, parseNumericValue } from '../FigmaBlokk/components/Tiltak/shared';
import { computeAggregatedSavingsNok } from '../../utils/tiltakSavings';
import {
  calculateCombinedSavings,
  calculateComparisonSavings,
  getAvailableVinduerTypes,
  getRateForTiltakId,
  hasEnergyEffect,
  type TiltakSavingsInfo,
  type Boligtype,
  type TekPeriodInput,
} from '../../utils/energySavingsData';
import type { ContentAudience } from '../../../content/schema-helpers';
import { normaliseBuildingTypeKey } from '../../utils/tiltakContent';
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
  /** Tiltak-IDer som forhåndsavhukes én gang når katalogen er lastet (fra temavariant, f.eks. /solceller) */
  initialCheckedTiltak?: string[];
}

type SheetState =
  | { kind: 'info'; tiltakId: string }
  | { kind: 'picker'; tiltakId: string; mode: PickerMode }
  | { kind: 'omBoligen' }
  | { kind: 'howItWorks' }
  | null;

/** Marginal besparelse for et sett nye tiltak, gitt tiltakene som er gjort fra før */
interface NewSavingsResult {
  kwh: number;
  /** Ferdig summert kr i gruppevisning (borettslag/sameie), ellers null */
  groupNok: number | null;
  /** Antall tiltak som ikke kunne beregnes */
  uncalculable: number;
}

/**
 * Bestem byggtype-nøkkel for katalog-filtrering
 */
const determineBuildingTypeKey = (
  buildingTypeCode: string,
  buildingTypeNameLower: string
): string | undefined => {
  // Enebolig (kode 11) og fritidsbolig, koie/seterhus (kode 16-17)
  if (['11', '16', '17'].includes(buildingTypeCode) || buildingTypeNameLower.includes('enebolig')) {
    return 'enebolig';
  }
  if (buildingTypeCode === '12' || buildingTypeNameLower.includes('tomannsbolig')) {
    return 'tomannsbolig';
  }
  if (
    buildingTypeCode === '13' ||
    buildingTypeNameLower.includes('rekkehus') ||
    buildingTypeNameLower.includes('kjedehus') ||
    buildingTypeNameLower.includes('kjedet') ||
    buildingTypeNameLower.includes('småhus')
  ) {
    return 'rekkehus';
  }
  if (
    BLOCK_CODE_GROUPS.includes(buildingTypeCode) ||
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

    // Energieffekt-filter (som desktop): skjul alle tiltak uten effekt for aktuelt bygg.
    // Unntak: solenergi (produksjon, alltid vist).
    let energyEffectMatch = true;
    if (tekPeriod && boligtype && t.id !== 'solenergi') {
      const rates = getRateForTiltakId(t.id, tekPeriod, boligtype, { erPaaGulListe });
      if (rates === null || !hasEnergyEffect(rates)) {
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
  yearlyConsumption = '',
  estimatedRating,
  solarData,
  mapCoordinates = null,
  showYellowBox = false,
  totalEnergySavings: _totalEnergySavings = 0,
  audience = 'standard',
  isUsingEnovaData: _isUsingEnovaData = false,
  initialCheckedTiltak,
}) => {
  // Borettslag/sameie-deteksjon + aggregat
  const mobileEiendomsgruppe = useEiendomsgruppe({
    kommunenummer: buildingData.kommunenummer ?? '0301',
    gaardsnummer: buildingData.gnr,
    bruksnummer: buildingData.bnr,
  });
  const [mobileViewMode, setMobileViewMode] = React.useState<'enkelt' | 'gruppe'>('enkelt');
  React.useEffect(() => {
    if (mobileViewMode === 'enkelt') return;
    const groupAvailable =
      mobileEiendomsgruppe.shouldShowToggle &&
      (mobileEiendomsgruppe.aggregat !== null || mobileEiendomsgruppe.aggregatLoading);
    if (!groupAvailable) {
      setMobileViewMode('enkelt');
    }
  }, [
    mobileEiendomsgruppe.shouldShowToggle,
    mobileEiendomsgruppe.aggregat,
    mobileEiendomsgruppe.aggregatLoading,
    mobileViewMode,
  ]);
  const mobileEiendomsgruppeVisning = React.useMemo(() => {
    if (
      mobileEiendomsgruppe.aggregat &&
      mobileEiendomsgruppe.detection &&
      mobileEiendomsgruppe.detection.type !== 'enkelt'
    ) {
      return {
        navn: gruppenavnFmt(
          mobileEiendomsgruppe.detection.type,
          mobileEiendomsgruppe.detection.navn,
          buildingData.adresse,
        ),
        type: mobileEiendomsgruppe.detection.type,
        antallEnheter: mobileEiendomsgruppe.aggregat.antallEnheter,
        antallUnikeBygg: mobileEiendomsgruppe.aggregat.antallUnikeBygg,
        totalBruksarealM2: mobileEiendomsgruppe.aggregat.totalBruksarealM2,
        byggeaar: mobileEiendomsgruppe.aggregat.bygninger.map((b) => b.byggeaar),
        estimatedAnnualConsumptionKWh: beregnGruppeBaselineForbruk(mobileEiendomsgruppe.aggregat.bygninger),
      } as const;
    }
    return undefined;
  }, [mobileEiendomsgruppe.aggregat, mobileEiendomsgruppe.detection, buildingData.adresse]);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  // Hvilket bunnark som er åpent (infoark, typevalg, «Om boligen» eller forklaringen)
  const [sheet, setSheet] = useState<SheetState>(null);
  // Om utregningen over bunnlinja er åpen
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Bydelssammenligning state
  const [showDistrictComparison, setShowDistrictComparison] = useState(false);
  // Prosessen videre state
  const [showProsessenVidere, setShowProsessenVidere] = useState(false);
  const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);
  const [subdistrictStats, setSubdistrictStats] = useState<DistrictStats | null>(null);

  // Enova bulk-data for brukerens bolig (for "Sammenlign deg med naboen")
  // Brukes kun til sammenligning, ikke til tiltaksberegninger
  const [enovaBulkData, setEnovaBulkData] = useState<EnovaBuildingData | null>(null);

  // Fjernvarme-toggle (påvirker energimerke-beregning)
  const [fjernvarme, setFjernvarme] = useState(false);

  // Varmepumpe-spesifikk state
  const [selectedVarmepumpeType, setSelectedVarmepumpeType] = useState<VarmepumpeType>('luft-luft');

  // Vinduer-spesifikk state (tolags/trelags-valg)
  const [selectedVinduerTypeNye, setSelectedVinduerTypeNye] = useState<VinduerType>('trelags');
  const [completedVinduerType, setCompletedVinduerType] = useState<VinduerType>('tolags');


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


  // Hent tiltakskatalog dynamisk
  const { data: catalogData, isLoading: isCatalogLoading } = useTiltakCatalog();

  // Utled gul liste-status fra audience prop (App.tsx er "single source of truth" via PBE-oppslag)
  const erPaaGulListe = audience === 'gulliste';

  // Bygningstypedata
  const buildingTypeCode = useMemo(() => {
    return resolveBuildingTypeCodeString(updatedBuildingData)?.substring(0, 2) ?? '';
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


  // Boligtype for energibesparelses-beregninger (småhus eller blokk)
  // Bruker sentralisert determineBuildingType() for konsistens med desktop
  const boligtype: Boligtype | null = useMemo(() => {
    return determineBuildingType(
      resolveBuildingTypeCodeString(updatedBuildingData),
      updatedBuildingData?.bygningstype || updatedBuildingData?.csvData?.bygningstype
    );
  }, [updatedBuildingData]);

  // TEK-periode for energibesparelses-oppslag
  // calculateTekPeriod håndterer ugyldig/manglende byggeår (gir TEK49)
  const tekPeriod: TekPeriodInput = useMemo(() => {
    return calculateTekPeriod(buildingYear || 0);
  }, [buildingYear]);

  // Hvilke vinduer-typer er aktuelle (jf. desktop).
  const availableVinduerTypes = useMemo<Array<'tolags' | 'trelags'>>(() => {
    if (!tekPeriod || !boligtype) return [];
    return getAvailableVinduerTypes(tekPeriod, boligtype, erPaaGulListe);
  }, [tekPeriod, boligtype, erPaaGulListe]);

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


  // Beregn total besparelse basert på valgte tiltak
  const [calculatedSavings, setCalculatedSavings] = useState(0);
  // Overstyring for gruppe-modus: summert NOK fra computeEiendomsgruppeSavings
  // som tar hensyn til forskjellige boligtyper/priser per bygg.
  const [groupCalculatedSavingsNok, setGroupCalculatedSavingsNok] = useState<number | null>(null);

  // Sol-andel av marginal besparelse (for sentral kr-beregning).
  // Sol legges lineært, så scaledSolarEnergy er sol-bidraget hvis solenergi er valgt som nytt tiltak.
  const marginalSolarKwh = useMemo(() => {
    if (!checkedItems.has('solenergi')) return 0;
    return scaledSolarEnergy && scaledSolarEnergy > 0 ? scaledSolarEnergy : 0;
  }, [checkedItems, scaledSolarEnergy]);

  const calculatedSavingsNok = useMemo(
    () => {
      // I gruppe-modus beregnes NOK per bygg og summeres i
      // computeEiendomsgruppeSavings (med riktig sol-prisjustering per bygg).
      if (groupCalculatedSavingsNok !== null) {
        return groupCalculatedSavingsNok;
      }
      return computeAggregatedSavingsNok({
        totalKwh: calculatedSavings,
        solarKwhContribution: marginalSolarKwh,
        boligtype,
        energyPricePerKwh: 1.1,
      });
    },
    [groupCalculatedSavingsNok, calculatedSavings, marginalSolarKwh, boligtype]
  );
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
  const displayTiltak: Array<{ id: string; title: string }> = useMemo(() => {
    // Vis tom liste mens katalog lastes
    if (isCatalogLoading) {
      return [];
    }

    return filteredTiltak.map((t) => ({ id: t.id, title: t.title }));
  }, [isCatalogLoading, filteredTiltak]);

  // Forhåndsavhuk temavariantens tiltak (f.eks. solenergi på /solceller) én gang
  // når katalogen er lastet. Kun tiltak som faktisk vises for bygget hukes av.
  const initialTiltakApplied = useRef(false);
  useEffect(() => {
    if (initialTiltakApplied.current) return;
    if (!initialCheckedTiltak?.length || displayTiltak.length === 0) return;
    initialTiltakApplied.current = true;
    const valid = initialCheckedTiltak.filter((id) => displayTiltak.some((t) => t.id === id));
    if (valid.length > 0) {
      setCheckedItems((prev) => new Set([...prev, ...valid]));
    }
  }, [initialCheckedTiltak, displayTiltak]);


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
          vinduerTab: tiltak.id === 'vinduer' ? completedVinduerType : undefined,
        });
        if (rates !== null) info.push({ title: tiltak.id, rates });
      }
    });
    return info;
  }, [boligtype, scaledSolarEnergy, completedItems, completedVinduerType, displayTiltak, erPaaGulListe, selectedVarmepumpeType, tekPeriod]);

  // Besparelse fra gjennomførte tiltak (baseline-reduksjon)
  const completedSavingsKWh = useMemo(() => {
    if (completedTiltakInfo.length === 0) return 0;
    const consumptionNum = effectiveYearlyConsumption ? parseFloat(effectiveYearlyConsumption) : estimatedAnnualConsumption;
    if (!Number.isFinite(consumptionNum) || consumptionNum <= 0 || !tekPeriod || !boligtype) return 0;
    return calculateCombinedSavings(consumptionNum, completedTiltakInfo, tekPeriod, boligtype, bruksareal);
  }, [completedTiltakInfo, effectiveYearlyConsumption, estimatedAnnualConsumption, tekPeriod, boligtype, bruksareal]);

  // Beregn marginal besparelse for et sett nye tiltak med multiplikativ metode,
  // gitt tiltakene som er gjort fra før. Brukes for valgte tiltak (bunnlinja),
  // for hver enkelt flis og for «kan spare opptil».
  // VIKTIG: Bruker ALLTID TEK/byggtype-basert beregning for energibesparelser
  // (Enova-data brukes KUN i sammenligningsmodulen)
  const computeNewSavings = useCallback(
    (
      checked: ReadonlySet<string>,
      overrides?: { varmepumpeType?: VarmepumpeType; vinduerType?: VinduerType },
    ): NewSavingsResult => {
      const varmepumpeType = overrides?.varmepumpeType ?? selectedVarmepumpeType;
      const vinduerTypeNye = overrides?.vinduerType ?? selectedVinduerTypeNye;

      // Gruppe-modus: aggreger besparelse per bygg i borettslaget/sameiet.
      const aggBygg = mobileEiendomsgruppe.aggregat?.bygninger;
      if (
        mobileViewMode === 'gruppe' &&
        aggBygg &&
        aggBygg.length > 0 &&
        catalogData?.items
      ) {
        const publishedCatalog = catalogData.items.filter((t) => t.status === 'published');
        const displayTiltakForGruppe = publishedCatalog.map((t) => ({ id: t.id, title: t.title }));
        const filterForBygg = (b: {
          byggeaar: number | null;
          bygningstypeKodeId: number | null;
          bygningstypeKode?: string | null;
        }) => {
          const bYear = b.byggeaar ?? 0;
          const bTek = calculateTekPeriod(bYear) as TekPeriodInput;
          // 3-sifret kode – aldri Matrikkelens interne ID (ID 13 = kode 142, blokk)
          const bCode = resolveBuildingTypeCodeString(b);
          const bType = determineBuildingType(bCode, undefined);
          const bTypeKey = determineBuildingTypeKey(bCode?.substring(0, 2) ?? '', '');
          return filterTiltakForBuilding(
            publishedCatalog,
            bTypeKey,
            b.byggeaar ?? undefined,
            bTek,
            bType,
            erPaaGulListe,
          ).map((t) => ({ id: t.id, title: t.title }));
        };
        const result = computeEiendomsgruppeSavings({
          bygninger: aggBygg.map((b) => ({
            byggId: b.byggId,
            byggeaar: b.byggeaar,
            bruksarealM2: b.bruksarealM2,
            bygningstypeKodeId: b.bygningstypeKodeId,
            bygningstypeKode: b.bygningstypeKode,
            solar: b.solar ? { filteredSolarEnergy: b.solar.filteredSolarEnergy } : null,
          })),
          displayTiltak: displayTiltakForGruppe,
          displayTiltakForBygg: filterForBygg,
          checkedItems: checked,
          completedItems,
          selectedVarmepumpeType: varmepumpeType,
          selectedVinduerTypeNye: vinduerTypeNye,
          completedVinduerType,
          erPaaGulListe,
        });
        return {
          kwh: result.totalNewSavingsKWh,
          groupNok: result.totalNewSavingsNok,
          uncalculable: 0,
        };
      }

      // Enkelt-modus (og fallback når gruppe-aggregatet ikke er klart enda):
      // beregn besparelse for den ene boligen.

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
        return { kwh: 0, groupNok: null, uncalculable: checked.size };
      }

      // Bestem byggkategori og TEK-periode direkte
      const buildingCategory = determineBuildingType(buildingTypeCode, buildingTypeName);
      if (!buildingCategory) {
        return { kwh: 0, groupNok: null, uncalculable: checked.size };
      }

      const tekPeriodCalc = calculateTekPeriod(parsedByggeaar);
      const energyBuildingCategory: Boligtype = buildingCategory === 'blokk' ? 'blokk' : 'småhus';

      // ALLTID bruk TEK-basert beregning for energibesparelser (ikke Enova-data)
      const consumptionNum = calculateAnnualEnergyConsumption(parsedByggeaar, parsedBruksareal, energyBuildingCategory);

      // Bygg liste med tiltak og deres rates for multiplikativ beregning (kun nye tiltak)
      const tiltakInfo: TiltakSavingsInfo[] = [];
      let uncalculable = 0;

      checked.forEach((tiltakId) => {
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
            varmepumpeTab: tiltak.id === 'varmepumpe' ? varmepumpeType : undefined,
            vinduerTab: tiltak.id === 'vinduer' ? vinduerTypeNye : undefined,
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
      // Vinduer-overlap: tolags (gjennomført) + trelags (nye) skal IKKE multipliseres
      const hasCompletedVinduerTolags = completedItems.has('vinduer') && completedVinduerType === 'tolags';
      const hasNyeVinduer = checked.has('vinduer');
      const allTiltakInfo = (hasCompletedVinduerTolags && hasNyeVinduer)
        ? [...completedTiltakInfo.filter(t => t.title !== 'vinduer'), ...tiltakInfo]
        : [...completedTiltakInfo, ...tiltakInfo];
      const totalCombinedSavings = allTiltakInfo.length > 0
        ? calculateCombinedSavings(consumptionNum, allTiltakInfo, tekPeriodCalc, energyBuildingCategory, parsedBruksareal)
        : 0;

      // Marginal besparelse = total - gjennomførte (det brukeren ser)
      const marginalSavings = Math.max(0, totalCombinedSavings - completedSavingsKWh);

      return { kwh: marginalSavings, groupNok: null, uncalculable };
    },
    [
      bruksareal,
      scaledSolarEnergy,
      buildingTypeCode,
      buildingTypeName,
      buildingYear,
      completedItems,
      completedTiltakInfo,
      completedSavingsKWh,
      completedVinduerType,
      displayTiltak,
      erPaaGulListe,
      selectedVarmepumpeType,
      selectedVinduerTypeNye,
      mobileViewMode,
      mobileEiendomsgruppe.aggregat,
      catalogData,
    ],
  );

  // Oppdater total besparelse når valgte eller gjennomførte tiltak endres
  useEffect(() => {
    if (checkedItems.size === 0 && completedItems.size === 0) {
      setCalculatedSavings(0);
      setUncalculableCount(0);
      setGroupCalculatedSavingsNok(null);
      return;
    }

    const result = computeNewSavings(checkedItems);
    setCalculatedSavings(result.kwh);
    setGroupCalculatedSavingsNok(result.groupNok);
    setUncalculableCount(result.uncalculable);
  }, [checkedItems, completedItems.size, computeNewSavings]);

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

    if (fjernvarme && tekPeriod && boligtype) {
      return calculateEnergyRatingWithFjernvarme(adjustedConsumption, bruksareal, boligtype, tekPeriod, boligtype);
    }

    const intensity = adjustedConsumption / bruksareal;
    return calculateEnergyRating(intensity, bruksareal, boligtype);
  }, [effectiveYearlyConsumption, bruksareal, boligtype, estimatedRating, completedSavingsKWh, fjernvarme, tekPeriod]);

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

    let rating: string;
    if (fjernvarme && tekPeriod && boligtype) {
      rating = calculateEnergyRatingWithFjernvarme(newConsumption, bruksareal, boligtype, tekPeriod, boligtype);
    } else {
      const newIntensity = newConsumption / bruksareal;
      rating = calculateEnergyRating(newIntensity, bruksareal, boligtype);
    }

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
    fjernvarme,
    tekPeriod,
  ]);


  // Samlet valgtilstand for flisene (leses av valgreglene i tiltakSelection.ts)
  const selection: TiltakSelection = useMemo(
    () => ({
      checked: checkedItems,
      completed: completedItems,
      varmepumpeType: selectedVarmepumpeType,
      vinduerTypeNye: selectedVinduerTypeNye,
      completedVinduerType,
    }),
    [checkedItems, completedItems, selectedVarmepumpeType, selectedVinduerTypeNye, completedVinduerType],
  );

  // Utfør et valg (velg, fjern, gjort fra før, angre) og spor det som endret seg
  const dispatchSelection = useCallback(
    (action: TiltakAction) => {
      const next = applyTiltakAction(selection, action, availableVinduerTypes);
      const changes = diffSelection(selection, next);
      changes.checked.forEach(([id, isChecked]) => trackTiltakChecked(id, isChecked));
      changes.completed.forEach(([id, isCompleted]) => trackTiltakCompleted(id, isCompleted));
      if (changes.checked.length > 0) {
        setCheckedItems(new Set(next.checked));
      }
      if (changes.completed.length > 0) {
        setCompletedItems(new Set(next.completed));
      }
      setSelectedVarmepumpeType(next.varmepumpeType);
      setSelectedVinduerTypeNye(next.vinduerTypeNye);
      setCompletedVinduerType(next.completedVinduerType);
    },
    [selection, availableVinduerTypes],
  );

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
    // Hvis brukerens bolig finnes i Enova bulk-data, bruker ikke har redigert,
    // og ingen gjennomførte tiltak er valgt (for å unngå dobbelttelling), bruk Enova-verdien
    if (!hasUserEdited && completedSavingsKWh <= 0 && enovaBulkData?.kwhPerM2 && enovaBulkData.kwhPerM2 > 0) {
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
    // Hopp over Enova-basert beregning hvis bruker har redigert, gjennomførte tiltak er valgt, eller Enova-data mangler
    if (hasUserEdited || completedSavingsKWh > 0 || !enovaBulkData?.kwhPerM2 || enovaBulkData.kwhPerM2 <= 0 || !boligtype || !bruksareal || bruksareal <= 0) {
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
          vinduerTab: tiltak.id === 'vinduer' ? selectedVinduerTypeNye : undefined,
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
    completedSavingsKWh,
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
    selectedVinduerTypeNye,
    scaledSolarEnergy,
  ]);


  // Reset scroll-posisjon når komponenten monteres
  // Dette forhindrer at scroll-offset fra forrige visning (f.eks. når tastatur var åpent) forplanter seg
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);



  // ---------------------------------------------------------------------
  // Visningsmodell for fliser, bunnlinje og ark
  // ---------------------------------------------------------------------

  // Kroner for et beregningsresultat. Gruppevisning har ferdig summert beløp.
  const savingsToNok = useCallback(
    (result: NewSavingsResult, includesSolar: boolean): number => {
      if (result.groupNok !== null) {
        return result.groupNok;
      }
      return computeAggregatedSavingsNok({
        totalKwh: result.kwh,
        solarKwhContribution:
          includesSolar && scaledSolarEnergy && scaledSolarEnergy > 0 ? scaledSolarEnergy : 0,
        boligtype,
        energyPricePerKwh: 1.1,
      });
    },
    [scaledSolarEnergy, boligtype],
  );

  // Besparelse i kr for ett tiltak alene, gitt det som er gjort fra før.
  // Null når besparelsen ikke kan beregnes for boligen.
  const savingsNokFor = useCallback(
    (
      tiltakId: string,
      overrides?: { varmepumpeType?: VarmepumpeType; vinduerType?: VinduerType },
    ): number | null => {
      const result = computeNewSavings(new Set([tiltakId]), overrides);
      if (result.uncalculable > 0 || result.kwh <= 0) {
        return null;
      }
      const nok = savingsToNok(result, tiltakId === 'solenergi');
      return nok > 0 ? nok : null;
    },
    [computeNewSavings, savingsToNok],
  );

  // Antall tilskuddsordninger per tiltak, filtrert på bygningstype og gul liste.
  // Brukes bare til å velge etikett på flisa («Tilskudd» eller «Les mer»).
  const { data: tilskuddCatalog } = useTilskuddCatalog();
  const grantCountByTiltak = useMemo(() => {
    const counts = new Map<string, number>();
    const typeKey = normaliseBuildingTypeKey(buildingTypeKey);
    (tilskuddCatalog?.items ?? []).forEach((item) => {
      if (typeKey !== 'default' && !item.buildingTypes.includes(typeKey)) return;
      if (!item.audiences.includes(audience)) return;
      item.appliesToTiltak.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    });
    return counts;
  }, [tilskuddCatalog?.items, buildingTypeKey, audience]);

  const vinduerPartial = isVinduerPartial(selection, availableVinduerTypes);

  const tiles = useMemo(
    () =>
      displayTiltak.map((tiltak) => {
        const status = getTileStatus(tiltak.id, selection, availableVinduerTypes);
        const isVarmepumpe = tiltak.id === 'varmepumpe';
        const isVinduer = tiltak.id === 'vinduer';

        let savingsNok: number | null;
        let isFromAmount = false;
        if (isVarmepumpe && status === 'available') {
          // Ikke valgt ennå: vis laveste besparelse blant typene som «fra»
          const amounts = VARMEPUMPE_TYPES.map((type) =>
            savingsNokFor(tiltak.id, { varmepumpeType: type.id }),
          ).filter((amount): amount is number => amount !== null);
          savingsNok = amounts.length > 0 ? Math.min(...amounts) : null;
          isFromAmount = amounts.length > 1;
        } else if (isVinduer && status === 'available') {
          savingsNok = savingsNokFor(tiltak.id, {
            vinduerType: vinduerPartial ? 'trelags' : defaultVinduerTypeNye(availableVinduerTypes),
          });
        } else {
          savingsNok = savingsNokFor(tiltak.id);
        }

        let title = tiltak.title;
        if (isVarmepumpe && status !== 'available') {
          const type = VARMEPUMPE_TYPES.find((t) => t.id === selectedVarmepumpeType);
          title = `${tiltak.title}: ${(type?.label ?? '').toLowerCase()}`;
        } else if (isVinduer && vinduerPartial) {
          title = 'Vinduer: to-lags til tre-lags';
        } else if (isVinduer && status === 'selected' && availableVinduerTypes.length > 1) {
          title = `Vinduer: ${selectedVinduerTypeNye === 'trelags' ? 'tre-lags' : 'to-lags'} glass`;
        }

        const amountLabel =
          savingsNok !== null ? `${isFromAmount ? 'fra ' : ''}${formatSavingsNok(savingsNok)}` : null;

        return {
          id: tiltak.id,
          baseTitle: tiltak.title,
          title,
          status,
          savingsNok,
          amountLabel,
          subLabel: status === 'done' ? 'Gjort fra før' : amountLabel ?? 'Ikke beregnet',
          canUndoDone: status === 'done' || (isVinduer && vinduerPartial),
          infoLabel: (grantCountByTiltak.get(tiltak.id) ?? 0) > 0 ? 'Tilskudd' : 'Les mer',
        };
      }),
    [
      displayTiltak,
      selection,
      availableVinduerTypes,
      vinduerPartial,
      savingsNokFor,
      selectedVarmepumpeType,
      selectedVinduerTypeNye,
      grantCountByTiltak,
    ],
  );

  const tileById = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles]);
  const chosenTiles = tiles.filter((tile) => tile.status === 'selected');
  const doneTiles = tiles.filter((tile) => tile.canUndoDone);

  // «Kan spare opptil»: samlet besparelse hvis alle gjenstående tiltak velges.
  // Regnes bare ut når ingenting er valgt, siden det er da tallet vises.
  const potentialNok = useMemo(() => {
    if (checkedItems.size > 0) {
      return 0;
    }
    const ids = displayTiltak
      .map((tiltak) => tiltak.id)
      .filter((id) => getTileStatus(id, selection, availableVinduerTypes) !== 'done');
    if (ids.length === 0) {
      return 0;
    }
    const idSet = new Set(ids);
    const vinduerType = defaultVinduerTypeNye(availableVinduerTypes);
    const varmepumpeTypes = idSet.has('varmepumpe')
      ? VARMEPUMPE_TYPES.map((type) => type.id)
      : [selectedVarmepumpeType];
    return varmepumpeTypes.reduce((best, varmepumpeType) => {
      const result = computeNewSavings(idSet, { varmepumpeType, vinduerType });
      return Math.max(best, savingsToNok(result, idSet.has('solenergi')));
    }, 0);
  }, [
    checkedItems.size,
    displayTiltak,
    selection,
    availableVinduerTypes,
    selectedVarmepumpeType,
    computeNewSavings,
    savingsToNok,
  ]);

  // Tall til sammenligningen i «Om boligen» (kWh per kvadratmeter og år).
  // Vises ikke i gruppevisning, der tallene gjelder flere bygg.
  const districtComparison = useMemo(() => {
    if (!districtStats || mobileViewMode === 'gruppe' || !bruksareal || currentKwhPerM2 <= 0) {
      return undefined;
    }
    return {
      current: currentKwhPerM2,
      withTiltak:
        checkedItems.size > 0 && comparisonSavings > 0
          ? Math.max(0, currentKwhPerM2 - comparisonSavings / bruksareal)
          : null,
      districtAverage: districtStats.avgKwhPerM2,
      buildingTypeLabel: boligtype === 'blokk' ? 'boligblokker' : 'småhus',
    };
  }, [districtStats, mobileViewMode, bruksareal, currentKwhPerM2, checkedItems.size, comparisonSavings, boligtype]);

  // Lukk utregningen når ingenting er valgt, så den ikke spretter opp ved neste valg
  useEffect(() => {
    if (checkedItems.size === 0) {
      setBreakdownOpen(false);
    }
  }, [checkedItems.size]);

  const closeSheet = useCallback(() => setSheet(null), []);

  const openInfoSheet = useCallback((tiltakId: string) => {
    trackTiltakExpanded(tiltakId);
    setSheet({ kind: 'info', tiltakId });
  }, []);

  // Trykk på flisa: velg som nytt tiltak (eller fjern). Typevalg åpner eget ark.
  const handleToggleTiltak = (tiltakId: string) => {
    const status = getTileStatus(tiltakId, selection, availableVinduerTypes);
    if (needsTypePicker(tiltakId, 'ny', selection, availableVinduerTypes)) {
      setSheet({ kind: 'picker', tiltakId, mode: 'ny' });
      return;
    }
    dispatchSelection({ type: status === 'selected' ? 'unselect' : 'select', id: tiltakId });
    setSheet(null);
  };

  // «Gjort fra før» / «Angre»
  const handleToggleDone = (tiltakId: string) => {
    if (tileById.get(tiltakId)?.canUndoDone) {
      dispatchSelection({ type: 'undoDone', id: tiltakId });
      setSheet(null);
      return;
    }
    if (needsTypePicker(tiltakId, 'gjort', selection, availableVinduerTypes)) {
      setSheet({ kind: 'picker', tiltakId, mode: 'gjort' });
      return;
    }
    dispatchSelection({ type: 'markDone', id: tiltakId });
    setSheet(null);
  };

  const renderPickerSheet = () => {
    if (sheet?.kind !== 'picker') {
      return null;
    }
    const { tiltakId, mode } = sheet;
    const tile = tileById.get(tiltakId);
    if (!tile) {
      return null;
    }
    const isSelected = tile.status === 'selected';
    const isVarmepumpe = tiltakId === 'varmepumpe';
    // Beløp vises bare når typen velges som nytt tiltak
    const showAmounts = mode === 'ny' && tile.status !== 'done';
    const amountFor = (overrides: { varmepumpeType?: VarmepumpeType; vinduerType?: VinduerType }) => {
      const nok = showAmounts ? savingsNokFor(tiltakId, overrides) : null;
      return nok !== null ? formatSavingsNok(nok) : undefined;
    };

    let heading: string;
    let intro: string;
    let primaryLabel: string;
    let initialId: string;
    let options: TypePickerOption[];

    if (isVarmepumpe) {
      options = VARMEPUMPE_TYPES.map((type) => ({
        id: type.id,
        label: type.label,
        description: type.description,
        amountLabel: amountFor({ varmepumpeType: type.id }),
      }));
      initialId = selectedVarmepumpeType;
      if (mode === 'ny') {
        heading = 'Hvilken type varmepumpe?';
        intro = 'Typen avgjør hvor mye du sparer. Du kan endre valget senere.';
        primaryLabel = isSelected ? 'Lagre valg' : 'Legg til';
      } else {
        heading = 'Hvilken varmepumpe har du fra før?';
        intro = 'Vi regner den inn i dagens energikarakter.';
        primaryLabel = 'Merk som gjort fra før';
      }
    } else if (mode === 'ny') {
      options = VINDUER_TYPES.filter((type) => availableVinduerTypes.includes(type.id)).map((type) => ({
        id: type.id,
        label: type.label,
        description: type.description,
        amountLabel: amountFor({ vinduerType: type.id }),
      }));
      initialId = isSelected ? selectedVinduerTypeNye : defaultVinduerTypeNye(availableVinduerTypes);
      heading = 'Hvilke vinduer vil du bytte til?';
      intro = 'Typen avgjør hvor mye du sparer. Du kan endre valget senere.';
      primaryLabel = isSelected ? 'Lagre valg' : 'Legg til';
    } else {
      options = [
        { id: 'tolags', label: 'To-lags glass', description: 'Du kan fortsatt oppgradere til tre-lags' },
        { id: 'trelags', label: 'Tre-lags glass', description: 'Vinduene regnes som ferdig oppgradert' },
      ];
      initialId = 'tolags';
      heading = 'Hva slags vinduer har du i dag?';
      intro = 'Har du to-lags glass, kan du fortsatt oppgradere til tre-lags.';
      primaryLabel = 'Lagre';
    }

    return (
      <MobileTypePickerSheet
        key={`${tiltakId}-${mode}`}
        heading={heading}
        intro={intro}
        options={options}
        initialId={initialId}
        primaryLabel={primaryLabel}
        onConfirm={(optionId) => {
          const type = mode === 'ny' ? 'select' : 'markDone';
          dispatchSelection(
            isVarmepumpe
              ? { type, id: tiltakId, varmepumpeType: optionId as VarmepumpeType }
              : { type, id: tiltakId, vinduerType: optionId as VinduerType },
          );
          setSheet(null);
        }}
        onClose={closeSheet}
        onShowInfo={() => openInfoSheet(tiltakId)}
        onRemove={
          mode === 'ny' && isSelected
            ? () => {
                dispatchSelection({ type: 'unselect', id: tiltakId });
                setSheet(null);
              }
            : undefined
        }
      />
    );
  };

  const renderInfoSheet = () => {
    if (sheet?.kind !== 'info') {
      return null;
    }
    const tile = tileById.get(sheet.tiltakId);
    if (!tile) {
      return null;
    }
    const isSelected = tile.status === 'selected';
    return (
      <MobileTiltakInfoSheet
        key={tile.id}
        tiltakId={tile.id}
        title={tile.title}
        buildingType={buildingTypeKey}
        buildingTypeLabel={getDisplayBuildingTypeName(buildingTypeName).toLowerCase()}
        audience={audience}
        savingsLabel={
          tile.status === 'done'
            ? 'Gjort fra før'
            : tile.amountLabel
              ? `Estimert besparelse ${tile.amountLabel}`
              : null
        }
        doneLabel={tile.canUndoDone ? 'Angre gjort fra før' : 'Gjort fra før'}
        toggleLabel={isSelected ? 'Fjern fra valgte' : 'Legg til'}
        onToggleDone={() => handleToggleDone(tile.id)}
        onToggle={() => {
          if (isSelected) {
            dispatchSelection({ type: 'unselect', id: tile.id });
            setSheet(null);
            return;
          }
          handleToggleTiltak(tile.id);
        }}
        onClose={closeSheet}
      />
    );
  };

  // Adressefeltet: adresse (eller navn på borettslag/sameie) og en kort nøkkellinje
  const isGroupView = mobileViewMode === 'gruppe' && Boolean(mobileEiendomsgruppeVisning);
  const summaryAddress =
    isGroupView && mobileEiendomsgruppeVisning
      ? mobileEiendomsgruppeVisning.navn
      : capitalizeAdresse(addressOnly);
  const summaryMeta = (
    isGroupView && mobileEiendomsgruppeVisning
      ? [
          mobileEiendomsgruppeVisning.type === 'borettslag' ? 'Borettslag' : 'Sameie',
          `${mobileEiendomsgruppeVisning.antallEnheter.toLocaleString('nb-NO')} boenheter`,
          districtName,
        ]
      : [
          getDisplayBuildingTypeName(buildingTypeName),
          buildingYear ? `bygd ${buildingYear}` : '',
          districtName,
          erPaaGulListe ? 'Gul liste' : '',
        ]
  ).filter(Boolean);

  return (
    <div className="mobile-energy-solutions mobile-energy-solutions--fade-in">
      <header className="mobile-energy-solutions__header">
        <div className="mobile-energy-solutions__header-content">
          <OsloLogo className="mobile-energy-solutions__logo" />
          <span className="mobile-energy-solutions__header-title">Energinøkkelen</span>
        </div>
        <button
          type="button"
          className="mobile-energy-solutions__search-button"
          aria-label="Søk på ny adresse"
          onClick={onBack}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 L21 21" />
          </svg>
        </button>
      </header>

      <main className="mobile-energy-solutions__main">
        <section className="mobile-energy-solutions__address-band">
          <div className="mobile-energy-solutions__address-text">
            <h1 className="mobile-energy-solutions__address">{summaryAddress}</h1>
            {summaryMeta.length > 0 && (
              <span className="mobile-energy-solutions__address-meta">{summaryMeta.join(' · ')}</span>
            )}
          </div>
          <button
            type="button"
            className="mobile-energy-solutions__about-link"
            onClick={() => setSheet({ kind: 'omBoligen' })}
          >
            Om boligen
          </button>
        </section>

        <div className="mobile-energy-solutions__list-header">
          <h2 className="mobile-energy-solutions__section-title">Velg energioppgraderinger</h2>
          {tiles.length > 0 && (
            <span className="mobile-energy-solutions__status">
              {doneTiles.length > 0 ? `${doneTiles.length} gjort fra før` : 'Trykk for å velge'}
            </span>
          )}
        </div>

        {isCatalogLoading ? (
          <p className="mobile-energy-solutions__message">Laster tiltak …</p>
        ) : tiles.length === 0 ? (
          <p className="mobile-energy-solutions__message">
            Ingen tiltak tilgjengelig for denne bygningstypen.
          </p>
        ) : (
          <ul className="mobile-energy-solutions__tiles">
            {tiles.map((tile) => (
              <MobileTiltakTile
                key={tile.id}
                tiltakId={tile.id}
                title={tile.title}
                baseTitle={tile.baseTitle}
                status={tile.status}
                subLabel={tile.subLabel}
                canUndoDone={tile.canUndoDone}
                infoLabel={tile.infoLabel}
                onToggle={() => handleToggleTiltak(tile.id)}
                onToggleDone={() => handleToggleDone(tile.id)}
                onOpenInfo={() => openInfoSheet(tile.id)}
              />
            ))}
          </ul>
        )}
      </main>

      <MobileBottomBar
        chosen={chosenTiles.map((tile) => ({ id: tile.id, title: tile.title, nok: tile.savingsNok }))}
        totalNok={calculatedSavingsNok}
        totalKwh={calculatedSavings}
        potentialNok={potentialNok}
        baseRating={effectiveEstimatedRating}
        newRating={newRating}
        doneTitles={[
          ...doneTiles.map((tile) => tile.baseTitle.toLowerCase()),
          ...(fjernvarme ? ['fjernvarme'] : []),
        ]}
        uncalculableCount={uncalculableCount}
        expanded={breakdownOpen}
        onToggleExpanded={() => setBreakdownOpen((open) => !open)}
        onForward={() => {
          trackHowToImplement();
          setShowProsessenVidere(true);
        }}
        onShowHowItWorks={() => setSheet({ kind: 'howItWorks' })}
      />

      {renderInfoSheet()}
      {renderPickerSheet()}

      {sheet?.kind === 'howItWorks' && <MobileHowItWorksSheet onClose={closeSheet} />}

      {/* Om boligen */}
      {sheet?.kind === 'omBoligen' && (
        <MobileSheet label="Om boligen" onClose={closeSheet} size="full">
          <MobileInfoBox
            addressOnly={addressOnly}
            districtName={districtName}
            buildingTypeName={buildingTypeName}
            buildingData={updatedBuildingData}
            originalBuildingData={buildingData}
            onUpdateBuildingData={handleUpdateBuildingData}
            mapCoordinates={mapCoordinates}
            showYellowBox={showYellowBox || erPaaGulListe}
            totalEnergySavings={calculatedSavings}
            totalEnergySavingsNok={calculatedSavingsNok}
            onCollapse={closeSheet}
            showCompareButton={!!districtStats && mobileViewMode !== 'gruppe'}
            completedSavings={completedSavingsKWh}
            fjernvarme={fjernvarme}
            viewMode={mobileViewMode}
            eiendomsgruppeVisning={mobileEiendomsgruppeVisning}
            showViewModeToggle={mobileEiendomsgruppe.shouldShowToggle}
            eiendomsgruppeLoaderNavn={
              mobileEiendomsgruppe.detection?.type === 'borettslag'
                ? mobileEiendomsgruppe.detection.navn ?? 'borettslaget'
                : gruppenavnFmt(
                    mobileEiendomsgruppe.detection?.type ?? 'sameie',
                    mobileEiendomsgruppe.detection?.navn,
                    buildingData.adresse,
                  )
            }
            onToggleViewMode={(next) => setMobileViewMode(next)}
            onToggleFjernvarme={() => setFjernvarme((value) => !value)}
            onShowHowItWorks={() => setSheet({ kind: 'howItWorks' })}
            comparison={districtComparison}
            onCompareClick={() => {
              trackNeighborComparison();
              setSheet(null);
              setShowDistrictComparison(true);
            }}
          />
        </MobileSheet>
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
  );
};

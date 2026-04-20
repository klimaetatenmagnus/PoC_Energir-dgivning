/**
 * Per-bygg besparelsesberegning — ren funksjon som speiler memo-kjeden
 * i EnergySolutionButtons. Trukket ut for å kunne kjøres i løkke over
 * flere bygg i borettslag/sameie-aggregering (jfr. docs/grunnbok-feature.md
 * task #19).
 */

import {
  calculateCombinedSavings,
  getRateForTiltakId,
  type TiltakSavingsInfo,
  type TekPeriodInput,
  type Boligtype,
} from './energySavingsData.ts';

export interface BygningTiltakItem {
  id: string;
  title: string;
}

export interface BygningSavingsInput {
  tekPeriod: TekPeriodInput | null;
  boligtype: Boligtype | null;
  bruksareal: number | undefined;
  filteredSolarEnergy: number | null | undefined;
  yearlyConsumption: number;
  displayTiltak: ReadonlyArray<BygningTiltakItem>;
  checkedItems: ReadonlySet<string>;
  completedItems: ReadonlySet<string>;
  selectedVarmepumpeType?: string;
  selectedVinduerTypeNye?: string;
  completedVinduerType?: string;
  erPaaGulListe: boolean;
}

export interface BygningSavingsResult {
  tiltakInfo: TiltakSavingsInfo[];
  completedTiltakInfo: TiltakSavingsInfo[];
  allTiltakInfo: TiltakSavingsInfo[];
  completedSavingsKWh: number;
  totalCombinedSavingsKWh: number;
  newSavingsKWh: number;
  newSolarKwhContribution: number;
}

const EMPTY_RESULT: BygningSavingsResult = {
  tiltakInfo: [],
  completedTiltakInfo: [],
  allTiltakInfo: [],
  completedSavingsKWh: 0,
  totalCombinedSavingsKWh: 0,
  newSavingsKWh: 0,
  newSolarKwhContribution: 0,
};

function buildTiltakInfo(
  items: ReadonlySet<string>,
  displayTiltak: ReadonlyArray<BygningTiltakItem>,
  tekPeriod: TekPeriodInput,
  boligtype: Boligtype,
  filteredSolarEnergy: number | null | undefined,
  erPaaGulListe: boolean,
  varmepumpeType: string | undefined,
  vinduerType: string | undefined,
): TiltakSavingsInfo[] {
  if (items.size === 0) return [];
  const info: TiltakSavingsInfo[] = [];
  items.forEach((tiltakId) => {
    const tiltak = displayTiltak.find((t) => t.id === tiltakId);
    if (!tiltak) return;
    if (tiltak.id === 'solenergi') {
      const solarEnergy = filteredSolarEnergy || 0;
      if (solarEnergy > 0) {
        info.push({ title: tiltak.id, rates: null, solarProductionKwh: solarEnergy });
      }
    } else {
      const rates = getRateForTiltakId(tiltak.id, tekPeriod, boligtype, {
        erPaaGulListe,
        varmepumpeTab: tiltak.id === 'varmepumpe' ? varmepumpeType : undefined,
        vinduerTab: tiltak.id === 'vinduer' ? vinduerType : undefined,
      });
      if (rates !== null) info.push({ title: tiltak.id, rates });
    }
  });
  return info;
}

export function computeBygningSavings(input: BygningSavingsInput): BygningSavingsResult {
  const {
    tekPeriod,
    boligtype,
    bruksareal,
    filteredSolarEnergy,
    yearlyConsumption,
    displayTiltak,
    checkedItems,
    completedItems,
    selectedVarmepumpeType,
    selectedVinduerTypeNye,
    completedVinduerType,
    erPaaGulListe,
  } = input;

  if (!tekPeriod || !boligtype) {
    return EMPTY_RESULT;
  }

  const tiltakInfo = buildTiltakInfo(
    checkedItems,
    displayTiltak,
    tekPeriod,
    boligtype,
    filteredSolarEnergy,
    erPaaGulListe,
    selectedVarmepumpeType,
    selectedVinduerTypeNye,
  );

  const completedTiltakInfo = buildTiltakInfo(
    completedItems,
    displayTiltak,
    tekPeriod,
    boligtype,
    filteredSolarEnergy,
    erPaaGulListe,
    selectedVarmepumpeType,
    completedVinduerType,
  );

  // Vinduer-overlap: tolags (gjennomført) + trelags (nye) skal IKKE multipliseres –
  // trelags erstatter tolags for samme komponent, så bruk kun trelags i total.
  const hasCompletedVinduerTolags =
    completedItems.has('vinduer') && completedVinduerType === 'tolags';
  const hasNyeVinduer = checkedItems.has('vinduer');
  const allTiltakInfo =
    hasCompletedVinduerTolags && hasNyeVinduer
      ? [...completedTiltakInfo.filter((t) => t.title !== 'vinduer'), ...tiltakInfo]
      : [...completedTiltakInfo, ...tiltakInfo];

  const consumptionOk = Number.isFinite(yearlyConsumption) && yearlyConsumption > 0;

  const completedSavingsKWh =
    consumptionOk && completedTiltakInfo.length > 0
      ? calculateCombinedSavings(yearlyConsumption, completedTiltakInfo, tekPeriod, boligtype, bruksareal)
      : 0;

  const totalCombinedSavingsKWh =
    consumptionOk && allTiltakInfo.length > 0
      ? calculateCombinedSavings(yearlyConsumption, allTiltakInfo, tekPeriod, boligtype, bruksareal)
      : 0;

  const newSavingsKWh = Math.max(0, totalCombinedSavingsKWh - completedSavingsKWh);
  const newSolarKwhContribution = tiltakInfo.reduce(
    (sum, t) => sum + (t.solarProductionKwh ?? 0),
    0,
  );

  return {
    tiltakInfo,
    completedTiltakInfo,
    allTiltakInfo,
    completedSavingsKWh,
    totalCombinedSavingsKWh,
    newSavingsKWh,
    newSolarKwhContribution,
  };
}

/**
 * Aggregering av tiltaks-besparelse over flere bygg i et borettslag/sameie.
 * Kjører per-bygg-beregningen i bygningSavings.ts og summerer kWh/kr.
 * Brukes for å vise "hele gruppen kan spare X" i UI (jfr. docs/grunnbok-feature.md
 * task #19).
 */

import {
  computeBygningSavings,
  type BygningTiltakItem,
} from './bygningSavings.ts';
import {
  calculateAnnualEnergyConsumption,
  calculateTEK,
  determineBuildingType,
} from './tekEnergyCalculations.ts';
import { computeAggregatedSavingsNok } from './tiltakSavings.ts';
import type { Boligtype, TekPeriodInput } from './energySavingsData.ts';

/** Minimalt delsett av EiendomsgruppeBygning som aggregeringen trenger. */
export interface EiendomsgruppeBygg {
  byggId: number;
  byggeaar: number | null;
  bruksarealM2: number | null;
  bygningstypeKodeId: number | null;
  solar?: { filteredSolarEnergy: number | null } | null;
}

export interface EiendomsgruppeSavingsInput {
  bygninger: ReadonlyArray<EiendomsgruppeBygg>;
  /**
   * Standard-katalog som brukes hvis {@link displayTiltakForBygg} ikke er satt.
   * Tiltak som ikke gir effekt for et konkret bygg filtreres uansett vekk av
   * `getRateForTiltakId` internt — men for å speile "skjul fra nye tiltak"-
   * reglene (byggår, byggtype, gul liste) bør kalleren levere
   * `displayTiltakForBygg`.
   */
  displayTiltak: ReadonlyArray<BygningTiltakItem>;
  /**
   * Per-bygg filtrert tiltaksliste. Kalles per bygg og skal speile samme logikk
   * som `filterTiltakForBuilding` i enkeltmodus. Tiltak som ikke er i den
   * returnerte listen vil ikke applisere besparelse for det bygget.
   */
  displayTiltakForBygg?: (
    bygg: EiendomsgruppeBygg,
  ) => ReadonlyArray<BygningTiltakItem>;
  checkedItems: ReadonlySet<string>;
  completedItems: ReadonlySet<string>;
  selectedVarmepumpeType?: string;
  selectedVinduerTypeNye?: string;
  completedVinduerType?: string;
  erPaaGulListe: boolean;
  energyPricePerKwh?: number;
}

export interface EiendomsgruppePerByggBreakdown {
  byggId: number;
  tekPeriod: TekPeriodInput;
  boligtype: Boligtype;
  estimatedConsumptionKWh: number;
  completedSavingsKWh: number;
  totalCombinedSavingsKWh: number;
  newSavingsKWh: number;
  newSolarKwhContribution: number;
}

export interface EiendomsgruppeSavingsResult {
  totalEstimatedConsumptionKWh: number;
  totalCompletedSavingsKWh: number;
  totalCombinedSavingsKWh: number;
  totalNewSavingsKWh: number;
  totalNewSolarKwhContribution: number;
  totalNewSavingsNok: number;
  perBygg: EiendomsgruppePerByggBreakdown[];
  /** Antall bygg som ble inkludert (dvs. har gyldig bruksareal). */
  antallIkluderteBygg: number;
  /** Bygg som ble hoppet over pga. manglende/ugyldig bruksareal. */
  hoppetOverByggIds: number[];
}

export function computeEiendomsgruppeSavings(
  input: EiendomsgruppeSavingsInput,
): EiendomsgruppeSavingsResult {
  const {
    bygninger,
    displayTiltak,
    displayTiltakForBygg,
    checkedItems,
    completedItems,
    selectedVarmepumpeType,
    selectedVinduerTypeNye,
    completedVinduerType,
    erPaaGulListe,
    energyPricePerKwh,
  } = input;

  let totalEstimatedConsumptionKWh = 0;
  let totalCompletedSavingsKWh = 0;
  let totalCombinedSavingsKWh = 0;
  let totalNewSavingsKWh = 0;
  let totalNewSolarKwhContribution = 0;
  let totalNewSavingsNok = 0;
  const perBygg: EiendomsgruppePerByggBreakdown[] = [];
  const hoppetOverByggIds: number[] = [];

  for (const b of bygninger) {
    const bruksareal = b.bruksarealM2 ?? 0;
    if (!Number.isFinite(bruksareal) || bruksareal <= 0) {
      hoppetOverByggIds.push(b.byggId);
      continue;
    }

    const byggeaar = b.byggeaar ?? 0;
    const boligtype = determineBuildingType(
      b.bygningstypeKodeId != null ? String(b.bygningstypeKodeId) : undefined,
      undefined,
    );
    const tekPeriod = calculateTEK(byggeaar) as TekPeriodInput;
    const estimatedConsumptionKWh = calculateAnnualEnergyConsumption(
      byggeaar || undefined,
      bruksareal,
      boligtype,
    );

    const tiltakForBygg = displayTiltakForBygg ? displayTiltakForBygg(b) : displayTiltak;

    const result = computeBygningSavings({
      tekPeriod,
      boligtype,
      bruksareal,
      filteredSolarEnergy: b.solar?.filteredSolarEnergy ?? null,
      yearlyConsumption: estimatedConsumptionKWh,
      displayTiltak: tiltakForBygg,
      checkedItems,
      completedItems,
      selectedVarmepumpeType,
      selectedVinduerTypeNye,
      completedVinduerType,
      erPaaGulListe,
    });

    totalEstimatedConsumptionKWh += estimatedConsumptionKWh;
    totalCompletedSavingsKWh += result.completedSavingsKWh;
    totalCombinedSavingsKWh += result.totalCombinedSavingsKWh;
    totalNewSavingsKWh += result.newSavingsKWh;
    totalNewSolarKwhContribution += result.newSolarKwhContribution;
    totalNewSavingsNok += computeAggregatedSavingsNok({
      totalKwh: result.newSavingsKWh,
      solarKwhContribution: result.newSolarKwhContribution,
      boligtype,
      energyPricePerKwh,
    });

    perBygg.push({
      byggId: b.byggId,
      tekPeriod,
      boligtype,
      estimatedConsumptionKWh,
      completedSavingsKWh: result.completedSavingsKWh,
      totalCombinedSavingsKWh: result.totalCombinedSavingsKWh,
      newSavingsKWh: result.newSavingsKWh,
      newSolarKwhContribution: result.newSolarKwhContribution,
    });
  }

  return {
    totalEstimatedConsumptionKWh,
    totalCompletedSavingsKWh,
    totalCombinedSavingsKWh,
    totalNewSavingsKWh,
    totalNewSolarKwhContribution,
    totalNewSavingsNok,
    perBygg,
    antallIkluderteBygg: perBygg.length,
    hoppetOverByggIds,
  };
}

/**
 * Beregner samlet estimert årsforbruk (kWh) for en gruppe bygg via
 * calculateAnnualEnergyConsumption per bygg. Bygg uten bruksareal hoppes over.
 */
export function beregnGruppeBaselineForbruk(
  bygninger: ReadonlyArray<EiendomsgruppeBygg>,
): number {
  let total = 0;
  for (const b of bygninger) {
    const bruksareal = b.bruksarealM2 ?? 0;
    if (!Number.isFinite(bruksareal) || bruksareal <= 0) continue;
    const boligtype = determineBuildingType(
      b.bygningstypeKodeId != null ? String(b.bygningstypeKodeId) : undefined,
      undefined,
    );
    total += calculateAnnualEnergyConsumption(b.byggeaar ?? undefined, bruksareal, boligtype);
  }
  return total;
}

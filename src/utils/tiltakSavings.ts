import type { Boligtype } from './energySavingsData.ts';
import { getSolarPriceAdjustmentFactor } from './solarEconomics.ts';

const DEFAULT_PRICE_PER_KWH = 1.1;

/**
 * Beregner kroner-besparelsen for et enkelt tiltak, gitt ferdig kalkulert
 * kWh-besparelse. Sentral funksjon som anvender strømpris og eventuell
 * solenergi-justering (0,65 for småhus, 1,0 for blokk).
 *
 * kWh returneres uendret — justeringen gjelder kun kr.
 */
export function computeTiltakSavings(params: {
  tiltakId: string;
  kwhSaved: number;
  boligtype: Boligtype | null;
  energyPricePerKwh?: number;
}): { kwh: number; nok: number } {
  const { tiltakId, kwhSaved, boligtype, energyPricePerKwh = DEFAULT_PRICE_PER_KWH } = params;

  if (!Number.isFinite(kwhSaved) || kwhSaved <= 0) {
    return { kwh: 0, nok: 0 };
  }

  const factor = getSolarPriceAdjustmentFactor(tiltakId, boligtype);
  return {
    kwh: kwhSaved,
    nok: kwhSaved * energyPricePerKwh * factor,
  };
}

/**
 * Beregner samlet kroner-besparelse for en bunt tiltak. Tar inn total
 * kWh-besparelse (fra calculateCombinedSavings eller calculateComparisonSavings)
 * og den lineære sol-andelen separat — fordi solenergi legges lineært til
 * besparelsen mens andre tiltak kompounderes.
 *
 * Formel:
 *   nok = (totalKwh - solarKwh) × pris + solarKwh × pris × solFaktor
 *
 * Der solFaktor = 0,65 for småhus, 1,0 ellers.
 */
export function computeAggregatedSavingsNok(params: {
  totalKwh: number;
  solarKwhContribution: number;
  boligtype: Boligtype | null;
  energyPricePerKwh?: number;
}): number {
  const {
    totalKwh,
    solarKwhContribution,
    boligtype,
    energyPricePerKwh = DEFAULT_PRICE_PER_KWH,
  } = params;

  if (!Number.isFinite(totalKwh) || totalKwh <= 0) {
    return 0;
  }

  const clampedSolar = Math.max(0, Math.min(solarKwhContribution, totalKwh));
  const nonSolar = totalKwh - clampedSolar;
  const solarFactor = getSolarPriceAdjustmentFactor('solenergi', boligtype);

  return nonSolar * energyPricePerKwh + clampedSolar * energyPricePerKwh * solarFactor;
}

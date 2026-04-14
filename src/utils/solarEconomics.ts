import type { Boligtype } from './energySavingsData.ts';

// Tommelfingerregel fra fagansvarlig solenergi: for småhus eksporteres ~70%
// av egenprodusert strøm til nettet, og salgsprisen er typisk ~50% av
// innkjøpsprisen. For blokk (felles anlegg i borettslag/sameie) forutsetter vi
// at det aller meste benyttes innenfor bygget og bruker derfor ingen justering.
export const SOLAR_EXPORT_SHARE_SMAAHUS = 0.7;
export const SOLAR_EXPORT_PRICE_FACTOR = 0.5;

export const SOLAR_PRICE_FACTOR_SMAAHUS =
  (1 - SOLAR_EXPORT_SHARE_SMAAHUS) * 1 + SOLAR_EXPORT_SHARE_SMAAHUS * SOLAR_EXPORT_PRICE_FACTOR;

/**
 * Returnerer en faktor som skal multipliseres med råverdien av årlig kroner-besparelse
 * for å reflektere den reelle økonomiske gevinsten fra et solcelleanlegg.
 *
 * - Småhus + solenergi: 0.65 (70 % eksporteres til halv spotpris)
 * - Blokk + solenergi: 1.0 (felles anlegg, hovedsakelig egenforbruk)
 * - Andre tiltak: 1.0 (uendret)
 */
export function getSolarPriceAdjustmentFactor(
  tiltakId: string | undefined,
  boligtype: Boligtype | null | undefined
): number {
  if (tiltakId !== 'solenergi') return 1;
  if (boligtype === 'småhus') return SOLAR_PRICE_FACTOR_SMAAHUS;
  return 1;
}

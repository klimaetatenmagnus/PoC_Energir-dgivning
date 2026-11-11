import { formatNumberWithSpaces } from '../../utils/energy';

// Energikarakter-farger (samme skala som desktop)
export const ENERGY_RATING_COLORS: Record<string, string> = {
  A: '#097E3E',
  B: '#32A548',
  C: '#96C133',
  D: '#EFE61E',
  E: '#F7AD24',
  F: '#EA6927',
  G: '#E31829',
};

/** Tekstfarge som gir nok kontrast mot karakterfargen */
export const ratingTextColor = (rating: string): string =>
  rating === 'A' || rating === 'G' ? '#FFFFFF' : '#17163A';

/**
 * Avrunder et estimat slik at flisene og bunnlinja viser samme tall:
 * nærmeste 100 under 10 000, nærmeste 1 000 over.
 */
export const roundEstimate = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const step = value >= 10000 ? 1000 : 100;
  return Math.round(value / step) * step;
};

// Hardt mellomrom, så beløpet ikke brytes over to linjer
const NBSP = '\u00a0';

const withHardSpaces = (value: number): string =>
  formatNumberWithSpaces(value).replace(/ /g, NBSP);

export const formatSavingsNok = (nok: number): string =>
  `~${withHardSpaces(roundEstimate(nok))}${NBSP}kr/år`;

export const formatSavingsKwh = (kwh: number): string =>
  `~${withHardSpaces(roundEstimate(kwh))}${NBSP}kWh/år`;

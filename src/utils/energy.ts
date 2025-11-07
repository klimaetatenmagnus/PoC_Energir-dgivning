const DEFAULT_PRICE_PER_KWH = 1.1;

const CURRENCY_FORMATTER = new Intl.NumberFormat('nb-NO', {
  style: 'currency',
  currency: 'NOK',
  maximumFractionDigits: 0,
});

/**
 * Convert a kWh value to NOK using the provided price per kWh.
 */
export const convertKwhToNok = (
  kwh: number,
  pricePerKwh: number = DEFAULT_PRICE_PER_KWH
): number => {
  if (!Number.isFinite(kwh) || !Number.isFinite(pricePerKwh)) {
    return 0;
  }

  return kwh * pricePerKwh;
};

/**
 * Format a numeric value as NOK currency (rounded to whole kroner).
 */
export const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) {
    return CURRENCY_FORMATTER.format(0);
  }

  return CURRENCY_FORMATTER.format(Math.round(value));
};

export const formatNumberWithSpaces = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

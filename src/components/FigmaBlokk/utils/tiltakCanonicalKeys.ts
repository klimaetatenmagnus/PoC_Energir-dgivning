/**
 * Canonical keys for tiltak used for SVG overlay visibility and animations.
 * These keys are stable and independent of display titles which may change.
 * Maps catalog IDs to canonical keys used in BuildingSprites.tsx CSS classes.
 */
export type TiltakCanonicalKey =
  | 'ventilasjon'
  | 'solenergi'
  | 'etterisolering-kjeller-loft'
  | 'etterisolering-yttervegg'
  | 'temperaturstyring'
  | 'tetting'
  | 'varmepumpe'
  | 'vinduer';

/**
 * Mapping from catalog IDs to canonical keys.
 * Used to ensure SVG overlays remain stable if catalog IDs change.
 */
const CATALOG_ID_TO_CANONICAL_KEY: Record<string, TiltakCanonicalKey> = {
  'ventilasjon': 'ventilasjon',
  'solenergi': 'solenergi',
  'etterisolering-kjeller-loft': 'etterisolering-kjeller-loft',
  'etterisolering-yttervegg': 'etterisolering-yttervegg',
  'temperaturstyring': 'temperaturstyring',
  'tetting': 'tetting',
  'varmepumpe': 'varmepumpe',
  'vinduer': 'vinduer',
};

/**
 * Fallback mapping from display titles to canonical keys.
 * Used when catalog data is not available or for legacy support.
 */
const DISPLAY_TITLE_TO_CANONICAL_KEY: Record<string, TiltakCanonicalKey> = {
  'Ventilasjon': 'ventilasjon',
  'Solenergi': 'solenergi',
  'Isolering av kjeller og loft': 'etterisolering-kjeller-loft',
  'Etterisolering av kjeller og loft': 'etterisolering-kjeller-loft',
  'Etterisolering av yttervegg': 'etterisolering-yttervegg',
  'Temperaturstyring': 'temperaturstyring',
  'Tetting': 'tetting',
  'Varmepumpe': 'varmepumpe',
  'Oppgradering av vindu': 'vinduer',
  'Oppgradering av vinduer': 'vinduer',
};

/**
 * Get canonical key for a tiltak.
 * Tries catalog ID first, then falls back to display title mapping.
 */
export const getCanonicalKey = (
  catalogId: string | undefined,
  displayTitle: string
): TiltakCanonicalKey | null => {
  // First try catalog ID
  if (catalogId && CATALOG_ID_TO_CANONICAL_KEY[catalogId]) {
    return CATALOG_ID_TO_CANONICAL_KEY[catalogId];
  }
  // Fall back to display title
  if (DISPLAY_TITLE_TO_CANONICAL_KEY[displayTitle]) {
    return DISPLAY_TITLE_TO_CANONICAL_KEY[displayTitle];
  }
  return null;
};

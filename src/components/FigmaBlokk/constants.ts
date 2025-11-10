// Constants for FigmaBlokk component

export const ENERGY_SOLUTIONS = [
  "Varmepumpe",
  "Solenergi",
  "Tetting",
  "Temperaturstyring",
  "Oppgradering av vindu",
  "Isolering av kjeller og loft",
  "Etterisolering av yttervegg",
  "Ventilasjon"
] as const;

export const BOX_MIN_WIDTHS = {
  district: 127,
  buildingType: 78,
} as const;

export const CHAR_WIDTH_MULTIPLIER = 8.5;
export const BOX_PADDING = 40;

export const SKYLINE_LIGHTS_ENABLED = true;

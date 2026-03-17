/**
 * Sentral konfigurasjon for badges/tags brukt i applikasjonen.
 * Sikrer visuell konsistens mellom desktop og mobil.
 */

export type BadgeType = 'district' | 'buildingType';

export interface BadgeConfig {
  /** Punkt-ikonnavn (uten .svg) */
  iconName: string;
  /** PktTag skin */
  skin: 'green' | 'blue' | 'yellow' | 'red' | 'grey' | 'beige';
  /** Aria-label prefix for tilgjengelighet */
  ariaLabelPrefix: string;
}

/**
 * Badge-konfigurasjon for bydel
 */
export const DISTRICT_BADGE: BadgeConfig = {
  iconName: 'map',
  skin: 'green',
  ariaLabelPrefix: 'Bydel',
};

/**
 * Badge-konfigurasjon for byggeår
 */
export const BUILDING_YEAR_BADGE: BadgeConfig = {
  iconName: 'tool',
  skin: 'beige',
  ariaLabelPrefix: 'Byggeår',
};

/**
 * Badge-konfigurasjon for bygningstype basert på type
 */
export const BUILDING_TYPE_BADGES: Record<string, BadgeConfig> = {
  // Blokk/leilighetsbygg
  blokk: {
    iconName: 'organization',
    skin: 'blue',
    ariaLabelPrefix: 'Bygningstype',
  },
  'store boligbygg': {
    iconName: 'organization',
    skin: 'blue',
    ariaLabelPrefix: 'Bygningstype',
  },
  // Småhus
  enebolig: {
    iconName: 'home',
    skin: 'blue',
    ariaLabelPrefix: 'Bygningstype',
  },
  tomannsbolig: {
    iconName: 'home',
    skin: 'blue',
    ariaLabelPrefix: 'Bygningstype',
  },
  rekkehus: {
    iconName: 'home',
    skin: 'blue',
    ariaLabelPrefix: 'Bygningstype',
  },
  'rekkehus, kjedehus, andre småhus': {
    iconName: 'home',
    skin: 'blue',
    ariaLabelPrefix: 'Bygningstype',
  },
};

/**
 * Standard badge-konfigurasjon for ukjent bygningstype
 */
export const DEFAULT_BUILDING_TYPE_BADGE: BadgeConfig = {
  iconName: 'home',
  skin: 'blue',
  ariaLabelPrefix: 'Bygningstype',
};

/**
 * Hent badge-konfigurasjon for en bygningstype
 * @param buildingTypeName - Navnet på bygningstypen (case-insensitive)
 */
export function getBuildingTypeBadgeConfig(buildingTypeName: string): BadgeConfig {
  const normalizedName = buildingTypeName.toLowerCase().trim();
  return BUILDING_TYPE_BADGES[normalizedName] ?? DEFAULT_BUILDING_TYPE_BADGE;
}

/**
 * Bestem om en bygningstype er en blokk/leilighetsbygg
 * (bruker organization-ikon)
 */
export function isBlockBuilding(buildingTypeName: string): boolean {
  const normalizedName = buildingTypeName.toLowerCase().trim();
  return (
    normalizedName === 'blokk' ||
    normalizedName === 'store boligbygg' ||
    normalizedName.includes('leilighet') ||
    normalizedName.includes('boligbygg')
  );
}

/**
 * Hjelpefunksjon for å normalisere bygningstype-visningsnavn
 */
export function getDisplayBuildingTypeName(buildingTypeName: string): string {
  if (buildingTypeName === 'Store boligbygg') return 'Blokk';
  if (buildingTypeName === 'Rekkehus, kjedehus, andre småhus') return 'Rekkehus';

  const lower = buildingTypeName.toLowerCase();
  if (lower.startsWith('tomannsbolig')) return 'Tomannsbolig';
  if (lower.startsWith('enebolig')) return 'Enebolig';
  if (lower.includes('blokk') || lower.includes('boligbygg')) return 'Blokk';
  if (lower.includes('rekkehus') || lower.includes('kjedehus')) return 'Rekkehus';
  if (lower.includes('småhus')) return 'Småhus';

  return buildingTypeName;
}

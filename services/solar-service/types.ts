// services/solar-service/types.ts
// Type-definisjoner for solar-service

/* ───────── Konfigurasjon og miljøvariabler ─────────────────────────────── */
export interface SolarServiceConfig {
  referenceKwh: number;
  cacheTtl: number;
  wfsUrl: string;
  mapFile: string;
  layer: string;
  defaultPointDelta: number;
  minPointDelta: number;
  maxPointDelta: number;
  minRadiation: number;
  solarPanelEfficiency: number;
  addressMap: string;
  addressLayer: string;
  defaultAdridBuffer: number;
  autoDeltaPresets: number[];
  autoDeltaBreakpoint: number;
  autoDeltaMaxAttempts: number;
  autoDeltaTimeLimitMs: number;
  mockMode: boolean;
  port: number;
  host: string;
}

/* ───────── WFS og takflate-strukturer ──────────────────────────────────── */
export interface Takflate {
  tak_id: number;
  bygg_id: number | null;
  bygg_nr: string | null;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
}

export interface WfsQueryParams {
  map: string;
  SERVICE: string;
  VERSION: string;
  REQUEST: string;
  TYPENAME: string;
  FILTER?: string;
  CQL_FILTER?: string;
  BBOX?: string;
  SRSNAME?: string;
  OUTPUTFORMAT?: string;
}

export interface ProjectedPoint {
  east: number;
  north: number;
}

export interface AdridLookupResult {
  adrid: string;
  id: string;
  point: ProjectedPoint;
}

/* ───────── API request/response-typer ──────────────────────────────────── */
export interface SolarQueryParams {
  bygg_id?: string;
  bygg_nr?: string;
  bygningsnummer?: string;
  polygon?: string;
  gnr?: string;
  bnr?: string;
  snr?: string;
  lat?: string;
  lon?: string;
  delta?: string;
}

export interface SolarApiResponse {
  reference: number;
  takflater: Takflate[];
  takAreal_m2: number | null;
  sol_kwh_m2_yr: number | null;
  sol_kwh_bygg_tot: number;
  filteredSolarEnergy: number;
  category: string;
}

export interface SolarErrorResponse {
  error: string;
}

/* ───────── Interne datastrukturer ──────────────────────────────────────── */
export interface DeltaAttempt {
  delta: number;
  count: number;
  durationMs: number;
}

export interface CollectTakflaterResult {
  surfaces: Takflate[];
  usedDelta: number;
  attempts: DeltaAttempt[];
  selectionKey: string | null;
}

export interface BuildingGroupSelection {
  key: string | null;
  surfaces: Takflate[];
  area: number;
  priority: number;
}

export interface SurfaceMetrics {
  count: number;
  sumArea: number;
  sumPot: number;
  avgIrr: number;
  filteredEnergy: number;
}

/* ───────── WFS Feature-parsing ─────────────────────────────────────────── */
export interface WfsFeature {
  msGeometry?: {
    Point?: {
      pos?: string;
      posList?: string;
      coordinates?: string;
    };
  };
  Point?: {
    pos?: string;
    coordinates?: string;
  };
  ADRID?: string | number;
  adrid?: string | number;
  AdresseId?: string | number;
  Adrid?: string | number;
  ID?: string | number;
  id?: string | number;
  FID?: string | number;
}

export interface WfsFeatureCollection {
  FeatureCollection?: WfsFeatureCollectionContent;
  Featurecollection?: WfsFeatureCollectionContent;
  'wfs:FeatureCollection'?: WfsFeatureCollectionContent;
}

export interface WfsFeatureCollectionContent {
  featureMember?: WfsFeatureMember | WfsFeatureMember[];
  member?: WfsFeatureMember | WfsFeatureMember[];
  'gml:featureMember'?: WfsFeatureMember | WfsFeatureMember[];
}

export type WfsFeatureMember = Record<string, WfsFeature>;

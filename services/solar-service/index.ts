// services/solar-service/index.ts
// ---------------------------------------------------------------------------
//  Henter solinnstråling fra PBE-Solkart 2024
//   • ?bygg_id=123456           (presist – prioritet 1)
//   • ?polygon=<WKT>            (seksjon / bygg-polygon)
//   • ?gnr=&bnr=[&snr=]         (hele matrikkelenheten)
//   • ?lat=&lon=[&delta=]       (punkt, default 10 m radius)
// ---------------------------------------------------------------------------

import express, { type Request, type Response, type RequestHandler } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import proj4 from 'proj4';
import { XMLParser } from 'fast-xml-parser';
import type {
  SolarServiceConfig,
  Takflate,
  ProjectedPoint,
  AdridLookupResult,
  SolarQueryParams,
  SolarApiResponse,
  SolarErrorResponse,
  CollectTakflaterResult,
  BuildingGroupSelection,
  SurfaceMetrics,
  DeltaAttempt,
  WfsFeatureCollection,
  WfsFeatureMember,
  WfsFeature,
  WfsQueryParams,
} from './types.js';

/* ───────── SRID-definisjoner ─────────────────────────────────────────── */
proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

/* ───────── Logging-funksjoner ──────────────────────────────────────────── */
import { createLogger } from '../shared/logger.js';

const logger = createLogger({
  prefix: 'solar-service',
  debugEnvVar: 'DEBUG_SOLAR',
});
const infoLog = logger.info;
const errorLog = logger.error;
const debugLog = logger.debug;

/* ───────── Konfigurasjonslasting ───────────────────────────────────────── */
function loadConfig(): SolarServiceConfig {
  const parseNumber = (value: string | undefined, defaultValue: number): number => {
    const parsed = Number(value ?? defaultValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  };

  const autoDeltaPresetsRaw = (process.env.SOLAR_POINT_AUTO_DELTAS ?? '1,3,5,8,12,18,25')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);

  const autoDeltaPresets = autoDeltaPresetsRaw.length ? autoDeltaPresetsRaw : [1, 3, 5, 8, 12, 18, 25];

  return {
    referenceKwh: parseNumber(process.env.SOLAR_REFERENCE_KWH, 1005),
    cacheTtl: parseNumber(process.env.SOLAR_CACHE_TTL, 3600),
    wfsUrl: process.env.SOLAR_WFS_URL ?? 'https://od2.pbe.oslo.kommune.no/cgi-bin/wms',
    mapFile: process.env.SOLAR_MAP_FILE ?? 'd:/data_mapserver/kartfiler/solkart.map',
    layer: process.env.SOLAR_LAYER ?? 'takflater2024',
    defaultPointDelta: parseNumber(process.env.SOLAR_POINT_DELTA, 10),
    minPointDelta: parseNumber(process.env.SOLAR_POINT_MIN_DELTA, 0.5),
    maxPointDelta: parseNumber(process.env.SOLAR_POINT_MAX_DELTA, 25),
    minRadiation: parseNumber(process.env.SOLAR_MIN_RADIATION, 800),
    solarPanelEfficiency: parseNumber(process.env.SOLAR_PANEL_EFFICIENCY, 0.2),
    addressMap: process.env.SOLAR_ADDRESS_MAP ?? 'WFS_SOK',
    addressLayer: process.env.SOLAR_ADDRESS_LAYER ?? 'ADRESSEID_WFS',
    defaultAdridBuffer: parseNumber(process.env.SOLAR_ADRID_BUFFER, 0.75),
    autoDeltaPresets,
    autoDeltaBreakpoint: parseNumber(process.env.SOLAR_POINT_PLATEAU_DELTA, 12),
    autoDeltaMaxAttempts: parseNumber(process.env.SOLAR_POINT_MAX_ATTEMPTS, 8),
    autoDeltaTimeLimitMs: parseNumber(process.env.SOLAR_POINT_TIME_LIMIT_MS, 2000),
    mockMode:
      process.env.SOLAR_SERVICE_MOCK === '1' ||
      process.env.SOLAR_SERVICE_MOCK?.toLowerCase() === 'true',
    port: parseNumber(process.env.SOLAR_SERVICE_PORT ?? process.env.PORT, 4003),
    host: process.env.SOLAR_SERVICE_HOST ?? '0.0.0.0',
  };
}

const config = loadConfig();

/* ───────── Konstanter (basert på config) ───────────────────────────────── */
const app = express();
const CACHE = new NodeCache({
  stdTTL: config.cacheTtl,
  checkperiod: Math.max(60, Math.floor(config.cacheTtl / 3)),
});

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: [
    'https://energinokkelen.no',
    'https://www.energinokkelen.no',
    'https://klimaoslo.no',
    'https://www.klimaoslo.no',
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4003']
      : []),
  ],
}));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/* ───────── Mini-helper for WFS-kall ───────────────────────────────────── */
function buildWfsParams(params: WfsQueryParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set('map', params.map);
  searchParams.set('SERVICE', params.SERVICE);
  searchParams.set('VERSION', params.VERSION);
  searchParams.set('REQUEST', params.REQUEST);
  searchParams.set('TYPENAME', params.TYPENAME);
  if (params.OUTPUTFORMAT) searchParams.set('OUTPUTFORMAT', params.OUTPUTFORMAT);
  if (params.FILTER) searchParams.set('FILTER', params.FILTER);
  if (params.CQL_FILTER) searchParams.set('CQL_FILTER', params.CQL_FILTER);
  if (params.BBOX) searchParams.set('BBOX', params.BBOX);
  if (params.SRSNAME) searchParams.set('SRSNAME', params.SRSNAME);
  return searchParams;
}

async function wfsCall(params: URLSearchParams): Promise<string> {
  const res = await fetch(`${config.wfsUrl}?${params.toString()}`);
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  return res.text();
}

/* ───────── GML → takflate-array ──────────────────────────────────────── */
function parseFeatureMembers(xml: string): Takflate[] {
  const feats = xml.match(/<ms:takflater2024[\s\S]*?<\/ms:takflater2024>/gi) || [];

  return feats.map((blk) => {
    const tag = (t: string): string | undefined =>
      (blk.match(new RegExp(`<ms:${t}>([0-9.,-]+)<\\/ms:${t}>`, 'i')) || [])[1];
    const textTag = (t: string): string | undefined =>
      (blk.match(new RegExp(`<ms:${t}>([^<]+)<\\/ms:${t}>`, 'i')) || [])[1];

    const takId = Number(tag('TAK_ID'));
    const byggId = Number(tag('BYGG_ID'));
    const byggNrRaw = textTag('BYGGNR');
    const areaStr = tag('AREA');
    const irrStr = tag('SUM_AAR_KWH');
    const area = Number(areaStr?.replace(',', '.') ?? 0);
    const irr = Number(irrStr?.replace(',', '.') ?? 0);

    return {
      tak_id: takId,
      bygg_id: byggId || null,
      bygg_nr: byggNrRaw ? byggNrRaw.trim() : null,
      area_m2: area,
      irr_kwh_m2_yr: irr,
      kWh_tot: irr * area,
    };
  });
}

/* ───────── 1) BYGG_ID-filter ─────────────────────────────────────────── */
async function takflaterForByggId(id: string): Promise<Takflate[]> {
  const filter = `<Filter xmlns="http://www.opengis.net/ogc">
    <PropertyIsEqualTo><PropertyName>BYGG_ID</PropertyName><Literal>${id}</Literal></PropertyIsEqualTo>
  </Filter>`;

  const params = buildWfsParams({
    map: config.mapFile,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: config.layer,
    FILTER: filter,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const xml = await wfsCall(params);
  return parseFeatureMembers(xml);
}

/* ───────── 2) Polygon-filter ─────────────────────────────────────────── */
async function takflaterForByggNr(byggNr: string): Promise<Takflate[]> {
  const filter = `<Filter xmlns="http://www.opengis.net/ogc">
    <PropertyIsEqualTo><PropertyName>BYGGNR</PropertyName><Literal>${byggNr}</Literal></PropertyIsEqualTo>
  </Filter>`;

  const params = buildWfsParams({
    map: config.mapFile,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: config.layer,
    FILTER: filter,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const xml = await wfsCall(params);
  return parseFeatureMembers(xml);
}

async function takflaterForPolygon(wkt: string): Promise<Takflate[]> {
  const cql = `INTERSECTS(msGeometry, SRID=32632;${wkt})`;

  const params = buildWfsParams({
    map: config.mapFile,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: config.layer,
    CQL_FILTER: cql,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const xml = await wfsCall(params);
  return parseFeatureMembers(xml);
}

/* ───────── 3) Matrikkel-filter ───────────────────────────────────────── */
async function takflaterForMatrikkel(gnr: string, bnr: string, snr?: string): Promise<Takflate[]> {
  const parts = [
    `<PropertyIsEqualTo><PropertyName>GNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>`,
    `<PropertyIsEqualTo><PropertyName>BNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>`,
  ];
  if (snr) {
    parts.push(
      `<PropertyIsEqualTo><PropertyName>SNR</PropertyName><Literal>${snr}</Literal></PropertyIsEqualTo>`
    );
  }
  const filter = `<Filter xmlns="http://www.opengis.net/ogc"><And>${parts.join('')}</And></Filter>`;

  const params = buildWfsParams({
    map: config.mapFile,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: config.layer,
    FILTER: filter,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const xml = await wfsCall(params);
  return parseFeatureMembers(xml);
}

function clampDelta(value: number | string | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return config.defaultPointDelta;
  }
  const min = config.minPointDelta;
  const max = Math.max(min, config.maxPointDelta);
  return Math.min(max, Math.max(min, numeric));
}

/**
 * ADR-specific buffer validation, decoupled from point delta clamping.
 * Only ensures the buffer is positive and within a reasonable ADR range.
 */
const ADR_BUFFER_MIN = 0.1;
const ADR_BUFFER_MAX = 20;

function clampAdridBuffer(value: number | string | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return config.defaultAdridBuffer;
  }
  return Math.min(ADR_BUFFER_MAX, Math.max(ADR_BUFFER_MIN, numeric));
}

interface PointLike {
  east?: number;
  north?: number;
  x?: number;
  y?: number;
}

function normaliseProjectedPoint(point: unknown): ProjectedPoint {
  const p = point as PointLike | number[] | null | undefined;
  const east = Number(
    (p as PointLike)?.east ?? (p as PointLike)?.x ?? (Array.isArray(p) ? p[0] : undefined)
  );
  const north = Number(
    (p as PointLike)?.north ?? (p as PointLike)?.y ?? (Array.isArray(p) ? p[1] : undefined)
  );
  if (!Number.isFinite(east) || !Number.isFinite(north)) {
    throw new Error('Ugyldige projiserte koordinater');
  }
  return { east, north };
}

function parseFeatureCollection(xml: string): WfsFeatureMember[] {
  const parsed = xmlParser.parse(xml) as WfsFeatureCollection;
  const featureCollection =
    parsed.FeatureCollection ?? parsed.Featurecollection ?? parsed['wfs:FeatureCollection'];
  if (!featureCollection) {
    throw new Error('FeatureCollection mangler i WFS-respons');
  }
  const membersRaw =
    featureCollection.featureMember ||
    featureCollection.member ||
    featureCollection['gml:featureMember'] ||
    [];
  const members = Array.isArray(membersRaw) ? membersRaw : [membersRaw];
  return members.filter(Boolean) as WfsFeatureMember[];
}

function extractPointFromFeature(feature: WfsFeature): ProjectedPoint {
  const pos =
    feature?.msGeometry?.Point?.pos ??
    feature?.msGeometry?.Point?.posList ??
    feature?.msGeometry?.Point?.coordinates ??
    feature?.Point?.pos ??
    feature?.Point?.coordinates;
  if (typeof pos !== 'string' || !pos.trim()) {
    throw new Error('Fant ikke koordinater i WFS-feature');
  }
  const [eastStr, northStr] = pos.trim().split(/\s+/);
  const east = Number(eastStr);
  const north = Number(northStr);
  if (!Number.isFinite(east) || !Number.isFinite(north)) {
    throw new Error(`Ugyldige koordinater i feature: ${pos}`);
  }
  return { east, north };
}

async function fetchAdridNearProjected(
  point: ProjectedPoint | unknown,
  buffer: number = config.defaultAdridBuffer
): Promise<AdridLookupResult> {
  const projected = normaliseProjectedPoint(point);
  const clampedBuffer = clampAdridBuffer(buffer);
  const bbox = [
    (projected.east - clampedBuffer).toFixed(3),
    (projected.north - clampedBuffer).toFixed(3),
    (projected.east + clampedBuffer).toFixed(3),
    (projected.north + clampedBuffer).toFixed(3),
  ].join(',');

  const params = buildWfsParams({
    map: config.addressMap,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: config.addressLayer,
    SRSNAME: 'EPSG:32632',
    BBOX: bbox,
  });

  const xml = await wfsCall(params);
  const members = parseFeatureCollection(xml);
  if (!members.length) {
    throw new Error('Fant ingen ADRID innenfor søkeområdet');
  }

  const wrapper = members[0] ?? {};
  const lowerKey = config.addressLayer.toLowerCase();
  const upperKey = config.addressLayer.toUpperCase();
  const feature = (wrapper[config.addressLayer] ??
    wrapper[lowerKey] ??
    wrapper[upperKey] ??
    Object.values(wrapper)[0]) as WfsFeature | undefined;

  if (!feature) {
    throw new Error('ADR-feature mangler i WFS-respons');
  }

  const adridRaw = feature.ADRID ?? feature.adrid ?? feature.AdresseId ?? feature.Adrid;
  const adrid =
    typeof adridRaw === 'string'
      ? adridRaw.trim()
      : Number.isFinite(adridRaw)
        ? String(adridRaw)
        : null;

  if (!adrid) {
    throw new Error('ADR-ID mangler i responsen');
  }

  const idRaw = feature.ID ?? feature.id ?? feature.FID ?? '';
  const precisePoint = extractPointFromFeature(feature);

  return {
    adrid,
    id: typeof idRaw === 'string' ? idRaw.trim() : String(idRaw),
    point: precisePoint,
  };
}

async function takflaterAroundProjected(
  point: ProjectedPoint | unknown,
  delta: number = config.defaultPointDelta
): Promise<Takflate[]> {
  const projected = normaliseProjectedPoint(point);
  const clampedDelta = clampDelta(delta);

  const bbox = [
    (projected.east - clampedDelta).toFixed(3),
    (projected.north - clampedDelta).toFixed(3),
    (projected.east + clampedDelta).toFixed(3),
    (projected.north + clampedDelta).toFixed(3),
  ].join(',');

  const params = buildWfsParams({
    map: config.mapFile,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: config.layer,
    SRSNAME: 'EPSG:32632',
    BBOX: bbox,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const xml = await wfsCall(params);
  return parseFeatureMembers(xml);
}

function buildDeltaCandidates(baseDelta: number, maxDelta: number = config.maxPointDelta): number[] {
  const candidateSet = new Set<number>();
  const safeBase = clampDelta(baseDelta);
  const safeMax = clampDelta(maxDelta);

  candidateSet.add(Number(safeBase.toFixed(3)));
  candidateSet.add(Number(safeMax.toFixed(3)));

  for (const preset of config.autoDeltaPresets) {
    const clamped = clampDelta(Math.min(preset, safeMax));
    candidateSet.add(Number(clamped.toFixed(3)));
  }

  const candidates = Array.from(candidateSet)
    .filter((value) => value > 0 && value <= safeMax + 1e-6)
    .sort((a, b) => a - b);

  if (!candidates.length) {
    candidates.push(safeBase);
  }

  return candidates;
}

function surfaceKey(surface: Takflate): string {
  if (surface?.tak_id !== null && surface?.tak_id !== undefined) {
    return `tak:${surface.tak_id}`;
  }

  const byggKey =
    surface?.bygg_id ?? (typeof surface?.bygg_nr === 'string' ? surface.bygg_nr.trim() : '');
  const areaPart = Number.isFinite(surface?.area_m2) ? surface.area_m2.toFixed(3) : 'na';
  const irrPart = Number.isFinite(surface?.irr_kwh_m2_yr)
    ? surface.irr_kwh_m2_yr.toFixed(3)
    : 'na';

  return `geom:${byggKey}:${areaPart}:${irrPart}`;
}

function buildingGroupKey(surface: Takflate): string {
  if (surface?.bygg_id && Number.isFinite(surface.bygg_id)) {
    return `id:${Number(surface.bygg_id)}`;
  }
  if (typeof surface?.bygg_nr === 'string' && surface.bygg_nr.trim()) {
    return `nr:${surface.bygg_nr.trim()}`;
  }
  return 'unknown';
}

function groupPriority(key: string | null): number {
  if (!key) return 0;
  if (key.startsWith('id:')) return 3;
  if (key.startsWith('nr:')) return 2;
  return 1;
}

function summariseSurfacesForSelection(takflater: Takflate[]): SurfaceMetrics {
  const sumArea = takflater.reduce(
    (sum, surface) => sum + (Number(surface?.area_m2) || 0),
    0
  );
  const sumPot = takflater.reduce(
    (sum, surface) =>
      sum + (Number(surface?.area_m2) || 0) * (Number(surface?.irr_kwh_m2_yr) || 0),
    0
  );
  const avgIrr = sumArea > 0 ? sumPot / sumArea : 0;
  const filteredEnergy = takflater
    .filter((surface) => (surface?.irr_kwh_m2_yr ?? 0) > config.minRadiation)
    .reduce(
      (sum, surface) =>
        sum +
        (Number(surface?.area_m2) || 0) *
          (Number(surface?.irr_kwh_m2_yr) || 0) *
          config.solarPanelEfficiency,
      0
    );

  return {
    count: takflater.length,
    sumArea,
    sumPot,
    avgIrr,
    filteredEnergy,
  };
}

function selectBestGroup(allSurfaces: Takflate[]): BuildingGroupSelection {
  if (!allSurfaces.length) {
    return { key: null, surfaces: [], area: 0, priority: 0 };
  }

  const allMetrics = summariseSurfacesForSelection(allSurfaces);
  let best: BuildingGroupSelection = {
    key: null,
    surfaces: allSurfaces,
    area: allMetrics.sumArea,
    priority: 0,
  };

  const groups = new Map<string, Takflate[]>();
  for (const surface of allSurfaces) {
    const key = buildingGroupKey(surface);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(surface);
  }

  for (const [key, surfaces] of groups.entries()) {
    const metrics = summariseSurfacesForSelection(surfaces);
    const priority = groupPriority(key);
    if (
      priority > best.priority ||
      (priority === best.priority && metrics.sumArea > best.area)
    ) {
      best = { key, surfaces, area: metrics.sumArea, priority };
    }
  }

  return best;
}

interface CollectOptions {
  baseDelta?: number;
  maxDelta?: number;
}

async function collectTakflaterAroundPoint(
  point: ProjectedPoint | unknown,
  options: CollectOptions = {}
): Promise<CollectTakflaterResult> {
  const projected = normaliseProjectedPoint(point);
  const baseDelta = clampDelta(options.baseDelta ?? config.defaultPointDelta);
  const maxDelta = clampDelta(options.maxDelta ?? config.maxPointDelta);
  const candidates = buildDeltaCandidates(baseDelta, maxDelta);
  const surfacesByKey = new Map<string, Takflate>();
  const attempts: DeltaAttempt[] = [];
  const startTime = Date.now();

  let bestSelection: BuildingGroupSelection = {
    key: null,
    surfaces: [],
    area: 0,
    priority: 0,
  };
  let usedDelta = baseDelta;

  for (const candidate of candidates) {
    if (attempts.length >= config.autoDeltaMaxAttempts) {
      break;
    }

    const attemptStart = Date.now();
    const surfaces = await takflaterAroundProjected(projected, candidate);
    const durationMs = Date.now() - attemptStart;
    attempts.push({ delta: candidate, count: surfaces.length, durationMs });

    let newEntries = 0;
    for (const surface of surfaces) {
      const key = surfaceKey(surface);
      if (!surfacesByKey.has(key)) {
        surfacesByKey.set(key, surface);
        newEntries += 1;
      }
    }

    const combined = Array.from(surfacesByKey.values());
    if (combined.length) {
      const selection = selectBestGroup(combined);
      if (
        selection.priority > bestSelection.priority ||
        (selection.priority === bestSelection.priority &&
          selection.area > bestSelection.area)
      ) {
        bestSelection = selection;
        usedDelta = candidate;
      }
    }

    const elapsed = Date.now() - startTime;
    const reachedBreakpoint =
      candidate >= Math.min(maxDelta, config.autoDeltaBreakpoint);
    if (
      bestSelection.area > 0 &&
      newEntries === 0 &&
      (reachedBreakpoint || candidate >= maxDelta - 1e-6)
    ) {
      break;
    }
    if (elapsed > config.autoDeltaTimeLimitMs) {
      break;
    }
  }

  const finalSurfaces = bestSelection.surfaces.length
    ? bestSelection.surfaces
    : Array.from(surfacesByKey.values());

  if (attempts.length) {
    const summary = attempts
      .map((attempt) => `${attempt.delta}:${attempt.count}`)
      .join(', ');
    infoLog(
      'ADR delta-søk',
      JSON.stringify({
        usedDelta,
        attempts: summary,
        selection: bestSelection.key ?? 'all',
      })
    );
  }

  return {
    surfaces: finalSurfaces,
    usedDelta,
    attempts,
    selectionKey: bestSelection.key,
  };
}

function uniqueSurfaceValue(
  surfaces: Takflate[],
  property: keyof Takflate
): string | number | null {
  const values = new Set<string | number>();
  for (const surface of surfaces) {
    let value = surface?.[property];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      value = value.trim();
      if (!value) continue;
    }
    values.add(value);
  }
  if (values.size === 1) {
    return values.values().next().value ?? null;
  }
  return null;
}

async function hydrateBuildingSurfaces(surfaces: Takflate[]): Promise<Takflate[]> {
  if (!Array.isArray(surfaces) || !surfaces.length) {
    return surfaces;
  }

  const byggIdValue = uniqueSurfaceValue(surfaces, 'bygg_id');
  if (byggIdValue !== null && byggIdValue !== undefined) {
    const byggIdNumber = Number(byggIdValue);
    if (Number.isFinite(byggIdNumber) && byggIdNumber > 0) {
      const byId = await takflaterForByggId(String(byggIdNumber));
      if (byId.length) {
        infoLog('Bruker takflater fra BYGG_ID', byggIdNumber);
        return byId;
      }
    }
  }

  const byggNrValue = uniqueSurfaceValue(surfaces, 'bygg_nr');
  if (typeof byggNrValue === 'string' && byggNrValue.trim()) {
    try {
      const byNr = await takflaterForByggNr(sanitizeByggNr(byggNrValue));
      if (byNr.length) {
        infoLog('Bruker takflater fra BYGGNR', byggNrValue);
        return byNr;
      }
    } catch (error) {
      infoLog('Byggnr-oppslag feilet, fortsetter med ADR-resultat', {
        byggNr: byggNrValue,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return surfaces;
}

/* ───────── Kategorisering ────────────────────────────────────────────── */
function categorize(avg: number, ref: number = config.referenceKwh): string {
  const pct = (avg / ref) * 100;
  if (pct < 75) return 'Svært lavt';
  if (pct < 90) return 'Lavt';
  if (pct <= 110) return 'Gjennomsnittlig';
  if (pct <= 125) return 'Godt';
  return 'Svært godt';
}

/* ---------------- helper for trygg BYGG_ID ----------------------------- */
function sanitizeByggId(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Ugyldig bygg_id');
  return String(n);
}

function sanitizeByggNr(v: unknown): string {
  const str = String(v ?? '').trim();
  if (!/^[0-9]{5,}$/.test(str)) {
    throw new Error('Ugyldig bygg_nr');
  }
  return str;
}

/* ───────── Endpoint /solinnstraling ──────────────────────────────────── */
const solinnstralingHandler: RequestHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = req.query as unknown as SolarQueryParams;
    const { bygg_id, polygon, gnr, bnr, snr, lat, lon, delta } = query;

    if (config.mockMode) {
      const mockByggId = bygg_id ? Number.parseInt(String(bygg_id), 10) || 1 : 1;
      const mockTakflater: Takflate[] = [
        {
          tak_id: mockByggId * 10 + 1,
          bygg_id: mockByggId,
          bygg_nr: null,
          area_m2: 120,
          irr_kwh_m2_yr: 950,
          kWh_tot: 114_000,
        },
        {
          tak_id: mockByggId * 10 + 2,
          bygg_id: mockByggId,
          bygg_nr: null,
          area_m2: 60,
          irr_kwh_m2_yr: 820,
          kWh_tot: 49_200,
        },
      ];

      const mockSumPot = mockTakflater.reduce((sum, tak) => sum + tak.kWh_tot, 0);
      const mockSumArea = mockTakflater.reduce((sum, tak) => sum + tak.area_m2, 0);
      const mockAvgIrr = mockSumArea ? mockSumPot / mockSumArea : null;

      const mockResponse: SolarApiResponse = {
        reference: config.referenceKwh,
        takflater: mockTakflater,
        takAreal_m2: mockSumArea,
        sol_kwh_m2_yr: mockAvgIrr,
        sol_kwh_bygg_tot: mockSumPot,
        filteredSolarEnergy: mockSumPot * config.solarPanelEfficiency,
        category: mockAvgIrr ? categorize(mockAvgIrr) : 'Ukjent',
      };

      res.json(mockResponse);
      return;
    }

    const cacheKey = JSON.stringify(req.query);
    const hit = CACHE.get<SolarApiResponse>(cacheKey);
    if (hit) {
      res.json(hit);
      return;
    }

    let takflater: Takflate[] = [];

    /* -------- Søkeprioritet ------------------------------------------------ */
    const byggNrParam = query.bygg_nr ?? query.bygningsnummer;
    const byggNr = Array.isArray(byggNrParam) ? byggNrParam[0] : byggNrParam;

    if (byggNr) {
      try {
        takflater = await takflaterForByggNr(sanitizeByggNr(byggNr));
      } catch (error) {
        errorLog('Ugyldig bygg_nr-parameter', { byggNr, error });
        const errorResponse: SolarErrorResponse = { error: 'Ugyldig bygg_nr' };
        res.status(400).json(errorResponse);
        return;
      }
    } else if (bygg_id) {
      takflater = await takflaterForByggId(sanitizeByggId(bygg_id));
    } else if (typeof polygon === 'string' && polygon.trim()) {
      takflater = await takflaterForPolygon(polygon);
    } else if (gnr && bnr) {
      takflater = await takflaterForMatrikkel(
        String(gnr).padStart(5, '0'),
        String(bnr).padStart(4, '0'),
        snr
      );
    } else if (lat && lon) {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        const errorResponse: SolarErrorResponse = { error: 'Ugyldige koordinater' };
        res.status(400).json(errorResponse);
        return;
      }

      const requestedDelta = delta ? Number(delta) : undefined;
      const safeDelta = clampDelta(
        Number.isFinite(requestedDelta) ? requestedDelta : config.defaultPointDelta
      );

      const [east, north] = proj4('EPSG:4326', 'EPSG:32632', [lonNum, latNum]);
      const projectedPoint: ProjectedPoint = { east: Number(east), north: Number(north) };

      let lookupInfo: AdridLookupResult | null = null;
      try {
        lookupInfo = await fetchAdridNearProjected(projectedPoint);
        infoLog('ADR-søk', lookupInfo);
      } catch (error) {
        infoLog('ADR-søk feilet, fortsetter med koordinater', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      let candidateSurfaces: Takflate[] = [];
      if (lookupInfo?.point) {
        try {
          const { surfaces, usedDelta } = await collectTakflaterAroundPoint(
            lookupInfo.point,
            {
              baseDelta: safeDelta,
              maxDelta: config.maxPointDelta,
            }
          );
          if (surfaces.length) {
            infoLog('Fant takflater via ADRID', {
              adrid: lookupInfo.adrid,
              usedDelta,
              selection: surfaces[0]?.bygg_nr ?? surfaces[0]?.bygg_id ?? 'ukjent',
            });
            candidateSurfaces = surfaces;
          }
        } catch (error) {
          infoLog('ADR delta-metode feilet, prøver fallback', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!candidateSurfaces.length) {
        try {
          candidateSurfaces = await takflaterAroundProjected(projectedPoint, safeDelta);
        } catch (error) {
          infoLog('Direkte koordinatsøk feilet', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (
        !candidateSurfaces.length &&
        lookupInfo?.point &&
        safeDelta < config.maxPointDelta
      ) {
        try {
          candidateSurfaces = await takflaterAroundProjected(
            lookupInfo.point,
            config.maxPointDelta
          );
        } catch (error) {
          infoLog('Utvidet koordinatsøk feilet', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const hydrated = await hydrateBuildingSurfaces(candidateSurfaces);
      takflater = hydrated.length ? hydrated : candidateSurfaces;
    } else {
      const errorResponse: SolarErrorResponse = {
        error: 'Oppgi bygg_id, polygon, gnr/bnr eller lat/lon',
      };
      res.status(400).json(errorResponse);
      return;
    }

    /* -------- Ingen treff? ------------------------------------------------- */
    if (!takflater.length) {
      const errorResponse: SolarErrorResponse = { error: 'Ingen takflater funnet' };
      res.status(404).json(errorResponse);
      return;
    }

    /* -------- Summering / aggregering ------------------------------------- */
    const sumPot = takflater.reduce((sum, tak) => {
      const irr = Number(tak?.irr_kwh_m2_yr) || 0;
      const area = Number(tak?.area_m2) || 0;
      const total = Number(tak?.kWh_tot);
      return sum + (Number.isFinite(total) ? total : irr * area);
    }, 0);
    const sumArea = takflater.reduce(
      (sum, tak) => sum + (Number(tak?.area_m2) || 0),
      0
    );
    const avgIrr = sumArea ? sumPot / sumArea : null;
    const filteredSolarEnergy = takflater
      .filter((tak) => (Number(tak?.irr_kwh_m2_yr) || 0) > config.minRadiation)
      .reduce((sum, tak) => {
        const irr = Number(tak?.irr_kwh_m2_yr) || 0;
        const area = Number(tak?.area_m2) || 0;
        return sum + irr * area * config.solarPanelEfficiency;
      }, 0);

    const result: SolarApiResponse = {
      reference: config.referenceKwh,
      takflater,
      takAreal_m2: sumArea || null,
      sol_kwh_m2_yr: avgIrr,
      sol_kwh_bygg_tot: sumPot,
      filteredSolarEnergy,
      category: avgIrr ? categorize(avgIrr) : 'Ukjent',
    };

    CACHE.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukjent feil';
    errorLog('Feil i request handler', err);
    const errorResponse: SolarErrorResponse = { error: message };
    res.status(500).json(errorResponse);
  }
};

app.get('/solinnstraling', solinnstralingHandler);

/* ───────── Start server (standalone-kjøring) ──────────────────────────── */
const entryScript = process.argv[1] ?? '';
const isStandaloneExecution =
  process.env.SOLAR_SERVICE_STANDALONE === '1' || entryScript.includes('solar-service');

if (isStandaloneExecution) {
  app.listen(config.port, config.host, () => {
    infoLog(`Lytter på port ${config.host}:${config.port}`);
  });
}

// Eksport for debug-logging i tester
export { debugLog };
export default app;

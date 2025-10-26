#!/usr/bin/env node

/**
 * Ad-hoc script for exploring solar data retrieval via PBE Solkart.
 *
 * Eksempler:
 *   node --import tsx scripts/test-solar-adrid.ts 0301137470097000B000-
 *   node --import tsx scripts/test-solar-adrid.ts --address="Kjelsåsveien 97B, Oslo"
 *   node --import tsx scripts/test-solar-adrid.ts --address="Kjelsåsveien 97B, Oslo" --delta=5 --raw
 *
 * Scriptet er kun for manuell verifikasjon og gjør ingen endringer i applikasjonen.
 */

import fetch from 'node-fetch';
import proj4 from 'proj4';
import { XMLParser } from 'fast-xml-parser';

type CliOptions = {
  adrid?: string;
  address?: string;
  lat?: number;
  lon?: number;
  byggnr?: string;
  delta: number;
  maxDelta: number;
  autoDelta: boolean;
  adridBuffer: number;
  primaryBuildingOnly: boolean;
  showRaw: boolean;
};

type AddressPoint = {
  east: number;
  north: number;
};

type AddressIdLookup = {
  adrid: string;
  id: string;
  point: AddressPoint;
};

type GeonorgeCandidate = {
  adressetekst: string;
  adressekode: number;
  nummer: number;
  bokstav?: string | null;
  kommunenummer: string;
  kommunenavn: string;
  gardsnummer: number;
  bruksnummer: number;
  representasjonspunkt: {
    epsg: string;
    lat: number;
    lon: number;
  };
};

type SolarSurface = {
  tak_id: number | null;
  bygg_id: number | null;
  bygg_nr: string | null;
  collar?: string | null;
  area_m2: number;
  irr_kwh_m2_yr: number;
};

type AggregatedResult = {
  takflater: SolarSurface[];
  takAreal_m2: number | null;
  sol_kwh_m2_yr: number | null;
  sol_kwh_tot: number | null;
  filteredSolarEnergy: number;
  category: string;
};

const REF_OSLO = 1005;
const MIN_RADIATION = 800;
const SOLAR_PANEL_EFFICIENCY = 0.2;
const DEFAULT_DELTA = 10;
const DEFAULT_ADRID_BUFFER = 0.75;

const WFS_ENDPOINT = 'https://od2.pbe.oslo.kommune.no/cgi-bin/wms';
const SOLKART_MAP = 'd:/data_mapserver/kartfiler/solkart.map';
const SOLKART_LAYER = 'takflater2024';

proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

function parseArgs(argv: string[]): CliOptions {
  let adrid: string | undefined;
  let address: string | undefined;
  let lat: number | undefined;
  let lon: number | undefined;
  let byggnr: string | undefined;
  let delta = DEFAULT_DELTA;
  let maxDelta = 25;
  let autoDelta = true;
  let adridBuffer = DEFAULT_ADRID_BUFFER;
  let primaryBuildingOnly = false;
  let showRaw = false;

  const parseFloatArg = (label: string, value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Ugyldig verdi for ${label}: ${value}`);
    }
    return parsed;
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('--adrid=')) {
      adrid = arg.slice('--adrid='.length).trim();
    } else if (arg.startsWith('--address=')) {
      address = arg.slice('--address='.length).trim();
    } else if (arg.startsWith('--delta=')) {
      const value = parseFloatArg('delta', arg.slice('--delta='.length));
      if (value <= 0) throw new Error(`Delta må være > 0 (fikk ${value})`);
      delta = value;
    } else if (arg.startsWith('--adrid-buffer=')) {
      const value = parseFloatArg('adrid-buffer', arg.slice('--adrid-buffer='.length));
      if (value <= 0 || value > 5) {
        throw new Error(`adrid-buffer må være mellom 0 og 5 meter (fikk ${value})`);
      }
      adridBuffer = value;
    } else if (arg.startsWith('--lat=')) {
      lat = parseFloatArg('lat', arg.slice('--lat='.length));
    } else if (arg.startsWith('--lon=')) {
      lon = parseFloatArg('lon', arg.slice('--lon='.length));
    } else if (arg.startsWith('--max-delta=')) {
      const value = parseFloatArg('max-delta', arg.slice('--max-delta='.length));
      if (value <= 0) throw new Error(`max-delta må være > 0 (fikk ${value})`);
      maxDelta = value;
    } else if (arg.startsWith('--byggnr=')) {
      byggnr = arg.slice('--byggnr='.length).trim();
    } else if (arg === '--primary-building') {
      primaryBuildingOnly = true;
    } else if (arg === '--no-auto-delta') {
      autoDelta = false;
    } else if (arg === '--raw') {
      showRaw = true;
    } else if (!arg.startsWith('--')) {
      if (!adrid) {
        adrid = arg.trim();
      } else if (!address) {
        address = arg.trim();
      }
    }
  }

  if (!adrid && !address && (lat === undefined || lon === undefined)) {
    printUsage();
    throw new Error('Oppgi enten ADRID, adresse eller lat/lon.');
  }

  if (maxDelta < delta) {
    maxDelta = delta;
  }

  return {
    adrid,
    address,
    lat,
    lon,
    byggnr,
    delta,
    maxDelta,
    autoDelta,
    adridBuffer,
    primaryBuildingOnly,
    showRaw,
  };
}

function printUsage(): void {
  console.log(`Hent soldata fra PBE Solkart ved hjelp av ADRID, adresse eller koordinater.

Bruk:
  node --import tsx scripts/test-solar-adrid.ts <adrid>
  node --import tsx scripts/test-solar-adrid.ts --address="Kjelsåsveien 97B, Oslo"
  node --import tsx scripts/test-solar-adrid.ts --lat=59.95 --lon=10.76

Valg:
  --delta=<meter>         Bredde/høyde på søkeboks for takflater (default ${DEFAULT_DELTA})
  --adrid-buffer=<meter>  Buffer brukt når ADRID hentes fra koordinat (default ${DEFAULT_ADRID_BUFFER})
  --address="<adresse>"   Slå opp adresse via Geonorge før ADRID-henting
  --max-delta=<meter>     Øvre grense for automatisk delta-utvidelse (default 25)
  --no-auto-delta         Deaktiver automatisk utvidelse av søkeboksen
  --byggnr=<nr>           Filtrer takflater til angitt BYGGNR
  --primary-building      Velg automatisk BYGGNR med størst areal hvis flere finnes
  --lat=<grader>          Sett eksplisitt breddegrad (kombiner med --lon)
  --lon=<grader>          Sett eksplisitt lengdegrad (kombiner med --lat)
  --raw                   Vis rå takflate-data
  --help                  Vis denne hjelpen
`);
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  const normalised = String(value).replace(',', '.');
  return Number(normalised);
}

function parseFeatureCollection(xml: string): any[] {
  const parsed = xmlParser.parse(xml);
  const featureCollection =
    parsed.FeatureCollection ??
    parsed.Featurecollection ??
    parsed['wfs:FeatureCollection'];

  if (!featureCollection) {
    throw new Error('FeatureCollection mangler i WFS-respons');
  }

  const membersRaw = featureCollection.featureMember ?? featureCollection.member ?? [];
  const members = Array.isArray(membersRaw) ? membersRaw : [membersRaw];
  return members;
}

function extractPointFromFeature(feature: any): AddressPoint {
  const pos =
    feature?.msGeometry?.Point?.pos ??
    feature?.msGeometry?.Point?.posList ??
    feature?.msGeometry?.Point?.coordinates;

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

async function fetchAddressPointByAdrid(adrid: string): Promise<AddressPoint> {
  const filter = `<Filter><PropertyIsEqualTo><PropertyName>ADRID</PropertyName><Literal>${adrid}</Literal></PropertyIsEqualTo></Filter>`;

  const params = new URLSearchParams({
    map: 'WFS_SOK',
    VERSION: '1.1.0',
    SERVICE: 'WFS',
    REQUEST: 'GetFeature',
    TYPENAME: 'ADRESSEID_WFS',
    Filter: filter,
  });

  const url = `${WFS_ENDPOINT}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      accept: '*/*',
      'user-agent': 'Energinokkelen/adrid-probe',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Feil ved henting av ADRID (${response.status}): ${body.slice(0, 200)}...`);
  }

  const members = parseFeatureCollection(await response.text());
  if (!members.length) {
    throw new Error(`Fant ingen treff for ADRID ${adrid}`);
  }

  const feature =
    members[0].ADRESSEID_WFS ??
    members[0].Adresseid_wfs ??
    members[0].adresseid_wfs ??
    Object.values(members[0])[0];

  return extractPointFromFeature(feature);
}

async function fetchGeonorgeAddress(query: string): Promise<GeonorgeCandidate> {
  const params = new URLSearchParams({
    sok: query,
    fuzzy: 'true',
    treffPerSide: '1',
  });

  const url = `https://ws.geonorge.no/adresser/v1/sok?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Energinokkelen/adrid-probe',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Geonorge-oppslag feilet (${response.status}): ${body.slice(0, 200)}...`);
  }

  const json = (await response.json()) as { adresser?: GeonorgeCandidate[] };
  if (!json.adresser?.length) {
    throw new Error(`Fant ingen adresser hos Geonorge for "${query}"`);
  }

  return json.adresser[0];
}

async function fetchAdridNearPoint(point: AddressPoint, buffer: number): Promise<AddressIdLookup> {
  const bbox = [
    (point.east - buffer).toFixed(3),
    (point.north - buffer).toFixed(3),
    (point.east + buffer).toFixed(3),
    (point.north + buffer).toFixed(3),
  ].join(',');

  const params = new URLSearchParams({
    map: 'WFS_SOK',
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: 'ADRESSEID_WFS',
    SRSNAME: 'EPSG:32632',
    BBOX: bbox,
  });

  const url = `${WFS_ENDPOINT}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      accept: '*/*',
      'user-agent': 'Energinokkelen/adrid-probe',
    },
  });

  if (!response.ok) {
    const snippet = await response.text();
    throw new Error(`Feil ved ADRID-søk (${response.status}): ${snippet.slice(0, 200)}...`);
  }

  const members = parseFeatureCollection(await response.text());
  if (!members.length) {
    throw new Error('Fant ingen ADRID i området.');
  }

  const feature =
    members[0].ADRESSEID_WFS ??
    members[0].Adresseid_wfs ??
    members[0].adresseid_wfs ??
    Object.values(members[0])[0];

  const adrid = (feature.ADRID ?? feature.adrid)?.toString().trim();
  if (!adrid) {
    throw new Error('ADR ID mangler i responsen');
  }

  const id = (feature.ID ?? feature.id ?? '').toString().trim();
  const precisePoint = extractPointFromFeature(feature);

  return { adrid, id, point: precisePoint };
}

function parseTakflater(xml: string): SolarSurface[] {
  const members = parseFeatureCollection(xml);
  const takflater: SolarSurface[] = [];

  for (const member of members) {
    const entry =
      member[SOLKART_LAYER] ??
      member.takflater2024 ??
      member.Takflater2024 ??
      Object.values(member)[0];
    if (!entry) continue;

    const takId = entry.TAK_ID ? Number(entry.TAK_ID) : null;
    const byggId = entry.BYGG_ID ? Number(entry.BYGG_ID) : null;
    const byggNr = typeof entry.BYGGNR === 'string' ? entry.BYGGNR.trim() : null;
    const collar = typeof entry.COLLAR === 'string' ? entry.COLLAR.trim() : undefined;
    const area = parseNumber(entry.AREA);
    const irr = parseNumber(entry.SUM_AAR_KWH);

    if (!Number.isFinite(area) || !Number.isFinite(irr)) continue;

    takflater.push({
      tak_id: Number.isFinite(takId) ? takId : null,
      bygg_id: Number.isFinite(byggId) ? byggId : null,
      bygg_nr: byggNr && byggNr.length > 0 ? byggNr : null,
      collar: collar && collar.length > 0 ? collar : undefined,
      area_m2: area,
      irr_kwh_m2_yr: irr,
    });
  }

  return takflater;
}

async function fetchTakflaterAround(point: AddressPoint, delta: number): Promise<SolarSurface[]> {
  const bbox = [
    (point.east - delta).toFixed(3),
    (point.north - delta).toFixed(3),
    (point.east + delta).toFixed(3),
    (point.north + delta).toFixed(3),
  ].join(',');

  const params = new URLSearchParams({
    map: SOLKART_MAP,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: SOLKART_LAYER,
    SRSNAME: 'EPSG:32632',
    BBOX: bbox,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const url = `${WFS_ENDPOINT}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      accept: '*/*',
      'user-agent': 'Energinokkelen/adrid-probe',
    },
  });

  if (!response.ok) {
    const snippet = await response.text();
    throw new Error(`Feil ved henting av takflater (${response.status}): ${snippet.slice(0, 200)}...`);
  }

  return parseTakflater(await response.text());
}

function categorize(avg: number): string {
  if (avg <= 0) return 'Ukjent';
  const pct = (avg / REF_OSLO) * 100;
  if (pct < 75) return 'Svært lavt';
  if (pct < 90) return 'Lavt';
  if (pct <= 110) return 'Gjennomsnittlig';
  if (pct <= 125) return 'Godt';
  return 'Svært godt';
}

type SurfaceMetrics = {
  surfaces: number;
  takAreal: number | null;
  totalIrr: number | null;
  avgIrr: number | null;
  filtered: number;
};

function summariseSurfaces(takflater: SolarSurface[]): SurfaceMetrics {
  if (!takflater.length) {
    return {
      surfaces: 0,
      takAreal: null,
      totalIrr: null,
      avgIrr: null,
      filtered: 0,
    };
  }

  const sumArea = takflater.reduce((sum, tak) => sum + tak.area_m2, 0);
  const sumPot = takflater.reduce((sum, tak) => sum + tak.area_m2 * tak.irr_kwh_m2_yr, 0);
  const avgIrr = sumArea > 0 ? sumPot / sumArea : null;
  const filtered = takflater
    .filter((tak) => tak.irr_kwh_m2_yr > MIN_RADIATION)
    .reduce((sum, tak) => sum + tak.irr_kwh_m2_yr * tak.area_m2 * SOLAR_PANEL_EFFICIENCY, 0);

  return {
    surfaces: takflater.length,
    takAreal: sumArea || null,
    totalIrr: sumPot || null,
    avgIrr,
    filtered,
  };
}

type DeltaAttempt = {
  delta: number;
  count: number;
  durationMs: number;
};

async function collectTakflater(
  point: AddressPoint,
  options: CliOptions
): Promise<{ surfaces: SolarSurface[]; usedDelta: number; attempts: DeltaAttempt[] }> {
  const { delta, maxDelta, autoDelta } = options;
  const attempts: DeltaAttempt[] = [];
  const candidateSet = new Set<number>();

  const addCandidate = (value: number | undefined | null) => {
    if (value === null || value === undefined) return;
    if (!Number.isFinite(value)) return;
    const candidate = Math.max(0, Number(value));
    if (!candidate) return;
    const clamped = Math.min(candidate, maxDelta);
    if (clamped <= 0) return;
    candidateSet.add(Number(clamped.toFixed(3)));
  };

  if (autoDelta) {
    [1, 3, 5, 8, 12, 18, 25].forEach(addCandidate);
  }
  addCandidate(delta);
  addCandidate(maxDelta);

  const candidates = Array.from(candidateSet).sort((a, b) => a - b);
  if (!candidates.length) {
    candidates.push(delta);
  }

  const surfacesByKey = new Map<string, SolarSurface>();
  const allowedByggnr = new Set<string>();
  const restrictByggnr = Boolean(options.byggnr);
  let allowAllBuildings = !restrictByggnr;

  if (options.byggnr) {
    allowedByggnr.add(options.byggnr);
  }

  const surfaceKey = (surface: SolarSurface): string => {
    if (surface.tak_id !== null) {
      return `tak:${surface.tak_id}`;
    }
    return `geom:${surface.bygg_nr ?? 'ukjent'}:${surface.area_m2.toFixed(3)}:${surface.irr_kwh_m2_yr.toFixed(3)}`;
  };

  const startTime = Date.now();
  const MAX_ATTEMPTS = 8;
  const TIME_LIMIT_MS = 2000;
  const EPS = 1e-3;

  let usedDelta = candidates[candidates.length - 1] ?? maxDelta;
  let bestSurfaces: SolarSurface[] = [];
  let bestArea = 0;
  let lastArea = -1;

  for (const candidate of candidates) {
    if (attempts.length >= MAX_ATTEMPTS) {
      break;
    }

    const attemptStart = Date.now();
    const surfaces = await fetchTakflaterAround(point, candidate);
    const durationMs = Date.now() - attemptStart;
    attempts.push({ delta: candidate, count: surfaces.length, durationMs });

    const sizeBefore = surfacesByKey.size;
    for (const surface of surfaces) {
      const key = surfaceKey(surface);
      if (!surfacesByKey.has(key)) {
        surfacesByKey.set(key, surface);
      }
    }
    const newEntries = surfacesByKey.size - sizeBefore;

    const allSurfaces = Array.from(surfacesByKey.values());

    if (restrictByggnr && !allowAllBuildings) {
      const byggnrInAttempt = new Set(
        surfaces
          .map((surface) => surface.bygg_nr)
          .filter((value): value is string => Boolean(value))
      );
      if (!allowedByggnr.size && byggnrInAttempt.size) {
        byggnrInAttempt.forEach((value) => allowedByggnr.add(value));
      }
      if (!allowedByggnr.size && surfaces.some((surface) => !surface.bygg_nr)) {
        allowAllBuildings = true;
      }
    }

    const filteredForMetrics = restrictByggnr && allowedByggnr.size && !allowAllBuildings
      ? allSurfaces.filter((surface) => surface.bygg_nr && allowedByggnr.has(surface.bygg_nr))
      : allSurfaces;

    const metrics = summariseSurfaces(filteredForMetrics);
    const currentArea = metrics.takAreal ?? 0;

    if (currentArea > bestArea && filteredForMetrics.length) {
      bestArea = currentArea;
      bestSurfaces = filteredForMetrics.slice();
      usedDelta = candidate;
    }

    const elapsed = Date.now() - startTime;
    const plateau = lastArea >= 0 && Math.abs(currentArea - lastArea) < EPS;
    lastArea = currentArea;

    const plateauBreakDelta = Math.min(maxDelta, 12);
    const shouldBreak =
      !autoDelta ||
      (currentArea > 0 && newEntries === 0 && plateau && candidate >= plateauBreakDelta) ||
      elapsed > TIME_LIMIT_MS;

    if (shouldBreak) {
      break;
    }
  }

  if (!bestSurfaces.length) {
    bestSurfaces = Array.from(surfacesByKey.values());
    if (attempts.length) {
      usedDelta = attempts[attempts.length - 1].delta;
    }
  }

  return { surfaces: bestSurfaces, usedDelta, attempts };
}

function aggregateSurfaces(takflater: SolarSurface[]): AggregatedResult {
  const metrics = summariseSurfaces(takflater);

  return {
    takflater,
    takAreal_m2: metrics.takAreal,
    sol_kwh_m2_yr: metrics.avgIrr,
    sol_kwh_tot: metrics.totalIrr,
    filteredSolarEnergy: metrics.filtered,
    category: categorize(metrics.avgIrr ?? 0),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  let { adrid } = options;
  let lat = options.lat;
  let lon = options.lon;
  let point: AddressPoint | undefined;

  if (options.address) {
    console.log(`🔎 Slår opp adresse hos Geonorge: ${options.address}`);
    const geonorge = await fetchGeonorgeAddress(options.address);
    console.log(`   • Adressetekst: ${geonorge.adressetekst}`);
    console.log(`   • Kommune: ${geonorge.kommunenummer} ${geonorge.kommunenavn}`);
    console.log(`   • GNR/BNR: ${geonorge.gardsnummer}/${geonorge.bruksnummer}`);
    console.log(`   • Adressekode/husnummer: ${geonorge.adressekode}/${geonorge.nummer}${geonorge.bokstav ?? ''}`);
    lat ??= geonorge.representasjonspunkt.lat;
    lon ??= geonorge.representasjonspunkt.lon;
  }

  if (adrid) {
    console.log(`➡️  Slår opp ADRID ${adrid} (delta=${options.delta} m) ...`);
    point = await fetchAddressPointByAdrid(adrid);
    if (lat === undefined || lon === undefined) {
      const [lonWgs, latWgs] = proj4('EPSG:32632', 'EPSG:4326', [point.east, point.north]) as [number, number];
      lat = latWgs;
      lon = lonWgs;
    }
  } else {
    if (lat === undefined || lon === undefined) {
      throw new Error('Lat/lon mangler – kan ikke finne ADRID automatisk.');
    }
    const [east, north] = proj4('EPSG:4326', 'EPSG:32632', [lon, lat]) as [number, number];
    const lookup = await fetchAdridNearPoint({ east, north }, options.adridBuffer);
    adrid = lookup.adrid;
    point = lookup.point;
    console.log(`➡️  Fant ADRID ${lookup.adrid} (ID=${lookup.id}) innenfor ${options.adridBuffer} m buffer.`);
  }

  if (!point || !adrid) {
    throw new Error('Kunne ikke finne gyldig ADRID eller koordinat.');
  }

  const [lonWgs, latWgs] = proj4('EPSG:32632', 'EPSG:4326', [point.east, point.north]) as [number, number];
  console.log('📍 Koordinater (EPSG:32632):', point);
  console.log('🌍 Koordinater (WGS84):', {
    lat: Number(latWgs.toFixed(8)),
    lon: Number(lonWgs.toFixed(8)),
  });

  const { surfaces: takflater, usedDelta, attempts } = await collectTakflater(point, options);
  const attemptSummary = attempts
    .map((a) => `${a.delta}m:${a.count}`)
    .join(', ');

  if (attempts.length) {
    console.log(`🔄 Søkeforsøk (delta:takflater): ${attemptSummary}`);
  }

  if (!takflater.length) {
    console.log('⚠️  Fant ingen takflater innenfor søkeboksen.');
    return;
  }

  console.log(`🔍 Valgt søkeboks: ±${usedDelta} m`);

  const buildingGroups = new Map<string, SolarSurface[]>();
  for (const tak of takflater) {
    if (!tak.bygg_nr) continue;
    if (!buildingGroups.has(tak.bygg_nr)) {
      buildingGroups.set(tak.bygg_nr, []);
    }
    buildingGroups.get(tak.bygg_nr)!.push(tak);
  }

  const buildingSummaries = Array.from(buildingGroups.entries()).map(([byggNr, surfaces]) => {
    const metrics = summariseSurfaces(surfaces);
    return {
      byggNr,
      surfaces: metrics.surfaces,
      takAreal: metrics.takAreal ? Number(metrics.takAreal.toFixed(2)) : null,
      avgIrr: metrics.avgIrr ? Number(metrics.avgIrr.toFixed(2)) : null,
      totalIrr: metrics.totalIrr ? Number(metrics.totalIrr.toFixed(2)) : null,
      filtered: Number(metrics.filtered.toFixed(2)),
    };
  });

  let selectedBuilding: string | undefined;

  if (options.byggnr) {
    if (buildingGroups.has(options.byggnr)) {
      selectedBuilding = options.byggnr;
    } else {
      console.warn(
        `⚠️  Angitt BYGGNR ${options.byggnr} finnes ikke i resultatet (tilgjengelig: ${
          buildingSummaries.map((s) => s.byggNr).join(', ') || 'ingen'
        })`
      );
    }
  } else if (options.primaryBuildingOnly && buildingSummaries.length > 1) {
    selectedBuilding = buildingSummaries
      .slice()
      .sort((a, b) => (b.takAreal ?? 0) - (a.takAreal ?? 0))[0]?.byggNr;
    if (selectedBuilding) {
      console.log(`ℹ️  Filtrerer til hovedbygg (størst takareal): ${selectedBuilding}`);
    }
  }

  let filteredSurfaces = takflater;
  if (selectedBuilding) {
    filteredSurfaces = takflater.filter((tak) => tak.bygg_nr === selectedBuilding);
    if (!filteredSurfaces.length) {
      console.warn(`⚠️  Ingen takflater igjen etter filtrering på ${selectedBuilding}.`);
    }
  }

  if (buildingSummaries.length > 1) {
    console.log('\n📊 Takflater per bygg:');
    console.table(
      buildingSummaries.map((s) => ({
        bygg_nr: s.byggNr,
        flater: s.surfaces,
        takareal_m2: s.takAreal ?? 'ukjent',
        gj_snitt_kWh_m2: s.avgIrr ?? 'ukjent',
        total_kWh: s.totalIrr ?? 'ukjent',
        filtrert_kWh: s.filtered,
      }))
    );
  }

  const aggregated = aggregateSurfaces(filteredSurfaces);
  const byggNumre = Array.from(
    new Set(filteredSurfaces.map((tak) => tak.bygg_nr).filter(Boolean))
  );

  console.log(`✅ Fant ${filteredSurfaces.length} takflater for ADRID ${adrid}.`);
  if (byggNumre.length) {
    console.log('   • BYGGNR fra takflater:', byggNumre.join(', '));
  }
  console.log('   • Takareal (m²):', aggregated.takAreal_m2 ? aggregated.takAreal_m2.toFixed(2) : 'ukjent');
  console.log(
    '   • Gj.snitt innstråling (kWh/m²·år):',
    aggregated.sol_kwh_m2_yr ? aggregated.sol_kwh_m2_yr.toFixed(2) : 'ukjent'
  );
  console.log(
    '   • Total innstråling (kWh/år):',
    aggregated.sol_kwh_tot ? aggregated.sol_kwh_tot.toFixed(2) : 'ukjent'
  );
  console.log(
    '   • Filtrert solenergi (0.2 η, > 800 kWh/m²):',
    aggregated.filteredSolarEnergy.toFixed(2),
    'kWh/år'
  );
  console.log(`   • Kategori (ref=${REF_OSLO} kWh/m²): ${aggregated.category}`);

  if (options.showRaw) {
    console.log('\n🔍 Rå takflater:');
    console.table(
      filteredSurfaces.map((tak) => ({
        tak_id: tak.tak_id ?? '-',
        bygg_id: tak.bygg_id ?? '-',
        bygg_nr: tak.bygg_nr ?? '-',
        area_m2: Number(tak.area_m2.toFixed(3)),
        irr_kwh_m2_yr: Number(tak.irr_kwh_m2_yr.toFixed(3)),
        kwh_tot: Number((tak.area_m2 * tak.irr_kwh_m2_yr).toFixed(3)),
      }))
    );
  }
}

main().catch((error) => {
  console.error('❌ Script feilet:', error);
  process.exitCode = 1;
});

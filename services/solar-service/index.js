// services/solar-service/index.js
// ---------------------------------------------------------------------------
//  Henter solinnstråling fra PBE-Solkart 2024
//   • ?bygg_id=123456           (presist – prioritet 1)
//   • ?polygon=<WKT>            (seksjon / bygg-polygon)
//   • ?gnr=&bnr=[&snr=]         (hele matrikkelenheten)
//   • ?lat=&lon=[&delta=]       (punkt, default 10 m radius)                 ★
// ---------------------------------------------------------------------------

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import proj4 from "proj4";
import { XMLParser } from "fast-xml-parser";

/* ───────── SRID-definisjoner ─────────────────────────────────────────── */
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs"); // ★

/* ───────── Konstanter ────────────────────────────────────────────────── */
const app = express();
const REF_OSLO = Number(process.env.SOLAR_REFERENCE_KWH ?? "1005"); // kWh/m²·år
const SOLAR_CACHE_TTL = Number(process.env.SOLAR_CACHE_TTL ?? "3600");
const CACHE = new NodeCache({
  stdTTL: SOLAR_CACHE_TTL,
  checkperiod: Math.max(60, Math.floor(SOLAR_CACHE_TTL / 3)),
}); // cache TTL
const WFS_URL =
  process.env.SOLAR_WFS_URL ?? "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
const MAP_FILE =
  process.env.SOLAR_MAP_FILE ?? "d:/data_mapserver/kartfiler/solkart.map";
const LAYER = process.env.SOLAR_LAYER ?? "takflater2024";
const RAW_DEFAULT_POINT_DELTA = Number(
  process.env.SOLAR_POINT_DELTA ?? "10"
);
const DEFAULT_POINT_DELTA =
  Number.isFinite(RAW_DEFAULT_POINT_DELTA) && RAW_DEFAULT_POINT_DELTA > 0
    ? RAW_DEFAULT_POINT_DELTA
    : 10;
const RAW_MIN_POINT_DELTA = Number(process.env.SOLAR_POINT_MIN_DELTA ?? "0.5");
const MIN_POINT_DELTA =
  Number.isFinite(RAW_MIN_POINT_DELTA) && RAW_MIN_POINT_DELTA > 0
    ? RAW_MIN_POINT_DELTA
    : 0.5;
const MIN_RADIATION = Number(process.env.SOLAR_MIN_RADIATION ?? "800");
const SOLAR_PANEL_EFFICIENCY = Number(
  process.env.SOLAR_PANEL_EFFICIENCY ?? "0.2"
);
const EFFECTIVE_MIN_POINT_DELTA =
  Number.isFinite(MIN_POINT_DELTA) && MIN_POINT_DELTA > 0
    ? MIN_POINT_DELTA
    : 0.5;
const ADDRESS_MAP = process.env.SOLAR_ADDRESS_MAP ?? "WFS_SOK";
const ADDRESS_LAYER = process.env.SOLAR_ADDRESS_LAYER ?? "ADRESSEID_WFS";
const DEFAULT_ADRID_BUFFER = Number(process.env.SOLAR_ADRID_BUFFER ?? "0.75");
const RAW_MAX_POINT_DELTA = Number(
  process.env.SOLAR_POINT_MAX_DELTA ?? "25"
);
const MAX_POINT_DELTA =
  Number.isFinite(RAW_MAX_POINT_DELTA) && RAW_MAX_POINT_DELTA > 0
    ? RAW_MAX_POINT_DELTA
    : 25;
const AUTO_DELTA_PRESETS = (
  process.env.SOLAR_POINT_AUTO_DELTAS ?? "1,3,5,8,12,18,25"
)
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
if (!AUTO_DELTA_PRESETS.length) {
  AUTO_DELTA_PRESETS.push(1, 3, 5, 8, 12, 18, 25);
}
const AUTO_DELTA_BREAKPOINT = Number(
  process.env.SOLAR_POINT_PLATEAU_DELTA ?? "12"
);
const AUTO_DELTA_MAX_ATTEMPTS = Number(
  process.env.SOLAR_POINT_MAX_ATTEMPTS ?? "8"
);
const AUTO_DELTA_TIME_LIMIT_MS = Number(
  process.env.SOLAR_POINT_TIME_LIMIT_MS ?? "2000"
);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

const infoLog = (...args) => console.warn('[solar-service]', ...args);
const errorLog = (...args) => console.error('[solar-service:error]', ...args);
const MOCK_MODE =
  process.env.SOLAR_SERVICE_MOCK === "1" ||
  process.env.SOLAR_SERVICE_MOCK?.toLowerCase() === "true";

app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/* ───────── Mini-helper for WFS-kall ───────────────────────────────────── */
async function wfsCall(params) {
  const res = await fetch(`${WFS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  return res.text(); // XML som string
}

/* ───────── GML → takflate-array ──────────────────────────────────────── */
function parseFeatureMembers(xml) {
  const feats =
    xml.match(/<ms:takflater2024[\s\S]*?<\/ms:takflater2024>/gi) || [];

  return feats.map((blk) => {
    const tag = (t) =>
      (blk.match(new RegExp(`<ms:${t}>([0-9.,-]+)<\\/ms:${t}>`, "i")) || [])[1];
    const textTag = (t) =>
      (blk.match(new RegExp(`<ms:${t}>([^<]+)<\\/ms:${t}>`, "i")) || [])[1];

    const takId = Number(tag("TAK_ID"));
    const byggId = Number(tag("BYGG_ID")); // ★ NYTT
    const byggNrRaw = textTag("BYGGNR");
    const area = Number(tag("AREA").replace(",", "."));
    const irr = Number(tag("SUM_AAR_KWH").replace(",", "."));

    return {
      tak_id: takId,
      bygg_id: byggId || null, // ★
      bygg_nr: byggNrRaw ? byggNrRaw.trim() : null,
      area_m2: area,
      irr_kwh_m2_yr: irr,
      kWh_tot: irr * area,
    };
  });
}

/* ───────── 1) BYGG_ID-filter ─────────────────────────────────────────── */
async function takflaterForByggId(id) {
  const filter = `<Filter xmlns="http://www.opengis.net/ogc">
    <PropertyIsEqualTo><PropertyName>BYGG_ID</PropertyName><Literal>${id}</Literal></PropertyIsEqualTo>
  </Filter>`;

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    FILTER: filter,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

/* ───────── 2) Polygon-filter ─────────────────────────────────────────── */
async function takflaterForByggNr(byggNr) {
  const filter = `<Filter xmlns="http://www.opengis.net/ogc">
    <PropertyIsEqualTo><PropertyName>BYGGNR</PropertyName><Literal>${byggNr}</Literal></PropertyIsEqualTo>
  </Filter>`;

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    FILTER: filter,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

async function takflaterForPolygon(wkt) {
  const cql = `INTERSECTS(msGeometry, SRID=32632;${wkt})`;

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    CQL_FILTER: cql,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

/* ───────── 3) Matrikkel-filter ───────────────────────────────────────── */
async function takflaterForMatrikkel(gnr, bnr, snr) {
  const parts = [
    `<PropertyIsEqualTo><PropertyName>GNR</PropertyName><Literal>${gnr}</Literal></PropertyIsEqualTo>`,
    `<PropertyIsEqualTo><PropertyName>BNR</PropertyName><Literal>${bnr}</Literal></PropertyIsEqualTo>`,
  ];
  if (snr) {
    parts.push(
      `<PropertyIsEqualTo><PropertyName>SNR</PropertyName><Literal>${snr}</Literal></PropertyIsEqualTo>`
    );
  }
  const filter = `<Filter xmlns="http://www.opengis.net/ogc"><And>${parts.join(
    ""
  )}</And></Filter>`;

  const p = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    FILTER: filter,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(p);
  return parseFeatureMembers(xml);
}

function clampDelta(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_POINT_DELTA;
  }
  const min = EFFECTIVE_MIN_POINT_DELTA;
  const max = Math.max(min, MAX_POINT_DELTA);
  return Math.min(max, Math.max(min, numeric));
}

function normaliseProjectedPoint(point) {
  const east = Number(
    point?.east ?? point?.x ?? (Array.isArray(point) ? point[0] : undefined)
  );
  const north = Number(
    point?.north ?? point?.y ?? (Array.isArray(point) ? point[1] : undefined)
  );
  if (!Number.isFinite(east) || !Number.isFinite(north)) {
    throw new Error("Ugyldige projiserte koordinater");
  }
  return { east, north };
}

function parseFeatureCollection(xml) {
  const parsed = xmlParser.parse(xml);
  const featureCollection =
    parsed.FeatureCollection ??
    parsed.Featurecollection ??
    parsed["wfs:FeatureCollection"];
  if (!featureCollection) {
    throw new Error("FeatureCollection mangler i WFS-respons");
  }
  const membersRaw =
    featureCollection.featureMember ||
    featureCollection.member ||
    featureCollection["gml:featureMember"] ||
    [];
  const members = Array.isArray(membersRaw) ? membersRaw : [membersRaw];
  return members.filter(Boolean);
}

function extractPointFromFeature(feature) {
  const pos =
    feature?.msGeometry?.Point?.pos ??
    feature?.msGeometry?.Point?.posList ??
    feature?.msGeometry?.Point?.coordinates ??
    feature?.Point?.pos ??
    feature?.Point?.coordinates;
  if (typeof pos !== "string" || !pos.trim()) {
    throw new Error("Fant ikke koordinater i WFS-feature");
  }
  const [eastStr, northStr] = pos.trim().split(/\s+/);
  const east = Number(eastStr);
  const north = Number(northStr);
  if (!Number.isFinite(east) || !Number.isFinite(north)) {
    throw new Error(`Ugyldige koordinater i feature: ${pos}`);
  }
  return { east, north };
}

async function fetchAdridNearProjected(point, buffer = DEFAULT_ADRID_BUFFER) {
  const projected = normaliseProjectedPoint(point);
  const clampedBuffer = clampDelta(buffer);
  const bbox = [
    (projected.east - clampedBuffer).toFixed(3),
    (projected.north - clampedBuffer).toFixed(3),
    (projected.east + clampedBuffer).toFixed(3),
    (projected.north + clampedBuffer).toFixed(3),
  ].join(",");

  const params = new URLSearchParams({
    map: ADDRESS_MAP,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: ADDRESS_LAYER,
    SRSNAME: "EPSG:32632",
    BBOX: bbox,
  });

  const xml = await wfsCall(params);
  const members = parseFeatureCollection(xml);
  if (!members.length) {
    throw new Error("Fant ingen ADRID innenfor søkeområdet");
  }

  const wrapper = members[0] ?? {};
  const lowerKey = ADDRESS_LAYER.toLowerCase();
  const upperKey = ADDRESS_LAYER.toUpperCase();
  const feature =
    wrapper[ADDRESS_LAYER] ??
    wrapper[lowerKey] ??
    wrapper[upperKey] ??
    Object.values(wrapper)[0];

  if (!feature) {
    throw new Error("ADR-feature mangler i WFS-respons");
  }

  const adridRaw =
    feature.ADRID ?? feature.adrid ?? feature.AdresseId ?? feature.Adrid;
  const adrid =
    typeof adridRaw === "string"
      ? adridRaw.trim()
      : Number.isFinite(adridRaw)
      ? String(adridRaw)
      : null;

  if (!adrid) {
    throw new Error("ADR-ID mangler i responsen");
  }

  const idRaw = feature.ID ?? feature.id ?? feature.FID ?? "";
  const precisePoint = extractPointFromFeature(feature);

  return {
    adrid,
    id: typeof idRaw === "string" ? idRaw.trim() : String(idRaw),
    point: precisePoint,
  };
}

async function takflaterAroundProjected(point, delta = DEFAULT_POINT_DELTA) {
  const projected = normaliseProjectedPoint(point);
  const clampedDelta = clampDelta(delta);

  const bbox = [
    (projected.east - clampedDelta).toFixed(3),
    (projected.north - clampedDelta).toFixed(3),
    (projected.east + clampedDelta).toFixed(3),
    (projected.north + clampedDelta).toFixed(3),
  ].join(",");

  const params = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: "WFS",
    VERSION: "1.1.0",
    REQUEST: "GetFeature",
    TYPENAME: LAYER,
    SRSNAME: "EPSG:32632",
    BBOX: bbox,
    OUTPUTFORMAT: "text/xml; subtype=gml/3.1.1",
  });

  const xml = await wfsCall(params);
  return parseFeatureMembers(xml);
}

function buildDeltaCandidates(baseDelta, maxDelta = MAX_POINT_DELTA) {
  const candidateSet = new Set();
  const safeBase = clampDelta(baseDelta);
  const safeMax = clampDelta(maxDelta);

  candidateSet.add(Number(safeBase.toFixed(3)));
  candidateSet.add(Number(safeMax.toFixed(3)));

  for (const preset of AUTO_DELTA_PRESETS) {
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

function surfaceKey(surface) {
  if (surface?.tak_id !== null && surface?.tak_id !== undefined) {
    return `tak:${surface.tak_id}`;
  }

  const byggKey =
    surface?.bygg_id ??
    (typeof surface?.bygg_nr === "string" ? surface.bygg_nr.trim() : "");
  const areaPart = Number.isFinite(surface?.area_m2)
    ? surface.area_m2.toFixed(3)
    : "na";
  const irrPart = Number.isFinite(surface?.irr_kwh_m2_yr)
    ? surface.irr_kwh_m2_yr.toFixed(3)
    : "na";

  return `geom:${byggKey}:${areaPart}:${irrPart}`;
}

function buildingGroupKey(surface) {
  if (surface?.bygg_id && Number.isFinite(surface.bygg_id)) {
    return `id:${Number(surface.bygg_id)}`;
  }
  if (typeof surface?.bygg_nr === "string" && surface.bygg_nr.trim()) {
    return `nr:${surface.bygg_nr.trim()}`;
  }
  return "unknown";
}

function groupPriority(key) {
  if (!key) return 0;
  if (key.startsWith("id:")) return 3;
  if (key.startsWith("nr:")) return 2;
  return 1;
}

function summariseSurfacesForSelection(takflater) {
  const sumArea = takflater.reduce(
    (sum, surface) => sum + (Number(surface?.area_m2) || 0),
    0
  );
  const sumPot = takflater.reduce(
    (sum, surface) =>
      sum +
      (Number(surface?.area_m2) || 0) * (Number(surface?.irr_kwh_m2_yr) || 0),
    0
  );
  const avgIrr = sumArea > 0 ? sumPot / sumArea : 0;
  const filteredEnergy = takflater
    .filter((surface) => (surface?.irr_kwh_m2_yr ?? 0) > MIN_RADIATION)
    .reduce(
      (sum, surface) =>
        sum +
        (Number(surface?.area_m2) || 0) *
          (Number(surface?.irr_kwh_m2_yr) || 0) *
          SOLAR_PANEL_EFFICIENCY,
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

function selectBestGroup(allSurfaces) {
  if (!allSurfaces.length) {
    return { key: null, surfaces: [], area: 0, priority: 0 };
  }

  const allMetrics = summariseSurfacesForSelection(allSurfaces);
  let best = {
    key: null,
    surfaces: allSurfaces,
    area: allMetrics.sumArea,
    priority: 0,
  };

  const groups = new Map();
  for (const surface of allSurfaces) {
    const key = buildingGroupKey(surface);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(surface);
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

async function collectTakflaterAroundPoint(point, options = {}) {
  const projected = normaliseProjectedPoint(point);
  const baseDelta = clampDelta(options.baseDelta ?? DEFAULT_POINT_DELTA);
  const maxDelta = clampDelta(options.maxDelta ?? MAX_POINT_DELTA);
  const candidates = buildDeltaCandidates(baseDelta, maxDelta);
  const surfacesByKey = new Map();
  const attempts = [];
  const startTime = Date.now();

  let bestSelection = {
    key: null,
    surfaces: [],
    area: 0,
    priority: 0,
  };
  let usedDelta = baseDelta;

  for (const candidate of candidates) {
    if (attempts.length >= AUTO_DELTA_MAX_ATTEMPTS) {
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
      candidate >= Math.min(maxDelta, AUTO_DELTA_BREAKPOINT);
    if (
      bestSelection.area > 0 &&
      newEntries === 0 &&
      (reachedBreakpoint || candidate >= maxDelta - 1e-6)
    ) {
      break;
    }
    if (elapsed > AUTO_DELTA_TIME_LIMIT_MS) {
      break;
    }
  }

  const finalSurfaces = bestSelection.surfaces.length
    ? bestSelection.surfaces
    : Array.from(surfacesByKey.values());

  if (attempts.length) {
    const summary = attempts
      .map((attempt) => `${attempt.delta}:${attempt.count}`)
      .join(", ");
    infoLog(
      "ADR delta-søk",
      JSON.stringify({
        usedDelta,
        attempts: summary,
        selection: bestSelection.key ?? "all",
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

function uniqueSurfaceValue(surfaces, property) {
  const values = new Set();
  for (const surface of surfaces) {
    let value = surface?.[property];
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      value = value.trim();
      if (!value) continue;
    }
    values.add(value);
  }
  if (values.size === 1) {
    return values.values().next().value;
  }
  return null;
}

async function hydrateBuildingSurfaces(surfaces) {
  if (!Array.isArray(surfaces) || !surfaces.length) {
    return surfaces;
  }

  const byggIdValue = uniqueSurfaceValue(surfaces, "bygg_id");
  if (byggIdValue !== null && byggIdValue !== undefined) {
    const byggIdNumber = Number(byggIdValue);
    if (Number.isFinite(byggIdNumber) && byggIdNumber > 0) {
      const byId = await takflaterForByggId(String(byggIdNumber));
      if (byId.length) {
        infoLog("Bruker takflater fra BYGG_ID", byggIdNumber);
        return byId;
      }
    }
  }

  const byggNrValue = uniqueSurfaceValue(surfaces, "bygg_nr");
  if (typeof byggNrValue === "string" && byggNrValue.trim()) {
    try {
      const byNr = await takflaterForByggNr(sanitizeByggNr(byggNrValue));
      if (byNr.length) {
        infoLog("Bruker takflater fra BYGGNR", byggNrValue);
        return byNr;
      }
    } catch (error) {
      infoLog("Byggnr-oppslag feilet, fortsetter med ADR-resultat", {
        byggNr: byggNrValue,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return surfaces;
}

/* ───────── Kategorisering ────────────────────────────────────────────── */
function categorize(avg, ref = REF_OSLO) {
  const pct = (avg / ref) * 100;
  if (pct < 75) return "Svært lavt";
  if (pct < 90) return "Lavt";
  if (pct <= 110) return "Gjennomsnittlig";
  if (pct <= 125) return "Godt";
  return "Svært godt";
}

/* ───────── Endpoint /solinnstraling ──────────────────────────────────── */
app.get("/solinnstraling", async (req, res) => {
  try {
    const { bygg_id, polygon, gnr, bnr, snr, lat, lon, delta } = req.query;

    if (MOCK_MODE) {
      const mockByggId = bygg_id ? Number.parseInt(String(bygg_id), 10) || 1 : 1;
      const mockTakflater = [
        {
          tak_id: mockByggId * 10 + 1,
          bygg_id: mockByggId,
          area_m2: 120,
          irr_kwh_m2_yr: 950,
          kWh_tot: 114_000,
        },
        {
          tak_id: mockByggId * 10 + 2,
          bygg_id: mockByggId,
          area_m2: 60,
          irr_kwh_m2_yr: 820,
          kWh_tot: 49_200,
        },
      ];

      const mockSumPot = mockTakflater.reduce((sum, tak) => sum + tak.kWh_tot, 0);
      const mockSumArea = mockTakflater.reduce((sum, tak) => sum + tak.area_m2, 0);
      const mockAvgIrr = mockSumArea ? mockSumPot / mockSumArea : null;

      return res.json({
        reference: REF_OSLO,
        takflater: mockTakflater,
        takAreal_m2: mockSumArea,
        sol_kwh_m2_yr: mockAvgIrr,
        sol_kwh_bygg_tot: mockSumPot,
        filteredSolarEnergy: mockSumPot * SOLAR_PANEL_EFFICIENCY,
        category: mockAvgIrr ? categorize(mockAvgIrr) : "Ukjent",
      });
    }

    const cacheKey = JSON.stringify(req.query);
    const hit = CACHE.get(cacheKey);
    if (hit) return res.json(hit);

    let takflater = [];

    /* -------- Søkeprioritet ------------------------------------------------ */
    const byggNrParam = req.query.bygg_nr ?? req.query.bygningsnummer;
    const byggNr = Array.isArray(byggNrParam) ? byggNrParam[0] : byggNrParam;

    if (byggNr) {
      try {
        takflater = await takflaterForByggNr(sanitizeByggNr(byggNr));
      } catch (error) {
        errorLog('Ugyldig bygg_nr-parameter', { byggNr, error });
        return res.status(400).json({ error: 'Ugyldig bygg_nr' });
      }
    } else if (bygg_id) {
      takflater = await takflaterForByggId(sanitizeByggId(bygg_id));
    } else if (typeof polygon === "string" && polygon.trim()) {
      takflater = await takflaterForPolygon(polygon);
    } else if (gnr && bnr) {
      takflater = await takflaterForMatrikkel(
        String(gnr).padStart(5, "0"),
        String(bnr).padStart(4, "0"),
        snr
      );
    } else if (lat && lon) {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        return res.status(400).json({ error: "Ugyldige koordinater" });
      }

      const requestedDelta = delta ? Number(delta) : undefined;
      const safeDelta = clampDelta(
        Number.isFinite(requestedDelta) ? requestedDelta : DEFAULT_POINT_DELTA
      );

      const [east, north] = proj4("EPSG:4326", "EPSG:32632", [
        lonNum,
        latNum,
      ]);
      const projectedPoint = { east: Number(east), north: Number(north) };

      let lookupInfo = null;
      try {
        lookupInfo = await fetchAdridNearProjected(projectedPoint);
        infoLog("ADR-søk", lookupInfo);
      } catch (error) {
        infoLog("ADR-søk feilet, fortsetter med koordinater", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      let candidateSurfaces = [];
      if (lookupInfo?.point) {
        try {
          const { surfaces, usedDelta } = await collectTakflaterAroundPoint(
            lookupInfo.point,
            {
              baseDelta: safeDelta,
              maxDelta: MAX_POINT_DELTA,
            }
          );
          if (surfaces.length) {
            infoLog("Fant takflater via ADRID", {
              adrid: lookupInfo.adrid,
              usedDelta,
              selection: surfaces[0]?.bygg_nr ?? surfaces[0]?.bygg_id ?? "ukjent",
            });
            candidateSurfaces = surfaces;
          }
        } catch (error) {
          infoLog("ADR delta-metode feilet, prøver fallback", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!candidateSurfaces.length) {
        try {
          candidateSurfaces = await takflaterAroundProjected(
            projectedPoint,
            safeDelta
          );
        } catch (error) {
          infoLog("Direkte koordinatsøk feilet", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (
        !candidateSurfaces.length &&
        lookupInfo?.point &&
        safeDelta < MAX_POINT_DELTA
      ) {
        try {
          candidateSurfaces = await takflaterAroundProjected(
            lookupInfo.point,
            MAX_POINT_DELTA
          );
        } catch (error) {
          infoLog("Utvidet koordinatsøk feilet", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const hydrated = await hydrateBuildingSurfaces(candidateSurfaces);
      takflater = hydrated.length ? hydrated : candidateSurfaces;
    } else {
      return res.status(400).json({
        error: "Oppgi bygg_id, polygon, gnr/bnr eller lat/lon",
      });
    }

    /* -------- Ingen treff? ------------------------------------------------- */
    if (!takflater.length) {
      return res.status(404).json({ error: "Ingen takflater funnet" }); // ★
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
      .filter((tak) => (Number(tak?.irr_kwh_m2_yr) || 0) > MIN_RADIATION)
      .reduce((sum, tak) => {
        const irr = Number(tak?.irr_kwh_m2_yr) || 0;
        const area = Number(tak?.area_m2) || 0;
        return sum + irr * area * SOLAR_PANEL_EFFICIENCY;
      }, 0);

    const result = {
      reference: REF_OSLO,
      takflater,
      takAreal_m2: sumArea || null,
      sol_kwh_m2_yr: avgIrr,
      sol_kwh_bygg_tot: sumPot,
      filteredSolarEnergy,
      category: avgIrr ? categorize(avgIrr) : "Ukjent",
    };

    CACHE.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    errorLog('Feil i request handler', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───────── Start server ──────────────────────────────────────────────── */
const PORT = Number(process.env.SOLAR_SERVICE_PORT ?? process.env.PORT ?? 4003);
const HOST = process.env.SOLAR_SERVICE_HOST ?? "0.0.0.0";
app.listen(PORT, HOST, () =>
  infoLog(`Lytter på port ${HOST}:${PORT}`)
);

/* ---------------- helper for trygg BYGG_ID ----------------------------- */
function sanitizeByggId(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Ugyldig bygg_id");
  return String(n);
}

function sanitizeByggNr(v) {
  const str = String(v ?? '').trim();
  if (!/^[0-9]{5,}$/.test(str)) {
    throw new Error('Ugyldig bygg_nr');
  }
  return str;
}

// Simple Express server to expose resolveBuildingData as API
import '../loadEnv.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Storage } from '@google-cloud/storage';
import { resolveBuildingData } from '../services/building-info-service/index.js';
import { metricsRegistry } from '../services/building-info-service/metrics.js';
import { energyRatingService } from './services/energyRatingService.js';
import { execFile } from 'child_process';
import type { ExecFileOptions } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const pythonScriptsDir = path.join(process.cwd(), 'scripts', 'python');
const configDirectory = process.env.APP_CONFIG_DIR ?? path.join(process.cwd(), 'content');
const solarServiceBaseUrl = (process.env.SOLAR_SERVICE_BASE_URL ?? 'http://localhost:4003').replace(/\/$/, '');
const contentBucketName = process.env.CONTENT_BUCKET;

const storage = contentBucketName ? new Storage() : null;

const app = express();
const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);

const pythonCandidates = [
  process.env.PYTHON_BINARY,
  process.env.PYTHON_BIN,
  process.env.PYTHON_PATH,
  'python',
  'python3',
  'py'
].filter((candidate): candidate is string => Boolean(candidate));

const pythonEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PYTHONIOENCODING: 'utf-8'
};

const debugEnabled = process.env.API_DEBUG === '1';
const infoLog = (...args: unknown[]) => console.warn('[api-server]', ...args);
const debugLog = (...args: unknown[]) => {
  if (debugEnabled) {
    console.warn('[api-server:debug]', ...args);
  }
};

interface GeonorgeAddress {
  adressenavn?: string;
  nummer?: string;
  bokstav?: string | null;
  adressetekst?: string;
  postnummer?: string;
  poststed?: string;
  kommunenummer?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  adressekode?: number;
}

interface GeonorgeResponse {
  adresser?: GeonorgeAddress[];
}

let pythonDetectionPromise: Promise<string> | null = null;
let cachedPythonBinary: string | null = null;
type JsonObject = Record<string, unknown>;

type BucketJsonCacheEntry = {
  generation: string | null;
  data: JsonObject;
};

type LocalJsonCacheEntry = {
  mtime: number;
  data: JsonObject;
};

const bucketJsonCache = new Map<string, BucketJsonCacheEntry>();
const localJsonCache = new Map<string, LocalJsonCacheEntry>();

type AppConfigResponse = {
  apiBaseUrl: string;
  solarProxyBaseUrl: string;
  contentTimestamp?: string;
};

function getDefaultAppConfig(): AppConfigResponse {
  const defaultApiBase = normaliseBaseUrl(process.env.PUBLIC_API_BASE_URL ?? '/api');
  return {
    apiBaseUrl: defaultApiBase,
    solarProxyBaseUrl: normaliseBaseUrl(
      process.env.PUBLIC_SOLAR_BASE_URL ?? `${defaultApiBase}/solar`
    ),
    contentTimestamp: undefined,
  };
}

function createConfigFromSource(
  parsed: Record<string, unknown> | null,
  defaults: AppConfigResponse
): AppConfigResponse {
  const fallbackApi =
    parsed && typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl : defaults.apiBaseUrl;
  const fallbackSolar =
    parsed && typeof parsed.solarProxyBaseUrl === 'string'
      ? parsed.solarProxyBaseUrl
      : defaults.solarProxyBaseUrl;
  const timestamp =
    parsed && typeof parsed.contentTimestamp === 'string'
      ? parsed.contentTimestamp
      : defaults.contentTimestamp;

  return {
    apiBaseUrl: normaliseBaseUrl(
      (process.env.PUBLIC_API_BASE_URL as string | undefined) ?? fallbackApi
    ),
    solarProxyBaseUrl: normaliseBaseUrl(
      (process.env.PUBLIC_SOLAR_BASE_URL as string | undefined) ?? fallbackSolar
    ),
    contentTimestamp: timestamp,
  };
}

const configRootPath = path.resolve(configDirectory);

function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath) {
    return false;
  }

  const normalised = relativePath.replace(/\\/g, '/');
  if (normalised.startsWith('/')) {
    return false;
  }

  if (normalised.includes('..')) {
    return false;
  }

  return true;
}

async function loadJsonFromDisk(relativePath: string): Promise<JsonObject> {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsafe content path: ${relativePath}`);
  }

  const resolvedPath = path.resolve(configRootPath, relativePath);
  if (!resolvedPath.startsWith(configRootPath)) {
    throw new Error(`Resolved content path escapes root: ${relativePath}`);
  }

  const stat = await fs.stat(resolvedPath);
  const cached = localJsonCache.get(relativePath);
  if (cached && cached.mtime === stat.mtimeMs) {
    debugLog(`Serving cached local content: ${relativePath}`);
    return cached.data;
  }

  const raw = await fs.readFile(resolvedPath, 'utf-8');
  const parsed = JSON.parse(raw) as JsonObject;
  localJsonCache.set(relativePath, { mtime: stat.mtimeMs, data: parsed });
  debugLog(`Loaded local content file: ${relativePath}`);
  return parsed;
}

async function loadJsonFromBucket(relativePath: string): Promise<JsonObject> {
  if (!storage || !contentBucketName) {
    throw new Error('Content bucket is not configured');
  }

  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsafe bucket content path: ${relativePath}`);
  }

  const file = storage.bucket(contentBucketName).file(relativePath);
  const [metadata] = await file.getMetadata();
  const generation = metadata.generation ?? null;

  const cached = bucketJsonCache.get(relativePath);
  if (cached && cached.generation === generation) {
    debugLog(`Serving cached bucket content: ${relativePath} (generation ${generation ?? 'unknown'})`);
    return cached.data;
  }

  const [buffer] = await file.download();
  const parsed = JSON.parse(buffer.toString('utf-8')) as JsonObject;
  bucketJsonCache.set(relativePath, { generation, data: parsed });
  debugLog(`Loaded bucket content file: ${relativePath} (generation ${generation ?? 'unknown'})`);
  return parsed;
}

async function loadJsonFile(relativePath: string): Promise<JsonObject> {
  if (storage && contentBucketName) {
    try {
      return await loadJsonFromBucket(relativePath);
    } catch (error) {
      console.error(`[api-server] Failed to load ${relativePath} from bucket, falling back to disk`, error);
    }
  }

  return loadJsonFromDisk(relativePath);
}

async function loadAppConfig(): Promise<AppConfigResponse> {
  const defaults = getDefaultAppConfig();

  try {
    const parsed = await loadJsonFile('app.json');
    return createConfigFromSource(parsed, defaults);
  } catch (error) {
    console.error('[api-server] Failed to load app config, using defaults', error);
    return defaults;
  }
}

function sanitiseContentRequestPath(rawPath: string | undefined): string | null {
  if (!rawPath) {
    return null;
  }

  const normalised = rawPath.replace(/\\/g, '/');
  if (!isSafeRelativePath(normalised)) {
    return null;
  }

  if (!normalised.endsWith('.json')) {
    return null;
  }

  return normalised;
}

function normaliseBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }
  const ensuredLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return ensuredLeading.endsWith('/') ? ensuredLeading.slice(0, -1) : ensuredLeading;
}

async function detectPythonBinary(): Promise<string> {
  const attempted: string[] = [];

  for (const candidate of pythonCandidates) {
    if (attempted.includes(candidate)) {
      continue;
    }

    attempted.push(candidate);

    try {
      const { stdout, stderr } = await execFileAsync(candidate, ['--version'], { encoding: 'utf8' }) as { stdout: string; stderr: string };
      const version = (stdout || stderr || '').trim();
      infoLog(`Using ${candidate} for Python scripts${version ? ` (${version})` : ''}`);
      return candidate;
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stderr?: string };
      const stderr = typeof err.stderr === 'string' ? err.stderr.toLowerCase() : '';
      const isMissing = err.code === 'ENOENT' || err.errno === 'ENOENT' || stderr.includes('not found') || stderr.includes('not recognized');

      if (isMissing) {
        continue;
      }

      throw error;
    }
  }

  const attemptedList = attempted.length > 0 ? attempted.join(', ') : 'python, python3';
  throw new Error(`Fant ikke Python-tolk i PATH (forsøkte: ${attemptedList}). Installer Python 3 eller sett PYTHON_BINARY.`);
}

async function getPythonBinary(): Promise<string> {
  if (cachedPythonBinary) {
    return cachedPythonBinary;
  }

  if (!pythonDetectionPromise) {
    pythonDetectionPromise = detectPythonBinary()
      .then((binary) => {
        cachedPythonBinary = binary;
        return binary;
      })
      .catch((error) => {
        pythonDetectionPromise = null;
        throw error;
      });
  }

  return pythonDetectionPromise;
}

async function runPythonScript(script: string, args: string[] = [], options: ExecFileOptions = {}) {
  const pythonBinary = await getPythonBinary();
  const mergedEnv = { ...pythonEnv, ...(options.env ?? {}) };
  const execOptions: ExecFileOptions = {
    ...options,
    env: mergedEnv
  };

  const scriptPath = path.join(pythonScriptsDir, script);

  return execFileAsync(pythonBinary, [scriptPath, ...args], { ...execOptions, encoding: 'utf8' }) as Promise<{ stdout: string; stderr: string }>;
}

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

app.get('/config/app.json', async (_req, res) => {
  try {
    const cfg = await loadAppConfig();
    res.json(cfg);
  } catch (error) {
    console.error('[api-server] Failed to load app config', error);
    res.status(500).json({ error: 'Failed to load app config' });
  }
});

app.get(/^\/config\/content\/(.+)$/, async (req, res) => {
  const params = req.params as unknown as Record<number, string>;
  const requestedPath = params ? params[0] : undefined;
  const safePath = sanitiseContentRequestPath(requestedPath);

  if (!safePath) {
    res.status(400).json({ error: 'Invalid content path' });
    return;
  }

  try {
    const data = await loadJsonFile(safePath);
    res.json(data);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      res.status(404).json({ error: 'Content not found' });
    } else {
      console.error(`[api-server] Failed to load content file ${safePath}`, error);
      res.status(500).json({ error: 'Failed to load content file' });
    }
  }
});

app.get('/', (_req, res) => {
  res.json({
    status: 'Energinokkelen API',
    message: 'Backend er oppe. Bruk /health for helse, /api/* for tjenester, og frontend via CDN-url.',
  });
});

app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  } catch (error) {
    console.error('[api-server] Failed to render metrics', error);
    res.status(500).json({ error: 'Failed to render metrics' });
  }
});

async function handleSolarProxy(req: express.Request, res: express.Response): Promise<void> {
  const originalUrl = req.originalUrl ?? '';
  const queryIndex = originalUrl.indexOf('?');
  const pathWithoutQuery = queryIndex >= 0 ? originalUrl.slice(0, queryIndex) : originalUrl;
  const suffix = pathWithoutQuery.slice('/api/solar'.length);
  const normalisedSuffix = suffix ? (suffix.startsWith('/') ? suffix : `/${suffix}`) : '';
  const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
  const targetUrl = `${solarServiceBaseUrl}${normalisedSuffix}${query}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        accept: req.headers.accept ?? '*/*',
      },
    });

    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'transfer-encoding' || lowerKey === 'content-length' || lowerKey === 'connection') {
        return;
      }
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.status(response.status).send(buffer);
  } catch (error) {
    console.error('[api-server] Failed to proxy solar request', { targetUrl, error });
    res.status(502).json({ error: 'Failed to proxy solar service' });
  }
}

app.use('/api/solar', (req, res, next) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  handleSolarProxy(req, res).catch(next);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Address lookup endpoint
app.post('/api/address-lookup', async (req, res) => {
  const { address, useImprovedSelection = false, debug = false } = req.body;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ 
      error: 'Address is required and must be a string' 
    });
  }

  infoLog(`Looking up address: ${address}`);
  if (useImprovedSelection) {
    debugLog('Using improved building selection');
  }
  const startTime = Date.now();

  try {
    const result = await resolveBuildingData(address, { useImprovedSelection, debug });
    const duration = Date.now() - startTime;
    
    infoLog(`Lookup successful in ${duration}ms`);
    res.json({
      ...result,
      adresse: address,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Lookup failed after ${duration}ms:`, error);
    
    // Handle authentication errors specially
    if (error instanceof Error && error.message.includes('401')) {
      res.status(503).json({ 
        error: 'Matrikkel API authentication failed. Using test data instead.',
        address,
        testMode: true,
        _meta: {
          duration,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        address,
        _meta: {
          duration,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
});

// Address suggestions endpoint
app.get('/api/address-suggestions', async (req, res) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string' || query.length < 3) {
    return res.status(400).json({ 
      error: 'Query must be at least 3 characters long' 
    });
  }

  infoLog(`Fetching address suggestions for: ${query}`);
  const startTime = Date.now();

  try {
    // Call Geonorge API with fuzzy search
    const response = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?` +
      new URLSearchParams({ 
        sok: query, 
        fuzzy: 'true',
        kommunenummer: '0301' // Oslo kommune
      }).toString().replace(/\+/g, '%20'),
      { headers: { 'User-Agent': 'Energitiltak/1.0' } }
    );

    if (!response.ok) {
      throw new Error(`Geonorge API returned ${response.status}`);
    }

    const data = (await response.json()) as GeonorgeResponse;
    const duration = Date.now() - startTime;
    
    // Format addresses for frontend - ensure we have complete address with postal code and city
    const suggestions = data.adresser?.map((addr: GeonorgeAddress) => {
      // Build complete address string
      const streetName = addr.adressenavn ?? '';
      const houseNumber = addr.nummer ?? '';
      const streetAndNumber = `${streetName} ${houseNumber}${addr.bokstav ?? ''}`.trim();
      const postalAndCity = `${addr.postnummer || ''} ${addr.poststed || 'Oslo'}`.trim();
      
      return {
        adressetekst: addr.adressetekst || `${streetAndNumber}, ${postalAndCity}`,
        adresse: `${streetAndNumber}, ${postalAndCity}`,
        kommunenummer: addr.kommunenummer,
        gardsnummer: addr.gardsnummer,
        bruksnummer: addr.bruksnummer,
        adressekode: addr.adressekode,
        nummer: addr.nummer,
        bokstav: addr.bokstav || null,
        postnummer: addr.postnummer,
        poststed: addr.poststed || 'Oslo'
      };
    }) || [];

    infoLog(`Found ${suggestions.length} suggestions in ${duration}ms`);
    res.json({
      suggestions,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Address suggestions failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      query,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Energy rating calculation endpoint
app.post('/api/energy-rating', async (req, res) => {
  const { address, yearlyConsumption } = req.body;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ 
      error: 'Address is required and must be a string' 
    });
  }
  
  if (!yearlyConsumption || typeof yearlyConsumption !== 'number' || yearlyConsumption <= 0) {
    return res.status(400).json({ 
      error: 'Yearly consumption is required and must be a positive number' 
    });
  }

  infoLog(`Calculating energy rating for ${address}, consumption: ${yearlyConsumption} kWh/year`);
  const startTime = Date.now();

  try {
    // First, get building data to find BRA
    const buildingData = await resolveBuildingData(address, { useImprovedSelection: true });
    
    if (!buildingData || buildingData.length === 0) {
      throw new Error('No building data found for address');
    }

    // Use the first building result
    const building = buildingData[0];
    const bruksareal = building.bruksarealM2;

    if (!bruksareal || bruksareal <= 0) {
      throw new Error('Invalid or missing BRA (bruksareal) for building');
    }

    // Calculate energy rating
    const ratingResult = energyRatingService.calculateEnergyRating({
      yearlyConsumption,
      bruksareal
    });

    const duration = Date.now() - startTime;
    
    infoLog(`Energy rating calculated in ${duration}ms: ${ratingResult.rating}`);
    res.json({
      address,
      bygningsnummer: building.bygningsnummer,
      bruksareal,
      yearlyConsumption,
      ...ratingResult,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Energy rating calculation failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      address,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Støtteordninger endpoint - kjører Python script direkte
app.get('/api/stotteordninger', async (req, res) => {
  const { gulliste, tiltak, bygningstype } = req.query;
  
  if (!tiltak || !bygningstype) {
    return res.status(400).json({ 
      error: 'Missing required parameters: tiltak and bygningstype' 
    });
  }

  const gullisteParam = gulliste === 'true' ? 'true' : 'false';
  
  infoLog(`Fetching støtteordninger: gulliste=${gullisteParam}, tiltak=${tiltak}, bygningstype=${bygningstype}`);
  const startTime = Date.now();

  try {
    const tiltakParam = String(tiltak);
    const bygningstypeParam = String(bygningstype);

    const { stdout, stderr } = await runPythonScript(
      'hent_stotteordninger_api_google.py',
      [gullisteParam, tiltakParam, bygningstypeParam]
    );
    
    if (stderr) {
      console.error('[API Server] Python stderr:', stderr);
    }
    
    // Parse JSON output
    const data = JSON.parse(stdout);
    const duration = Date.now() - startTime;
    
    infoLog(`Found ${Array.isArray(data) ? data.length : 0} støtteordninger in ${duration}ms`);
    res.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Støtteordninger fetch failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Get støtteordninger directly from Excel
app.get('/api/stotteordninger-live', async (req, res) => {
  const { gulliste, tiltak, bygningstype } = req.query;
  
  if (!tiltak || !bygningstype) {
    return res.status(400).json({ 
      error: 'Mangler påkrevde parametre: tiltak og bygningstype' 
    });
  }
  
  infoLog(`Henter støtteordninger direkte fra Excel: gulliste=${gulliste}, tiltak=${tiltak}, bygningstype=${bygningstype}`);
  const startTime = Date.now();
  
  try {
    const tiltakParam = String(tiltak);
    const bygningstypeParam = String(bygningstype);
    const gullisteParam = (gulliste ?? 'false').toString();

    const { stdout, stderr } = await runPythonScript(
      'hent_stotteordninger_direkte_google.py',
      [gullisteParam, tiltakParam, bygningstypeParam]
    );
    
    if (stderr) {
      console.error('[API Server] Python stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    const duration = Date.now() - startTime;
    
    infoLog(`Hentet støtteordninger direkte i ${duration}ms`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Direkte henting feilet etter ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Update støtteordninger cache endpoint
app.post('/api/update-stotteordninger', async (req, res) => {
  infoLog('Updating støtteordninger cache...');
  const startTime = Date.now();
  
  try {
    // Run the Python script to update cache
    const { stdout, stderr } = await runPythonScript('stotteordning_cache.py');
    
    if (stderr) {
      console.error('[API Server] Python stderr:', stderr);
    }
    
    const duration = Date.now() - startTime;
    infoLog(`Støtteordninger cache updated in ${duration}ms`);
    
    res.json({
      success: true,
      message: 'Støtteordninger cache updated successfully',
      output: stdout,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Cache update failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  infoLog(`Running on http://localhost:${PORT}`);
  infoLog(`Environment: ${process.env.LIVE ? 'LIVE (real APIs)' : 'MOCK'}`);
  debugLog(`Try: POST http://localhost:${PORT}/api/address-lookup`);
  debugLog(`Try: GET http://localhost:${PORT}/api/address-suggestions?query=karl`);
  debugLog(`Try: POST http://localhost:${PORT}/api/energy-rating`);
});

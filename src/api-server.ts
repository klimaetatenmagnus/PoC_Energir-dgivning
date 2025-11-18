// Simple Express server to expose resolveBuildingData as API
import '../loadEnv.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { resolveBuildingData } from '../services/building-info-service/index.js';
import { metricsRegistry } from '../services/building-info-service/metrics.js';
import { energyRatingService } from './services/energyRatingService.js';
import { execFile } from 'child_process';
import type { ExecFileOptions } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { TiltakContentSchema, type TiltakContent, type TiltakBenefit } from '../content/tiltak/schema';
import { TilskuddContentSchema, type TilskuddContent } from '../content/tilskudd/schema';
import {
  ContentDictionarySchema,
  type ContentDictionary
} from '../content/dictionaries/schema';
import type {
  ContentCatalogItem,
  ContentCatalogResponse,
  ContentCollection,
  TiltakCatalogItem,
  TilskuddCatalogItem
} from './types/contentCatalog';
import type { ContentStatus } from '../content/schema-helpers';

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
  etag: string | null;
  data: JsonObject;
};

type LocalJsonCacheEntry = {
  mtime: number;
  size: number;
  etag: string | null;
  data: JsonObject;
};

type LoadedJsonFile = {
  data: JsonObject;
  etag: string | null;
};

const bucketJsonCache = new Map<string, BucketJsonCacheEntry>();
const localJsonCache = new Map<string, LocalJsonCacheEntry>();

type ValidatedTiltakDocument = {
  kind: 'validated';
  collection: 'tiltak';
  data: TiltakContent;
  etag: string | null;
};

type ValidatedTilskuddDocument = {
  kind: 'validated';
  collection: 'tilskudd';
  data: TilskuddContent;
  etag: string | null;
};

type LegacyContentDocument = {
  kind: 'legacy';
  collection: ContentCollection;
  data: JsonObject;
  etag: string | null;
};

type GenericContentDocument = {
  kind: 'generic';
  collection: null;
  data: JsonObject;
  etag: string | null;
};

type LoadedContentDocument =
  | ValidatedTiltakDocument
  | ValidatedTilskuddDocument
  | LegacyContentDocument
  | GenericContentDocument;

type ValidatedContentDocument = Extract<LoadedContentDocument, { kind: 'validated' }>;

type ContentCollectionConfig =
  | {
      collection: 'tiltak';
      schema: typeof TiltakContentSchema;
    }
  | {
      collection: 'tilskudd';
      schema: typeof TilskuddContentSchema;
    };

const contentCollectionConfigs: Record<ContentCollection, ContentCollectionConfig> = {
  tiltak: { collection: 'tiltak', schema: TiltakContentSchema },
  tilskudd: { collection: 'tilskudd', schema: TilskuddContentSchema }
};

const legacyContentWarnings = new Set<string>();

function buildEtagHeaderValue(tag: string | null): string | undefined {
  if (!tag) {
    return undefined;
  }
  return `"${tag}"`;
}

function parseIfNoneMatchHeader(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const tokens: string[] = [];

  for (const raw of rawValues) {
    const parts = raw.split(',');
    for (const part of parts) {
      let token = part.trim();
      if (!token) {
        continue;
      }
      if (token === '*') {
        tokens.push('*');
        continue;
      }
      if (token.startsWith('W/')) {
        token = token.slice(2).trim();
      }
      if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
        token = token.slice(1, -1);
      }
      tokens.push(token);
    }
  }

  return tokens;
}

function ifNoneMatchMatches(
  headerValue: string | string[] | undefined,
  tag: string | null
): boolean {
  if (!tag) {
    return false;
  }

  const tokens = parseIfNoneMatchHeader(headerValue);
  if (tokens.includes('*')) {
    return true;
  }

  return tokens.some((candidate) => candidate === tag);
}

class ContentValidationError extends Error {
  constructor(
    public readonly relativePath: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(`Content validation failed for ${relativePath}`);
    this.name = 'ContentValidationError';
  }
}

class ContentAccessError extends Error {
  constructor(
    public readonly relativePath: string,
    public readonly status: ContentStatus
  ) {
    super(`Content ${relativePath} is not accessible (status=${status})`);
    this.name = 'ContentAccessError';
  }
}

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
type FileStatSummary = { mtimeMs: number; size: number };

function createDiskEtag(stat: FileStatSummary): string {
  return `disk:${stat.mtimeMs}:${stat.size}`;
}

function deriveBucketEtag(metadata: { etag?: string; generation?: string | null }): string | null {
  if (metadata && typeof metadata.etag === 'string' && metadata.etag.length > 0) {
    return `gcs:${metadata.etag}`;
  }

  if (metadata && typeof metadata.generation === 'string' && metadata.generation.length > 0) {
    return `gcs:${metadata.generation}`;
  }

  if (metadata && metadata.generation && typeof metadata.generation !== 'string') {
    return `gcs:${String(metadata.generation)}`;
  }

  return null;
}

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

async function loadJsonFromDisk(relativePath: string): Promise<LoadedJsonFile> {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsafe content path: ${relativePath}`);
  }

  const resolvedPath = path.resolve(configRootPath, relativePath);
  if (!resolvedPath.startsWith(configRootPath)) {
    throw new Error(`Resolved content path escapes root: ${relativePath}`);
  }

  const stat = await fs.stat(resolvedPath);
  const cached = localJsonCache.get(relativePath);
  if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size) {
    debugLog(`Serving cached local content: ${relativePath}`);
    return { data: cached.data, etag: cached.etag };
  }

  const raw = await fs.readFile(resolvedPath, 'utf-8');
  const parsed = JSON.parse(raw) as JsonObject;
  const etag = createDiskEtag(stat);
  localJsonCache.set(relativePath, { mtime: stat.mtimeMs, size: stat.size, etag, data: parsed });
  debugLog(`Loaded local content file: ${relativePath}`);
  return { data: parsed, etag };
}

async function loadJsonFromBucket(relativePath: string): Promise<LoadedJsonFile> {
  if (!storage || !contentBucketName) {
    throw new Error('Content bucket is not configured');
  }

  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsafe bucket content path: ${relativePath}`);
  }

  const file = storage.bucket(contentBucketName).file(relativePath);
  const [metadata] = await file.getMetadata();
  const generation = metadata.generation ?? null;
  const etag = deriveBucketEtag(metadata);

  const cached = bucketJsonCache.get(relativePath);
  if (cached && cached.generation === generation) {
    debugLog(`Serving cached bucket content: ${relativePath} (generation ${generation ?? 'unknown'})`);
    return { data: cached.data, etag: cached.etag };
  }

  const [buffer] = await file.download();
  const parsed = JSON.parse(buffer.toString('utf-8')) as JsonObject;
  bucketJsonCache.set(relativePath, { generation, etag, data: parsed });
  debugLog(`Loaded bucket content file: ${relativePath} (generation ${generation ?? 'unknown'})`);
  return { data: parsed, etag };
}

async function loadJsonFile(relativePath: string): Promise<LoadedJsonFile> {
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
    const { data: parsed } = await loadJsonFile('app.json');
    return createConfigFromSource(parsed, defaults);
  } catch (error) {
    console.error('[api-server] Failed to load app config, using defaults', error);
    return defaults;
  }
}

async function loadContentDictionary(): Promise<{ data: ContentDictionary; etag: string | null }> {
  const { data, etag } = await loadJsonFile('dictionaries/index.json');
  const parsed = ContentDictionarySchema.parse(data);
  return { data: parsed, etag };
}

function buildBenefitDictionaryMap(dictionary: ContentDictionary): Map<string, TiltakBenefit> {
  const map = new Map<string, TiltakBenefit>();
  for (const entry of dictionary.benefits) {
    map.set(entry.id, {
      id: entry.id,
      title: entry.title,
      description: entry.description,
      icon: entry.icon
    });
  }
  return map;
}

function resolveBenefitsFromRefs(
  refs: string[],
  fallback: TiltakBenefit[],
  dictionary: Map<string, TiltakBenefit>,
  context: string
): TiltakBenefit[] {
  if (!refs?.length) {
    return Array.isArray(fallback) ? fallback : [];
  }

  const resolved: TiltakBenefit[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    if (!ref || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    const entry = dictionary.get(ref);
    if (!entry) {
      console.warn(`[api-server] Unknown benefit ref "${ref}" in ${context}`);
      continue;
    }
    resolved.push(entry);
  }

  return resolved;
}

async function resolveTiltakBenefits(content: TiltakContent): Promise<TiltakContent> {
  const hasGlobalRefs =
    (content.benefitRefs?.length ?? 0) > 0 ||
    content.variants.some((variant) => (variant.benefitRefs?.length ?? 0) > 0);

  if (!hasGlobalRefs) {
    return content;
  }

  const { data: dictionary } = await loadContentDictionary();
  const benefitMap = buildBenefitDictionaryMap(dictionary);

  const resolved: TiltakContent = {
    ...content,
    benefits: resolveBenefitsFromRefs(
      content.benefitRefs ?? [],
      content.benefits,
      benefitMap,
      `tiltak:${content.id}`
    ),
    variants: content.variants.map((variant) => ({
      ...variant,
      benefits: resolveBenefitsFromRefs(
        variant.benefitRefs ?? [],
        variant.benefits ?? [],
        benefitMap,
        `tiltak:${content.id}:variant:${variant.audience}`
      )
    }))
  };

  return resolved;
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

function detectContentCollection(relativePath: string): ContentCollection | null {
  if (relativePath.startsWith('tiltak/')) {
    return 'tiltak';
  }
  if (relativePath.startsWith('tilskudd/')) {
    return 'tilskudd';
  }
  return null;
}

function logLegacyContentWarning(relativePath: string, reason: string): void {
  if (legacyContentWarnings.has(relativePath)) {
    return;
  }
  legacyContentWarnings.add(relativePath);
  console.warn(`[api-server] Legacy content ${relativePath}: ${reason}`);
}

function parseDraftQueryParam(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => parseDraftQueryParam(entry));
  }

  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    return normalised === '1' || normalised === 'true' || normalised === 'yes';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value && typeof value === 'object' && 'draft' in (value as Record<string, unknown>)) {
    return parseDraftQueryParam((value as Record<string, unknown>).draft);
  }

  return false;
}

async function listLocalContentFiles(collection: ContentCollection): Promise<string[]> {
  const results: string[] = [];
  async function walk(relativeDir: string): Promise<void> {
    const absoluteDir = path.resolve(configRootPath, relativeDir);
    let entries: Dirent[];
    try {
      entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const entryRelativePath = path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name);
      if (entry.isDirectory()) {
        await walk(entryRelativePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(entryRelativePath);
      }
    }
  }

  await walk(collection);

  return results
    .filter((filePath) => !filePath.endsWith('/index.json'))
    .sort((a, b) => a.localeCompare(b));
}

async function listBucketContentFiles(collection: ContentCollection): Promise<string[]> {
  if (!storage || !contentBucketName) {
    return [];
  }

  const prefix = `${collection}/`;
  const [files] = await storage.bucket(contentBucketName).getFiles({
    prefix,
    autoPaginate: true
  });

  return files
    .map((file) => file.name)
    .filter((name): name is string => typeof name === 'string' && name.startsWith(prefix))
    .filter((name) => name.endsWith('.json') && !name.endsWith('/index.json'))
    .sort((a, b) => a.localeCompare(b));
}

async function listContentFiles(collection: ContentCollection): Promise<string[]> {
  if (storage && contentBucketName) {
    return listBucketContentFiles(collection);
  }
  return listLocalContentFiles(collection);
}

async function loadContentDocument(
  relativePath: string,
  options: { includeDrafts?: boolean } = {}
): Promise<LoadedContentDocument> {
  const { data, etag } = await loadJsonFile(relativePath);
  const collection = detectContentCollection(relativePath);
  if (!collection) {
    return { kind: 'generic', collection: null, data, etag };
  }

  if (typeof (data as { schemaVersion?: unknown }).schemaVersion !== 'number') {
    logLegacyContentWarning(relativePath, 'missing schemaVersion – skipping validation');
    return { kind: 'legacy', collection, data, etag };
  }

  const config = contentCollectionConfigs[collection];
  const parsed = config.schema.safeParse(data);
  if (!parsed.success) {
    console.error(
      `[api-server] Validation failed for ${relativePath}`,
      parsed.error.flatten()
    );
    throw new ContentValidationError(relativePath, parsed.error.issues);
  }

  const includeDrafts = Boolean(options.includeDrafts);
  const status = parsed.data.metadata.status;
  if (!includeDrafts && status !== 'published') {
    console.warn(
      `[api-server] Blocked ${relativePath} because status=${status} (draft access disabled)`
    );
    throw new ContentAccessError(relativePath, status);
  }

  let resolvedData = parsed.data;
  if (collection === 'tiltak') {
    resolvedData = await resolveTiltakBenefits(parsed.data);
  }

  return { kind: 'validated', collection, data: resolvedData, etag } as ValidatedContentDocument;
}

function createTiltakCatalogItem(
  relativePath: string,
  document: TiltakContent
): TiltakCatalogItem {
  return {
    type: 'tiltak',
    id: document.id,
    title: document.title,
    summary: document.summary,
    status: document.metadata.status,
    updatedAt: document.metadata.updatedAt,
    updatedBy: document.metadata.updatedBy,
    audiences: document.audiences,
    schemaVersion: document.schemaVersion,
    path: relativePath,
    grants: document.grants,
    supportTags: document.supportTags,
    buildingTypes: Object.keys(document.buildingTypeParagraphs),
    variantAudiences: document.variants.map((variant) => variant.audience)
  };
}

function createTilskuddCatalogItem(
  relativePath: string,
  document: TilskuddContent
): TilskuddCatalogItem {
  return {
    type: 'tilskudd',
    id: document.id,
    title: document.title,
    summary: document.summary,
    status: document.metadata.status,
    updatedAt: document.metadata.updatedAt,
    updatedBy: document.metadata.updatedBy,
    audiences: document.audiences,
    schemaVersion: document.schemaVersion,
    path: relativePath,
    buildingTypes: document.buildingTypes,
    appliesToTiltak: document.appliesToTiltak,
    tags: document.tags,
    validFrom: document.metadata.validFrom,
    validTo: document.metadata.validTo
  };
}

async function buildContentCatalog(
  collection: ContentCollection,
  options: { includeDrafts?: boolean } = {}
): Promise<ContentCatalogResponse> {
  const files = await listContentFiles(collection);
  const items: ContentCatalogItem[] = [];
  let skippedLegacy = 0;
  let skippedUnpublished = 0;
  let skippedInvalid = 0;

  for (const relativePath of files) {
    try {
      const document = await loadContentDocument(relativePath, options);
      if (document.kind !== 'validated') {
        skippedLegacy += 1;
        continue;
      }

      if (document.collection === 'tiltak') {
        items.push(createTiltakCatalogItem(relativePath, document.data));
      } else if (document.collection === 'tilskudd') {
        items.push(createTilskuddCatalogItem(relativePath, document.data));
      }
    } catch (error) {
      if (error instanceof ContentAccessError) {
        skippedUnpublished += 1;
        continue;
      }
      if (error instanceof ContentValidationError) {
        skippedInvalid += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    collection,
    generatedAt: new Date().toISOString(),
    includeDrafts: Boolean(options.includeDrafts),
    total: items.length,
    items,
    skippedLegacy,
    skippedUnpublished,
    skippedInvalid
  };
}

function computeCatalogEtag(catalog: ContentCatalogResponse): string | null {
  try {
    const { generatedAt: _generatedAt, ...snapshot } = catalog;
    const payload = JSON.stringify(snapshot);
    const digest = createHash('sha1').update(payload).digest('hex');
    return `catalog:${digest}`;
  } catch (error) {
    console.error('[api-server] Failed to compute catalog etag', error);
    return null;
  }
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

app.get('/config/dictionaries/index.json', async (req, res) => {
  try {
    const { data, etag } = await loadContentDictionary();
    if (etag && ifNoneMatchMatches(req.headers['if-none-match'], etag)) {
      const etagHeader = buildEtagHeaderValue(etag);
      if (etagHeader) {
        res.setHeader('ETag', etagHeader);
      }
      res.status(304).end();
      return;
    }

    const etagHeader = buildEtagHeaderValue(etag);
    if (etagHeader) {
      res.setHeader('ETag', etagHeader);
    }

    res.json(data);
  } catch (error) {
    console.error('[api-server] Failed to load content dictionary', error);
    res.status(500).json({ error: 'Failed to load content dictionary' });
  }
});

app.get('/config/content/:collection/index.json', async (req, res) => {
  const collectionParam = req.params.collection;
  if (collectionParam !== 'tiltak' && collectionParam !== 'tilskudd') {
    res.status(404).json({ error: 'Unknown content collection' });
    return;
  }

  const collection = collectionParam as ContentCollection;
  const includeDrafts = parseDraftQueryParam(req.query?.draft);
  try {
    const catalog = await buildContentCatalog(collection, { includeDrafts });
    const etag = computeCatalogEtag(catalog);
    if (etag && ifNoneMatchMatches(req.headers['if-none-match'], etag)) {
      const etagHeader = buildEtagHeaderValue(etag);
      if (etagHeader) {
        res.setHeader('ETag', etagHeader);
      }
      res.status(304).end();
      return;
    }

    const etagHeader = buildEtagHeaderValue(etag);
    if (etagHeader) {
      res.setHeader('ETag', etagHeader);
    }
    res.json(catalog);
  } catch (error) {
    console.error('[api-server] Failed to build content catalog', error);
    res.status(500).json({ error: 'Failed to build content catalog' });
  }
});

app.get(/^\/config\/content\/(.+)$/, async (req, res) => {
  const params = req.params as unknown as Record<number, string>;
  const requestedPath = params ? params[0] : undefined;
  const safePath = sanitiseContentRequestPath(requestedPath);
  const includeDrafts = parseDraftQueryParam(req.query?.draft);

  if (!safePath) {
    res.status(400).json({ error: 'Invalid content path' });
    return;
  }

  try {
    const document = await loadContentDocument(safePath, { includeDrafts });
    if (document.etag && ifNoneMatchMatches(req.headers['if-none-match'], document.etag)) {
      const etagHeader = buildEtagHeaderValue(document.etag);
      if (etagHeader) {
        res.setHeader('ETag', etagHeader);
      }
      res.status(304).end();
      return;
    }

    const etagHeader = buildEtagHeaderValue(document.etag);
    if (etagHeader) {
      res.setHeader('ETag', etagHeader);
    }
    res.json(document.data);
  } catch (error) {
    if (error instanceof ContentAccessError) {
      const statusCode = error.status === 'archived' ? 410 : 404;
      res.status(statusCode).json({
        error: 'content_not_available',
        status: error.status,
        path: safePath
      });
      return;
    }

    if (error instanceof ContentValidationError) {
      res.status(422).json({
        error: 'invalid_content',
        path: safePath,
        issues: error.issues
      });
      return;
    }

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

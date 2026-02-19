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
import { csvService } from './services/csvService.js';
import { energyRatingService } from './services/energyRatingService.js';
import { sjekkGulListe, sjekkGulListeMedGnrBnr } from './services/gul-liste-service.js';
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
import { createLogger } from './utils/logger.js';

const configDirectory = process.env.APP_CONFIG_DIR ?? path.join(process.cwd(), 'content');
const solarServiceBaseUrl = (process.env.SOLAR_SERVICE_BASE_URL ?? 'http://localhost:4003').replace(/\/$/, '');
const contentBucketName = process.env.CONTENT_BUCKET;
// GCS bucket prefix - filer lagres under content/ i bøtten (f.eks. gs://bucket/content/tiltak/foo.json)
const contentBucketPrefix = process.env.CONTENT_BUCKET_PREFIX ?? 'content';

const storage = contentBucketName ? new Storage() : null;

const app = express();
const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);

const logger = createLogger({
  prefix: 'api-server',
  debugEnvVar: 'API_DEBUG',
});
const infoLog = logger.info;
const debugLog = logger.debug;

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

  // Legg til content/ prefix for å matche GCS-strukturen fra content:publish
  const bucketPath = contentBucketPrefix
    ? `${contentBucketPrefix}/${relativePath}`
    : relativePath;
  const file = storage.bucket(contentBucketName).file(bucketPath);
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
      logger.error(`Failed to load ${relativePath} from bucket, falling back to disk`, error);
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
    logger.error('Failed to load app config, using defaults', error);
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
      logger.warn(`Unknown benefit ref "${ref}" in ${context}`);
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
  logger.warn(`Legacy content ${relativePath}: ${reason}`);
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

  const allFiles = results
    .filter((filePath) => !filePath.endsWith('/index.json'))
    .sort((a, b) => a.localeCompare(b));

  // Filtrer ut draft-filer, men behold referanse til hvilke hovedfiler som finnes
  const mainFiles = allFiles.filter((f) => !f.endsWith('.draft.json'));
  return mainFiles;
}

async function listBucketContentFiles(
  collection: ContentCollection,
  options: { includeDrafts?: boolean } = {}
): Promise<string[]> {
  if (!storage || !contentBucketName) {
    return [];
  }

  // Bruk content/ prefix for å matche GCS-strukturen fra content:publish
  const bucketPrefix = contentBucketPrefix
    ? `${contentBucketPrefix}/${collection}/`
    : `${collection}/`;
  const [files] = await storage.bucket(contentBucketName).getFiles({
    prefix: bucketPrefix,
    autoPaginate: true
  });

  // Fjern bucket prefix fra filnavnene for å returnere relative stier
  const prefixToStrip = contentBucketPrefix ? `${contentBucketPrefix}/` : '';
  const allFiles = files
    .map((file) => file.name)
    .filter((name): name is string => typeof name === 'string' && name.startsWith(bucketPrefix))
    .map((name) => prefixToStrip ? name.slice(prefixToStrip.length) : name)
    .filter((name) => name.endsWith('.json') && !name.endsWith('/index.json'))
    .sort((a, b) => a.localeCompare(b));

  // Skill ut hovedfiler og draft-filer
  const mainFiles = allFiles.filter((f) => !f.endsWith('.draft.json'));
  const draftFiles = allFiles.filter((f) => f.endsWith('.draft.json'));

  if (!options.includeDrafts) {
    return mainFiles;
  }

  // Finn draft-only filer (drafts som ikke har tilhørende hovedfil)
  const mainFileSet = new Set(mainFiles);
  const draftOnlyFiles: string[] = [];

  for (const draftPath of draftFiles) {
    // Konverter draft-sti til hovedfil-sti for å sjekke om den finnes
    const mainPath = draftPath.replace(/\.draft\.json$/, '.json');
    if (!mainFileSet.has(mainPath)) {
      // Dette er en draft-only fil - legg til hovedfil-stien (vil bli lastet som draft via loadContentDocument)
      draftOnlyFiles.push(mainPath);
    }
  }

  // Returner alle hovedfiler + draft-only filer (representert som hovedfil-stier)
  return [...mainFiles, ...draftOnlyFiles].sort((a, b) => a.localeCompare(b));
}

async function listContentFiles(
  collection: ContentCollection,
  options: { includeDrafts?: boolean } = {}
): Promise<string[]> {
  if (storage && contentBucketName) {
    return listBucketContentFiles(collection, options);
  }
  return listLocalContentFiles(collection);
}

/**
 * Bygger sti til draft-fil basert på hovedfilens sti
 * tiltak/foo.json -> tiltak/foo.draft.json
 */
function buildDraftPath(relativePath: string): string | null {
  if (!relativePath.endsWith('.json')) {
    return null;
  }
  return relativePath.replace(/\.json$/, '.draft.json');
}

async function loadContentDocument(
  relativePath: string,
  options: { includeDrafts?: boolean } = {}
): Promise<LoadedContentDocument> {
  const includeDrafts = Boolean(options.includeDrafts);

  // Hvis draft-modus er aktivert, sjekk om det finnes en draft-fil
  if (includeDrafts) {
    const draftPath = buildDraftPath(relativePath);
    if (draftPath) {
      try {
        // Prøv å laste draft-filen først
        const draftResult = await loadJsonFile(draftPath);
        debugLog(`Loaded draft file: ${draftPath}`);
        // Fortsett med draft-data
        const { data, etag } = draftResult;
        return processLoadedContent(draftPath, data, etag, { includeDrafts: true });
      } catch {
        // Draft-fil eksisterer ikke, fall tilbake til hovedfilen
        debugLog(`No draft file found at ${draftPath}, using main file`);
      }
    }
  }

  // Prøv å laste hovedfilen
  try {
    const { data, etag } = await loadJsonFile(relativePath);
    return processLoadedContent(relativePath, data, etag, options);
  } catch (mainError) {
    // Hvis hovedfilen ikke finnes og vi er i draft-modus, er dette en draft-only fil
    // som vi allerede har prøvd å laste ovenfor
    if (includeDrafts) {
      const draftPath = buildDraftPath(relativePath);
      debugLog(`Main file ${relativePath} not found, and draft was already attempted`);
      throw new Error(`Content not found: ${relativePath} (draft path: ${draftPath})`);
    }
    throw mainError;
  }
}

function processLoadedContent(
  relativePath: string,
  data: JsonObject,
  etag: string | null,
  options: { includeDrafts?: boolean } = {}
): LoadedContentDocument | Promise<LoadedContentDocument> {
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
    logger.error(
      `Validation failed for ${relativePath}`,
      parsed.error.flatten()
    );
    throw new ContentValidationError(relativePath, parsed.error.issues);
  }

  const includeDrafts = Boolean(options.includeDrafts);
  const status = parsed.data.metadata.status;
  if (!includeDrafts && status !== 'published') {
    logger.warn(
      `Blocked ${relativePath} because status=${status} (draft access disabled)`
    );
    throw new ContentAccessError(relativePath, status);
  }

  if (collection === 'tiltak') {
    return resolveTiltakBenefits(parsed.data as TiltakContent).then((resolvedData) => ({
      kind: 'validated',
      collection: 'tiltak',
      data: resolvedData,
      etag
    } as ValidatedTiltakDocument));
  }

  return { kind: 'validated', collection, data: parsed.data, etag } as ValidatedContentDocument;
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
    variantAudiences: document.variants.map((variant) => variant.audience),
    // Synlighet-filtrering
    visibleForBuildingTypes: document.visibleForBuildingTypes ?? [],
    minBuildingYear: document.minBuildingYear
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
  const files = await listContentFiles(collection, options);
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

      // Hopp over slettede elementer - de skal ikke vises i katalogen
      if (document.data.metadata.status === 'deleted') {
        skippedUnpublished += 1;
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
    logger.error('Failed to compute catalog etag', error);
    return null;
  }
}


// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Hindre CDN fra å cache API-responser (inkl. negativ caching av feilresponser)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/config/app.json', async (_req, res) => {
  try {
    const cfg = await loadAppConfig();
    res.json(cfg);
  } catch (error) {
    logger.error('Failed to load app config', error);
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
    logger.error('Failed to load content dictionary', error);
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
    logger.error('Failed to build content catalog', error);
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
      logger.error(`Failed to load content file ${safePath}`, error);
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
    logger.error('Failed to render metrics', error);
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
    logger.error('Failed to proxy solar request', { targetUrl, error });
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
  const body = req.body ?? {};
  const { address, useImprovedSelection = false, debug = false } = body;

  if (!address || typeof address !== 'string') {
    logger.warn('address-lookup: ugyldig request', {
      hasBody: req.body !== undefined,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.headers['content-type'],
      origin: req.headers['origin'] ?? req.headers['referer'] ?? 'unknown',
    });
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
    logger.error(`Lookup failed after ${duration}ms:`, error);
    
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
      // Geonorge kan returnere adressenavn med liten forbokstav (f.eks. "fallanveien"),
      // så vi sikrer stor forbokstav.
      const rawStreetName = addr.adressenavn ?? '';
      const streetName = rawStreetName.length > 0
        ? rawStreetName[0].toUpperCase() + rawStreetName.slice(1)
        : '';
      const houseNumber = addr.nummer ?? '';
      const streetAndNumber = `${streetName} ${houseNumber}${addr.bokstav ?? ''}`.trim();
      const postalAndCity = `${addr.postnummer || ''} ${addr.poststed || 'Oslo'}`.trim();

      // Sikre stor forbokstav også i adressetekst fra Geonorge
      const rawAdressetekst = addr.adressetekst || `${streetAndNumber}, ${postalAndCity}`;
      const adressetekst = rawAdressetekst.length > 0
        ? rawAdressetekst[0].toUpperCase() + rawAdressetekst.slice(1)
        : rawAdressetekst;

      return {
        adressetekst,
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
    logger.error(`Address suggestions failed after ${duration}ms:`, error);
    
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
    logger.error(`Energy rating calculation failed after ${duration}ms:`, error);
    
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

// Gul liste endpoints
app.post('/api/gul-liste/sjekk-adresse', async (req, res) => {
  const { adresse } = req.body;

  if (!adresse || typeof adresse !== 'string') {
    return res.status(400).json({
      error: 'Adresse må oppgis',
      erPaaGulListe: false
    });
  }

  infoLog(`Sjekker gul liste for adresse: ${adresse}`);
  const startTime = Date.now();

  try {
    const resultat = await sjekkGulListe(adresse);
    const duration = Date.now() - startTime;

    infoLog(`Gul liste-sjekk fullført i ${duration}ms: ${resultat.erPaaGulListe ? 'PÅ GUL LISTE' : 'ikke på gul liste'}`);
    res.json(resultat);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Gul liste-sjekk feilet etter ${duration}ms:`, error);

    res.status(500).json({
      error: 'Feil ved sjekk av gul liste',
      erPaaGulListe: false
    });
  }
});

app.post('/api/gul-liste/sjekk-gnr-bnr', async (req, res) => {
  const { gnr, bnr } = req.body;

  if (gnr === undefined || gnr === null || bnr === undefined || bnr === null) {
    return res.status(400).json({
      error: 'GNR og BNR må oppgis',
      erPaaGulListe: false
    });
  }

  const gnrNum = typeof gnr === 'number' ? gnr : parseInt(gnr, 10);
  const bnrNum = typeof bnr === 'number' ? bnr : parseInt(bnr, 10);

  if (isNaN(gnrNum) || isNaN(bnrNum)) {
    return res.status(400).json({
      error: 'GNR og BNR må være tall',
      erPaaGulListe: false
    });
  }

  infoLog(`Sjekker gul liste for GNR ${gnrNum}, BNR ${bnrNum}`);
  const startTime = Date.now();

  try {
    const resultat = await sjekkGulListeMedGnrBnr(gnrNum, bnrNum);
    const duration = Date.now() - startTime;

    infoLog(`Gul liste-sjekk fullført i ${duration}ms: ${resultat.erPaaGulListe ? 'PÅ GUL LISTE' : 'ikke på gul liste'}`);
    res.json(resultat);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Gul liste-sjekk feilet etter ${duration}ms:`, error);

    res.status(500).json({
      error: 'Feil ved sjekk av gul liste',
      erPaaGulListe: false
    });
  }
});

// Catch-all: logg requests som ikke matcher noen rute (diagnostikk for 404-feil)
app.use('/api', (req, res) => {
  logger.warn('Unmatched API route (404)', {
    method: req.method,
    url: req.originalUrl,
    origin: req.headers['origin'] ?? req.headers['referer'] ?? 'unknown',
    userAgent: req.headers['user-agent']?.slice(0, 100),
  });
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Start server – vent på at CSV-data er lastet før vi aksepterer requests,
// ellers kan oppslag mangle CSV-data og returnere feil bygningsinfo.
csvService.waitForReady().then(() => {
  app.listen(PORT, () => {
    infoLog(`Running on http://localhost:${PORT}`);
    infoLog(`Environment: ${process.env.LIVE ? 'LIVE (real APIs)' : 'MOCK'}`);
    debugLog(`Try: POST http://localhost:${PORT}/api/address-lookup`);
    debugLog(`Try: GET http://localhost:${PORT}/api/address-suggestions?query=karl`);
    debugLog(`Try: POST http://localhost:${PORT}/api/energy-rating`);
    debugLog(`Try: POST http://localhost:${PORT}/api/gul-liste/sjekk-adresse`);
    debugLog(`Try: POST http://localhost:${PORT}/api/gul-liste/sjekk-gnr-bnr`);
  });
});

import { Storage } from "@google-cloud/storage";
import fs from "node:fs/promises";
import path from "node:path";
import type { SaveOptions } from "@google-cloud/storage";
import { HttpError } from "./httpError.js";

type ContentBackend =
  | { kind: "gcs"; bucket: string; prefix: string }
  | { kind: "local"; root: string };
type GcsBackend = Extract<ContentBackend, { kind: "gcs" }>;
type LocalBackend = Extract<ContentBackend, { kind: "local" }>;

type WriteOptions = {
  expectedGeneration?: string | null;
};

export type StoredJson<T = unknown> = {
  data: T;
  generation: string | null;
  etag: string | null;
  path: string;
};

const storage = new Storage();

export class ContentStorage {
  private readonly backend: ContentBackend;

  constructor(uri: string) {
    this.backend = parseContentTarget(uri);
  }

  async readJson<T = unknown>(relativePath: string): Promise<StoredJson<T>> {
    const safePath = ensureSafeRelativePath(relativePath);

    if (this.backend.kind === "gcs") {
      return this.readFromBucket<T>(this.backend, safePath);
    }

    return this.readFromDisk<T>(this.backend, safePath);
  }

  async writeJson(
    relativePath: string,
    data: unknown,
    options: WriteOptions = {}
  ): Promise<{ generation: string | null; etag: string | null; path: string }> {
    const safePath = ensureSafeRelativePath(relativePath);

    if (this.backend.kind === "gcs") {
      return this.writeToBucket(this.backend, safePath, data, options);
    }

    return this.writeToDisk(this.backend, safePath, data, options);
  }

  private async readFromBucket<T>(
    backend: GcsBackend,
    relativePath: string
  ): Promise<StoredJson<T>> {
    const objectPath = joinBucketPath(backend.prefix, relativePath);
    const file = storage.bucket(backend.bucket).file(objectPath);

    try {
      const [metadata] = await file.getMetadata();
      const [buffer] = await file.download();
      return {
        data: JSON.parse(buffer.toString("utf-8")) as T,
        generation: normaliseObjectVersion(metadata.generation),
        etag: normaliseObjectVersion(metadata.etag ?? metadata.generation),
        path: objectPath,
      };
    } catch (error) {
      if (isGcsError(error, 404)) {
        throw new HttpError(
          404,
          `Fant ikke innholdsfilen ${objectPath} i bucket ${backend.bucket}`
        );
      }
      throw error;
    }
  }

  private async writeToBucket(
    backend: GcsBackend,
    relativePath: string,
    data: unknown,
    options: WriteOptions
  ): Promise<{ generation: string | null; etag: string | null; path: string }> {
    const objectPath = joinBucketPath(backend.prefix, relativePath);
    const file = storage.bucket(backend.bucket).file(objectPath);
    const payload = `${JSON.stringify(data, null, 2)}\n`;

    const saveOptions: SaveOptions = {
      resumable: false,
      validation: "crc32c",
      contentType: "application/json; charset=utf-8",
    };

    const expected = options.expectedGeneration?.trim();
    if (expected) {
      saveOptions.preconditionOpts = { ifGenerationMatch: expected };
    }

    try {
      await file.save(payload, saveOptions);
    } catch (error) {
      if (isGcsError(error, 412)) {
        throw new HttpError(
          409,
          "Innholdet ble oppdatert av noen andre. Hent siste versjon og prøv igjen."
        );
      }
      throw error;
    }

    const [metadata] = await file.getMetadata();
    return {
      generation: normaliseObjectVersion(metadata.generation),
      etag: normaliseObjectVersion(metadata.etag ?? metadata.generation),
      path: objectPath,
    };
  }

  private async readFromDisk<T>(
    backend: LocalBackend,
    relativePath: string
  ): Promise<StoredJson<T>> {
    const absolutePath = buildAbsolutePath(backend.root, relativePath);

    let stat;
    try {
      stat = await fs.stat(absolutePath);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new HttpError(
          404,
          `Fant ikke innhold under ${relativePath} (lokal path ${absolutePath})`
        );
      }
      throw error;
    }

    const raw = await fs.readFile(absolutePath, "utf-8");
    return {
      data: JSON.parse(raw) as T,
      generation: buildDiskGeneration(stat),
      etag: buildDiskGeneration(stat),
      path: absolutePath,
    };
  }

  private async writeToDisk(
    backend: LocalBackend,
    relativePath: string,
    data: unknown,
    options: WriteOptions
  ): Promise<{ generation: string | null; etag: string | null; path: string }> {
    const absolutePath = buildAbsolutePath(backend.root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    const expected = options.expectedGeneration?.trim();
    if (expected) {
      try {
        const currentStat = await fs.stat(absolutePath);
        const currentGeneration = buildDiskGeneration(currentStat);
        if (currentGeneration !== expected) {
          throw new HttpError(
            409,
            "Innholdet ble oppdatert av noen andre. Hent siste versjon og prøv igjen."
          );
        }
      } catch (error) {
        if (!isNodeError(error) || error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    const payload = `${JSON.stringify(data, null, 2)}\n`;
    await fs.writeFile(absolutePath, payload, "utf-8");

    const stat = await fs.stat(absolutePath);
    const generation = buildDiskGeneration(stat);
    return {
      generation,
      etag: generation,
      path: absolutePath,
    };
  }
}

function parseContentTarget(uri: string): ContentBackend {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error("[admin-api] Ugyldig innholds-sti: tom streng");
  }

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice(5);
    const slash = withoutScheme.indexOf("/");
    if (slash === -1) {
      return { kind: "gcs", bucket: withoutScheme, prefix: "" };
    }
    const bucket = withoutScheme.slice(0, slash);
    const prefix = withoutScheme.slice(slash + 1).replace(/\/+$/, "");
    return { kind: "gcs", bucket, prefix };
  }

  const root = path.resolve(trimmed);
  return { kind: "local", root };
}

function normaliseObjectVersion(
  value: string | number | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "string" ? value : String(value);
}

function ensureSafeRelativePath(relativePath: string): string {
  const normalised = relativePath.replace(/\\/g, "/");
  if (!normalised || normalised.startsWith("/") || normalised.includes("..")) {
    throw new HttpError(400, `Ugyldig relativ sti: ${relativePath}`);
  }
  return normalised;
}

function joinBucketPath(prefix: string, relativePath: string): string {
  if (!prefix) {
    return relativePath;
  }
  if (!relativePath) {
    return prefix;
  }
  return `${prefix.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;
}

function buildAbsolutePath(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HttpError(400, `Innholdssti går utenfor roten: ${relativePath}`);
  }
  return resolved;
}

function buildDiskGeneration(stat: { mtimeMs: number; size: number }): string {
  return `disk:${stat.mtimeMs}:${stat.size}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === "object" && "code" in error);
}

function isGcsError(error: unknown, expectedCode: number): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: number | string }).code;
  if (typeof code === "number") {
    return code === expectedCode;
  }
  if (typeof code === "string") {
    const parsed = Number(code);
    return Number.isFinite(parsed) && parsed === expectedCode;
  }
  return false;
}

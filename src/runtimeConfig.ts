/// <reference types="vite/client" />

type RawAppConfig = {
  apiBaseUrl?: string;
  solarProxyBaseUrl?: string;
  contentTimestamp?: string;
  [key: string]: unknown;
};

export type AppConfig = {
  apiBaseUrl: string;
  solarProxyBaseUrl: string;
  contentTimestamp?: string;
  raw?: RawAppConfig | null;
};

let cachedConfig: AppConfig | null = null;
let loadPromise: Promise<AppConfig> | null = null;

/**
 * Loads runtime configuration for the SPA. Priority order:
 * 1. `import.meta.env.VITE_*` variables (local dev, build-time overrides)
 * 2. `/config/app.json` served by the backend (runtime overrides)
 * 3. Default fallbacks (`/api`, `/api/solar`)
 */
export async function loadAppConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!loadPromise) {
    loadPromise = resolveConfig();
  }

  return loadPromise;
}

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = createConfigFromValues({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    solarProxyBaseUrl: import.meta.env.VITE_SOLAR_BASE_URL,
  });
  return cachedConfig;
}

export function resolveApiUrl(path: string): string {
  const config = getAppConfig();
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  return `${config.apiBaseUrl}${normalisedPath}`;
}

async function resolveConfig(): Promise<AppConfig> {
  const envConfig = createConfigFromValues({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    solarProxyBaseUrl: import.meta.env.VITE_SOLAR_BASE_URL,
  });

  // Allow opting out of remote config when not needed (e.g. tests)
  if (import.meta.env.VITE_SKIP_REMOTE_CONFIG === "1") {
    cachedConfig = envConfig;
    return envConfig;
  }

  try {
    const response = await fetch("/config/app.json", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as RawAppConfig;
      cachedConfig = mergeConfig(envConfig, data);
      return cachedConfig;
    }
  } catch (error) {
    console.warn("[app-config] Failed to load /config/app.json", error);
  }

  cachedConfig = envConfig;
  return envConfig;
}

function mergeConfig(envConfig: AppConfig, fileConfig: RawAppConfig): AppConfig {
  const merged = createConfigFromValues({
    apiBaseUrl: fileConfig.apiBaseUrl ?? envConfig.apiBaseUrl,
    solarProxyBaseUrl: fileConfig.solarProxyBaseUrl ?? envConfig.solarProxyBaseUrl,
  });
  merged.contentTimestamp =
    typeof fileConfig.contentTimestamp === "string"
      ? fileConfig.contentTimestamp
      : envConfig.contentTimestamp;
  merged.raw = fileConfig;
  return merged;
}

function createConfigFromValues(values: {
  apiBaseUrl?: string;
  solarProxyBaseUrl?: string;
}): AppConfig {
  const apiBase = normaliseBaseUrl(values.apiBaseUrl ?? "/api");
  const solarBase = normaliseBaseUrl(
    values.solarProxyBaseUrl ?? `${apiBase}/solar`
  );

  return {
    apiBaseUrl: apiBase,
    solarProxyBaseUrl: solarBase,
    raw: null,
  };
}

function normaliseBaseUrl(value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
  }

  // Ensure leading slash for relative paths
  const trimmed = value.trim();
  const leading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return leading.endsWith("/") ? leading.slice(0, -1) : leading;
}

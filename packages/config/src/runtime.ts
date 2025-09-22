import { config as loadDotenv } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const DEFAULT_MATRIKKEL_BASE_URL = "https://www.matrikkel.no/matrikkelapi/wsapi/v1";

type MarvinEnvironment = "prod" | "test";

type MatrikkelCredentials = {
  baseUrl: string;
  username: string;
  password: string;
};

type RuntimeFlags = {
  liveMode: boolean;
  logSoap: boolean;
};

type PortsConfig = {
  api: number;
  buildingInfo: number;
};

type RuntimeConfig = {
  environment: MarvinEnvironment;
  matrikkel: {
    prod: MatrikkelCredentials;
    test: MatrikkelCredentials;
    current: MatrikkelCredentials;
  };
  enova: {
    apiKey?: string;
  };
  ports: PortsConfig;
  flags: RuntimeFlags;
};

let cachedConfig: RuntimeConfig | null = null;
let dotenvLoaded = false;

function ensureDotenvLoaded(): void {
  if (dotenvLoaded) {
    return;
  }

  const explicitPath = process.env.DOTENV_CONFIG_PATH;
  if (explicitPath && existsSync(explicitPath)) {
    loadDotenv({ path: explicitPath, override: false });
    dotenvLoaded = true;
    return;
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(currentDir, "../../..");
  const candidates = [".env.local", ".env"];

  for (const candidate of candidates) {
    const candidatePath = resolve(projectRoot, candidate);
    if (existsSync(candidatePath)) {
      loadDotenv({ path: candidatePath, override: false });
    }
  }

  dotenvLoaded = true;
}

function parseEnvironment(value: string | undefined): MarvinEnvironment {
  if (!value) {
    return "test";
  }

  return value.toLowerCase() === "prod" ? "prod" : "test";
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[config] Missing required environment variable ${name}`);
  }

  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`[config] Environment variable ${name} must be a number`);
  }

  return parsed;
}

function parseBoolean(name: string): boolean {
  const value = process.env[name];
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  ensureDotenvLoaded();

  const environment = parseEnvironment(process.env.API_ENV);

  const matrikkelProd: MatrikkelCredentials = {
    baseUrl: process.env.MATRIKKEL_API_BASE_URL_PROD ?? DEFAULT_MATRIKKEL_BASE_URL,
    username: requireEnv("MATRIKKEL_USERNAME"),
    password: requireEnv("MATRIKKEL_PASSWORD"),
  };

  const matrikkelTest: MatrikkelCredentials = {
    baseUrl: process.env.MATRIKKEL_API_BASE_URL_TEST ?? DEFAULT_MATRIKKEL_BASE_URL,
    username: process.env.MATRIKKEL_USERNAME_TEST ?? requireEnv("MATRIKKEL_USERNAME"),
    password: requireEnv("MATRIKKEL_PASSWORD"),
  };

  const config: RuntimeConfig = {
    environment,
    matrikkel: {
      prod: matrikkelProd,
      test: matrikkelTest,
      current: environment === "prod" ? matrikkelProd : matrikkelTest,
    },
    enova: {
      apiKey: process.env.ENOVA_API_KEY,
    },
    ports: {
      api: optionalNumber("API_PORT", 3001),
      buildingInfo: optionalNumber("PORT", 4000),
    },
    flags: {
      liveMode: parseBoolean("LIVE"),
      logSoap: parseBoolean("LOG_SOAP") || parseBoolean("LOG"),
    },
  };

  cachedConfig = config;
  return config;
}

export type { RuntimeConfig, MatrikkelCredentials, MarvinEnvironment };

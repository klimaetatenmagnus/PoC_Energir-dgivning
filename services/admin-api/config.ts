import process from "node:process";

export type AdminApiConfig = {
  projectId: string;
  cloudBuildLocation: string;
  stagingBucket: string;
  prodBucket: string;
  logBucketPrefix: string;
  serviceAccountEmail: string;
  port: number;
  gitSha: string | null;
};

function requireString(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(`[admin-api] Missing required environment variable ${name}`);
  }
  return value.trim();
}

function optionalString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normaliseBucketPath(value: string): string {
  if (value.endsWith("/")) {
    return value.slice(0, -1);
  }
  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `[admin-api] Invalid port value "${value}", expected positive number`
    );
  }
  return parsed;
}

export function loadAdminApiConfig(): AdminApiConfig {
  const projectId =
    optionalString(process.env.ADMIN_CLOUD_BUILD_PROJECT) ??
    optionalString(process.env.GOOGLE_CLOUD_PROJECT) ??
    optionalString(process.env.GCLOUD_PROJECT) ??
    optionalString(process.env.PROJECT_ID);

  if (!projectId) {
    throw new Error(
      "[admin-api] Unable to resolve project id (set ADMIN_CLOUD_BUILD_PROJECT or GOOGLE_CLOUD_PROJECT)"
    );
  }

  const stagingBucket = normaliseBucketPath(
    requireString(
      process.env.ADMIN_CONTENT_STAGING_PREFIX ??
        "gs://energinokkelen-content/content",
      "ADMIN_CONTENT_STAGING_PREFIX"
    )
  );

  const prodBucket = normaliseBucketPath(
    requireString(
      process.env.ADMIN_CONTENT_PROD_PREFIX ??
        "gs://energinokkelen-content-prod/content",
      "ADMIN_CONTENT_PROD_PREFIX"
    )
  );

  const logBucketPrefix = normaliseBucketPath(
    requireString(
      process.env.ADMIN_CONTENT_LOG_PREFIX ??
        "gs://energinokkelen-content-prod/content/logs",
      "ADMIN_CONTENT_LOG_PREFIX"
    )
  );

  const serviceAccountEmail =
    requireString(
      process.env.ADMIN_CONTENT_PUBLISHER_SERVICE_ACCOUNT ??
        `cloud-build@${projectId}.iam.gserviceaccount.com`,
      "ADMIN_CONTENT_PUBLISHER_SERVICE_ACCOUNT"
    );

  return {
    projectId,
    cloudBuildLocation:
      process.env.ADMIN_CLOUD_BUILD_LOCATION?.trim() || "global",
    stagingBucket,
    prodBucket,
    logBucketPrefix,
    serviceAccountEmail,
    port: parsePort(process.env.ADMIN_API_PORT, 4100),
    gitSha:
      optionalString(process.env.APP_GIT_SHA) ??
      optionalString(process.env.GIT_SHA) ??
      null,
  };
}

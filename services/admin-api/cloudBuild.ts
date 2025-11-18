import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "node:crypto";
import type { AdminApiConfig } from "./config.js";

export type PublishCollection = "tiltak" | "tilskudd";

export type PublishItem = {
  id: string;
  collection: PublishCollection;
  generation?: string;
};

export type PublishInitiator = {
  email: string;
  name?: string | null;
  sourceIp?: string | null;
};

export type ContentPublishRequest = {
  requestId?: string;
  changeSummary: string;
  targetEnvironment: "prod";
  dryRun?: boolean;
  items: PublishItem[];
  initiatedBy: PublishInitiator;
  gitSha: string | null;
};

export type ContentPublishResult = {
  operationName: string | null;
  buildId: string | null;
  status: string | null;
  logUrl: string | null;
  consoleUrl: string | null;
};

type CloudBuildStep = {
  id?: string;
  name: string;
  entrypoint?: string;
  args?: string[];
  env?: string[];
};

type CloudBuildSpec = {
  steps: CloudBuildStep[];
  timeout?: string;
  tags?: string[];
  substitutions?: Record<string, string>;
  serviceAccount?: string;
  options?: Record<string, unknown>;
};

type CloudBuildOperation = {
  name?: string;
  metadata?: {
    build?: {
      id?: string;
      status?: string;
      logUrl?: string;
    };
  };
};

const CLOUD_BUILD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const CLOUD_BUILD_BASE_URL = "https://cloudbuild.googleapis.com/v1";
const auth = new GoogleAuth({ scopes: [CLOUD_BUILD_SCOPE] });

export async function triggerContentPromotionBuild(
  config: AdminApiConfig,
  request: ContentPublishRequest
): Promise<ContentPublishResult> {
  const client = await auth.getClient();
  const spec = createBuildSpec(config, request);
  const url = `${CLOUD_BUILD_BASE_URL}/projects/${config.projectId}/locations/${config.cloudBuildLocation}/builds`;

  const response = await client.request<CloudBuildOperation>({
    url,
    method: "POST",
    data: spec,
  });

  return normaliseOperation(response.data, config.projectId);
}

function createBuildSpec(
  config: AdminApiConfig,
  request: ContentPublishRequest
): CloudBuildSpec {
  const requestId = request.requestId ?? randomUUID();
  const dryRun = request.dryRun ?? false;
  const contextPayload = createContextPayload(config, request, requestId, dryRun);
  const baseEnv = [
    `STAGING_BUCKET=${config.stagingBucket}`,
    `PROD_BUCKET=${config.prodBucket}`,
    `LOG_BUCKET_PREFIX=${config.logBucketPrefix}`,
    `DRY_RUN=${dryRun ? "1" : "0"}`,
  ];

  return {
    steps: [
      {
        id: "promote-content",
        name: "gcr.io/google.com/cloudsdktool/cloud-sdk",
        entrypoint: "bash",
        env: baseEnv,
        args: [
          "-c",
          [
            "set -eo pipefail",
            'if [[ "$DRY_RUN" == "1" ]]; then',
            '  echo "[dry-run] Skipping copy from $STAGING_BUCKET to $PROD_BUCKET"',
            "  exit 0",
            "fi",
            'echo "Syncing $STAGING_BUCKET -> $PROD_BUCKET"',
            'gsutil -m rsync -d -r "$STAGING_BUCKET" "$PROD_BUCKET"',
          ].join("\n"),
        ],
      },
      {
        id: "write-publish-log",
        name: "gcr.io/google.com/cloudsdktool/cloud-sdk",
        entrypoint: "bash",
        env: [...baseEnv, `PROMOTE_CONTEXT_B64=${contextPayload}`],
        args: [
          "-c",
          [
            "set -eo pipefail",
            'if [[ "$DRY_RUN" == "1" ]]; then',
            '  echo "[dry-run] Skipping publish log upload"',
            "  exit 0",
            "fi",
            'log_name=$(python3 - <<\'PY\'',
            "import base64, datetime, json, os, pathlib, re",
            "context = json.loads(base64.b64decode(os.environ['PROMOTE_CONTEXT_B64']).decode('utf-8'))",
            "timestamp = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'",
            "context['promotedAt'] = timestamp",
            "context['buildId'] = os.environ.get('BUILD_ID')",
            "context['logUrl'] = os.environ.get('LOG_URL')",
            "path = pathlib.Path('/workspace/publish-log.json')",
            "path.write_text(json.dumps(context, indent=2), encoding='utf-8')",
            "safe = re.sub(r'[^0-9A-Za-z-]', '-', timestamp)",
            "print('publish-' + safe + '.json')",
            "PY",
            ")",
            'gsutil cp /workspace/publish-log.json "${LOG_BUCKET_PREFIX}/$log_name"',
            'echo "Log stored at ${LOG_BUCKET_PREFIX}/$log_name"',
          ].join("\n"),
        ],
      },
    ],
    timeout: "900s",
    tags: ["content-publish", "admin-ui"],
    substitutions: {
      _REQUEST_ID: requestId,
    },
    serviceAccount: `projects/${config.projectId}/serviceAccounts/${config.serviceAccountEmail}`,
    options: {
      substitutionOption: "ALLOW_LOOSE",
    },
  };
}

function createContextPayload(
  config: AdminApiConfig,
  request: ContentPublishRequest,
  requestId: string,
  dryRun: boolean
): string {
  const context = {
    requestId,
    targetEnvironment: request.targetEnvironment,
    changeSummary: request.changeSummary,
    initiatedBy: request.initiatedBy,
    items: request.items,
    gitSha: request.gitSha,
    bucketSource: config.stagingBucket,
    bucketTarget: config.prodBucket,
    dryRun,
    triggeredAt: new Date().toISOString(),
    projectId: config.projectId,
  };

  return Buffer.from(JSON.stringify(context), "utf8").toString("base64");
}

function normaliseOperation(
  operation: CloudBuildOperation,
  projectId: string
): ContentPublishResult {
  const build = operation.metadata?.build;
  const buildId = build?.id ?? null;
  return {
    operationName: operation.name ?? null,
    buildId,
    status: build?.status ?? null,
    logUrl: build?.logUrl ?? null,
    consoleUrl: buildId
      ? `https://console.cloud.google.com/cloud-build/builds/${buildId}?project=${projectId}`
      : null,
  };
}

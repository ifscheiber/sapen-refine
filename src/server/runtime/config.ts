const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_S3_REGION = "us-east-1";
const DEFAULT_S3_FORCE_PATH_STYLE = true;
const DEFAULT_IMAGE_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_MASK_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_PREDICTION_BATCH_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_PREDICTION_BATCH_MAX_ITEMS = 200;
const DEFAULT_PREDICTION_BATCH_PROCESS_LIMIT = 25;
const DEFAULT_PREDICTION_BATCH_ITEM_MAX_ATTEMPTS = 3;
const DEFAULT_PREDICTION_BATCH_LEASE_SECONDS = 15 * 60;
const DEFAULT_PREDICTION_BATCH_MAX_JOBS_PER_TICK = 5;
const DEFAULT_PREDICTION_BATCH_WORKER_INTERVAL_SECONDS = 30;
const DEFAULT_PREDICTION_IMPORT_PROCESSOR_ID = "sapen-annotate-worker";
const DEFAULT_BATCH_STAGING_COMPLETED_RETENTION_DAYS = 7;
const DEFAULT_BATCH_STAGING_FAILED_RETENTION_DAYS = 14;
const DEFAULT_PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS = 24;
const DEFAULT_STORAGE_CLEANUP_MAX_DELETE_PER_RUN = 500;
const DEFAULT_LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_LOGIN_RATE_LIMIT_LOCK_SECONDS = 15 * 60;
const DEFAULT_SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS = 15 * 60;
const DEFAULT_SLICE_CROP_DEFAULT_PADDING_PX = 32;
const DEFAULT_HIGH_COST_LIMITS_ENABLED = true;
const DEFAULT_HIGH_COST_UPLOAD_MAX_REQUESTS = 20;
const DEFAULT_HIGH_COST_UPLOAD_WINDOW_SECONDS = 60;
const DEFAULT_HIGH_COST_EDITOR_SAVE_MAX_REQUESTS = 120;
const DEFAULT_HIGH_COST_EDITOR_SAVE_WINDOW_SECONDS = 60;
const DEFAULT_HIGH_COST_EXPORT_CREATE_MAX_REQUESTS = 5;
const DEFAULT_HIGH_COST_EXPORT_CREATE_WINDOW_SECONDS = 10 * 60;
const DEFAULT_HIGH_COST_PREDICTION_IMPORT_MAX_REQUESTS = 10;
const DEFAULT_HIGH_COST_PREDICTION_IMPORT_WINDOW_SECONDS = 10 * 60;
const DEFAULT_HIGH_COST_OPERATIONS_MAX_REQUESTS = 10;
const DEFAULT_HIGH_COST_OPERATIONS_WINDOW_SECONDS = 10 * 60;
const DEFAULT_TRAINING_EXPORT_MAX_ITEMS = 500;
const DEFAULT_TRAINING_EXPORT_MAX_BYTES = 512 * 1024 * 1024;
const DEFAULT_PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS = 500;
const DEFAULT_PREDICTION_ANALYSIS_EXPORT_MAX_BYTES = 512 * 1024 * 1024;
const SLICE_CROP_ALLOWED_PADDING_PX = [0, 16, 32, 64] as const;

export type RuntimeRateLimitPolicy = {
  maxRequests: number;
  windowSeconds: number;
};

export type RuntimeConfig = {
  nodeEnv: string;
  appBaseUrl: string;
  databaseUrl: string;
  s3: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    region: string;
    forcePathStyle: boolean;
  };
  uploads: {
    imageMaxBytes: number;
    maskMaxBytes: number;
    predictionBatchMaxBytes: number;
    predictionBatchMaxItems: number;
    predictionBatchProcessLimit: number;
    predictionBatchItemMaxAttempts: number;
  };
  batchRunner: {
    leaseSeconds: number;
    maxJobsPerTick: number;
    workerIntervalSeconds: number;
    processorId: string;
  };
  storageCleanup: {
    batchStagingCompletedRetentionDays: number;
    batchStagingFailedRetentionDays: number;
    presignedUploadStagingRetentionHours: number;
    maxDeletePerRun: number;
  };
  auth: {
    showDemoCredentials: boolean;
    loginRateLimitMaxFailures: number;
    loginRateLimitWindowSeconds: number;
    loginRateLimitLockSeconds: number;
    sessionLastSeenUpdateIntervalSeconds: number;
  };
  highCostLimits: {
    enabled: boolean;
    upload: RuntimeRateLimitPolicy;
    editorSave: RuntimeRateLimitPolicy;
    exportCreate: RuntimeRateLimitPolicy;
    predictionImport: RuntimeRateLimitPolicy;
    operations: RuntimeRateLimitPolicy;
  };
  exportCaps: {
    trainingMaxItems: number;
    trainingMaxBytes: number;
    predictionAnalysisMaxItems: number;
    predictionAnalysisMaxBytes: number;
  };
  cropWorkflow: {
    defaultPaddingPx: number;
  };
};

type Env = Record<string, string | undefined>;

function requireEnv(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optionalEnv(env: Env, name: string, fallback: string): string {
  const value = env[name]?.trim();
  return value || fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  throw new Error(`Invalid boolean value "${value}"`);
}

function parsePositiveInteger(
  env: Env,
  name: string,
  fallback: number,
  description = "positive integer number of bytes"
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a ${description}`);
  }
  return parsed;
}

function parseAllowedInteger(
  env: Env,
  name: string,
  fallback: number,
  allowedValues: readonly number[],
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || !allowedValues.includes(parsed)) {
    throw new Error(`${name} must be one of ${allowedValues.join(", ")}`);
  }
  return parsed;
}

export function readRuntimeConfig(env: Env = process.env): RuntimeConfig {
  const nodeEnv = optionalEnv(env, "NODE_ENV", "development");

  return {
    nodeEnv,
    appBaseUrl: optionalEnv(env, "APP_BASE_URL", DEFAULT_APP_BASE_URL),
    databaseUrl: requireEnv(env, "DATABASE_URL"),
    s3: {
      endpoint: requireEnv(env, "S3_ENDPOINT"),
      accessKeyId: requireEnv(env, "S3_ACCESS_KEY"),
      secretAccessKey: requireEnv(env, "S3_SECRET_KEY"),
      bucket: requireEnv(env, "S3_BUCKET"),
      region: optionalEnv(env, "S3_REGION", DEFAULT_S3_REGION),
      forcePathStyle: parseBoolean(env.S3_FORCE_PATH_STYLE, DEFAULT_S3_FORCE_PATH_STYLE),
    },
    uploads: {
      imageMaxBytes: parsePositiveInteger(
        env,
        "IMAGE_UPLOAD_MAX_BYTES",
        DEFAULT_IMAGE_UPLOAD_MAX_BYTES
      ),
      maskMaxBytes: parsePositiveInteger(
        env,
        "MASK_UPLOAD_MAX_BYTES",
        DEFAULT_MASK_UPLOAD_MAX_BYTES
      ),
      predictionBatchMaxBytes: parsePositiveInteger(
        env,
        "PREDICTION_BATCH_UPLOAD_MAX_BYTES",
        DEFAULT_PREDICTION_BATCH_UPLOAD_MAX_BYTES
      ),
      predictionBatchMaxItems: parsePositiveInteger(
        env,
        "PREDICTION_BATCH_MAX_ITEMS",
        DEFAULT_PREDICTION_BATCH_MAX_ITEMS,
        "positive integer count"
      ),
      predictionBatchProcessLimit: parsePositiveInteger(
        env,
        "PREDICTION_BATCH_PROCESS_LIMIT",
        DEFAULT_PREDICTION_BATCH_PROCESS_LIMIT,
        "positive integer count"
      ),
      predictionBatchItemMaxAttempts: parsePositiveInteger(
        env,
        "PREDICTION_BATCH_ITEM_MAX_ATTEMPTS",
        DEFAULT_PREDICTION_BATCH_ITEM_MAX_ATTEMPTS,
        "positive integer count"
      ),
    },
    batchRunner: {
      leaseSeconds: parsePositiveInteger(
        env,
        "PREDICTION_BATCH_LEASE_SECONDS",
        DEFAULT_PREDICTION_BATCH_LEASE_SECONDS,
        "positive integer number of seconds"
      ),
      maxJobsPerTick: parsePositiveInteger(
        env,
        "PREDICTION_BATCH_MAX_JOBS_PER_TICK",
        DEFAULT_PREDICTION_BATCH_MAX_JOBS_PER_TICK,
        "positive integer count"
      ),
      workerIntervalSeconds: parsePositiveInteger(
        env,
        "PREDICTION_BATCH_WORKER_INTERVAL_SECONDS",
        DEFAULT_PREDICTION_BATCH_WORKER_INTERVAL_SECONDS,
        "positive integer number of seconds"
      ),
      processorId: optionalEnv(
        env,
        "PREDICTION_IMPORT_PROCESSOR_ID",
        DEFAULT_PREDICTION_IMPORT_PROCESSOR_ID
      ),
    },
    storageCleanup: {
      batchStagingCompletedRetentionDays: parsePositiveInteger(
        env,
        "BATCH_STAGING_COMPLETED_RETENTION_DAYS",
        DEFAULT_BATCH_STAGING_COMPLETED_RETENTION_DAYS,
        "positive integer count"
      ),
      batchStagingFailedRetentionDays: parsePositiveInteger(
        env,
        "BATCH_STAGING_FAILED_RETENTION_DAYS",
        DEFAULT_BATCH_STAGING_FAILED_RETENTION_DAYS,
        "positive integer count"
      ),
      presignedUploadStagingRetentionHours: parsePositiveInteger(
        env,
        "PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS",
        DEFAULT_PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS,
        "positive integer count"
      ),
      maxDeletePerRun: parsePositiveInteger(
        env,
        "STORAGE_CLEANUP_MAX_DELETE_PER_RUN",
        DEFAULT_STORAGE_CLEANUP_MAX_DELETE_PER_RUN,
        "positive integer count"
      ),
    },
    auth: {
      showDemoCredentials:
        nodeEnv === "development" || parseBoolean(env.SHOW_DEMO_CREDENTIALS, false),
      loginRateLimitMaxFailures: parsePositiveInteger(
        env,
        "LOGIN_RATE_LIMIT_MAX_FAILURES",
        DEFAULT_LOGIN_RATE_LIMIT_MAX_FAILURES,
        "positive integer count"
      ),
      loginRateLimitWindowSeconds: parsePositiveInteger(
        env,
        "LOGIN_RATE_LIMIT_WINDOW_SECONDS",
        DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        "positive integer number of seconds"
      ),
      loginRateLimitLockSeconds: parsePositiveInteger(
        env,
        "LOGIN_RATE_LIMIT_LOCK_SECONDS",
        DEFAULT_LOGIN_RATE_LIMIT_LOCK_SECONDS,
        "positive integer number of seconds"
      ),
      sessionLastSeenUpdateIntervalSeconds: parsePositiveInteger(
        env,
        "SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS",
        DEFAULT_SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS,
        "positive integer number of seconds"
      ),
    },
    highCostLimits: {
      enabled: parseBoolean(env.HIGH_COST_LIMITS_ENABLED, DEFAULT_HIGH_COST_LIMITS_ENABLED),
      upload: {
        maxRequests: parsePositiveInteger(
          env,
          "HIGH_COST_UPLOAD_MAX_REQUESTS",
          DEFAULT_HIGH_COST_UPLOAD_MAX_REQUESTS,
          "positive integer count"
        ),
        windowSeconds: parsePositiveInteger(
          env,
          "HIGH_COST_UPLOAD_WINDOW_SECONDS",
          DEFAULT_HIGH_COST_UPLOAD_WINDOW_SECONDS,
          "positive integer number of seconds"
        ),
      },
      editorSave: {
        maxRequests: parsePositiveInteger(
          env,
          "HIGH_COST_EDITOR_SAVE_MAX_REQUESTS",
          DEFAULT_HIGH_COST_EDITOR_SAVE_MAX_REQUESTS,
          "positive integer count"
        ),
        windowSeconds: parsePositiveInteger(
          env,
          "HIGH_COST_EDITOR_SAVE_WINDOW_SECONDS",
          DEFAULT_HIGH_COST_EDITOR_SAVE_WINDOW_SECONDS,
          "positive integer number of seconds"
        ),
      },
      exportCreate: {
        maxRequests: parsePositiveInteger(
          env,
          "HIGH_COST_EXPORT_CREATE_MAX_REQUESTS",
          DEFAULT_HIGH_COST_EXPORT_CREATE_MAX_REQUESTS,
          "positive integer count"
        ),
        windowSeconds: parsePositiveInteger(
          env,
          "HIGH_COST_EXPORT_CREATE_WINDOW_SECONDS",
          DEFAULT_HIGH_COST_EXPORT_CREATE_WINDOW_SECONDS,
          "positive integer number of seconds"
        ),
      },
      predictionImport: {
        maxRequests: parsePositiveInteger(
          env,
          "HIGH_COST_PREDICTION_IMPORT_MAX_REQUESTS",
          DEFAULT_HIGH_COST_PREDICTION_IMPORT_MAX_REQUESTS,
          "positive integer count"
        ),
        windowSeconds: parsePositiveInteger(
          env,
          "HIGH_COST_PREDICTION_IMPORT_WINDOW_SECONDS",
          DEFAULT_HIGH_COST_PREDICTION_IMPORT_WINDOW_SECONDS,
          "positive integer number of seconds"
        ),
      },
      operations: {
        maxRequests: parsePositiveInteger(
          env,
          "HIGH_COST_OPERATIONS_MAX_REQUESTS",
          DEFAULT_HIGH_COST_OPERATIONS_MAX_REQUESTS,
          "positive integer count"
        ),
        windowSeconds: parsePositiveInteger(
          env,
          "HIGH_COST_OPERATIONS_WINDOW_SECONDS",
          DEFAULT_HIGH_COST_OPERATIONS_WINDOW_SECONDS,
          "positive integer number of seconds"
        ),
      },
    },
    exportCaps: {
      trainingMaxItems: parsePositiveInteger(
        env,
        "TRAINING_EXPORT_MAX_ITEMS",
        DEFAULT_TRAINING_EXPORT_MAX_ITEMS,
        "positive integer count"
      ),
      trainingMaxBytes: parsePositiveInteger(
        env,
        "TRAINING_EXPORT_MAX_BYTES",
        DEFAULT_TRAINING_EXPORT_MAX_BYTES
      ),
      predictionAnalysisMaxItems: parsePositiveInteger(
        env,
        "PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS",
        DEFAULT_PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS,
        "positive integer count"
      ),
      predictionAnalysisMaxBytes: parsePositiveInteger(
        env,
        "PREDICTION_ANALYSIS_EXPORT_MAX_BYTES",
        DEFAULT_PREDICTION_ANALYSIS_EXPORT_MAX_BYTES
      ),
    },
    cropWorkflow: {
      defaultPaddingPx: parseAllowedInteger(
        env,
        "SLICE_CROP_DEFAULT_PADDING_PX",
        DEFAULT_SLICE_CROP_DEFAULT_PADDING_PX,
        SLICE_CROP_ALLOWED_PADDING_PX,
      ),
    },
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return readRuntimeConfig(process.env);
}

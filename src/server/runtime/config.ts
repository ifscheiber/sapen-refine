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
const DEFAULT_LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_LOGIN_RATE_LIMIT_LOCK_SECONDS = 15 * 60;
const DEFAULT_SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS = 15 * 60;

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
  auth: {
    showDemoCredentials: boolean;
    loginRateLimitMaxFailures: number;
    loginRateLimitWindowSeconds: number;
    loginRateLimitLockSeconds: number;
    sessionLastSeenUpdateIntervalSeconds: number;
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
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return readRuntimeConfig(process.env);
}

const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_S3_REGION = "us-east-1";
const DEFAULT_S3_FORCE_PATH_STYLE = true;
const DEFAULT_IMAGE_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_MASK_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

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
  fallback: number
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer number of bytes`);
  }
  return parsed;
}

export function readRuntimeConfig(env: Env = process.env): RuntimeConfig {
  return {
    nodeEnv: optionalEnv(env, "NODE_ENV", "development"),
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
    },
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return readRuntimeConfig(process.env);
}

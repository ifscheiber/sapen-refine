import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(repoPath: string) {
  return readFileSync(path.join(process.cwd(), repoPath), "utf8");
}

function envKeys(source: string) {
  return new Set(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
      .filter((key): key is string => Boolean(key)),
  );
}

const APP_RUNTIME_VARS = [
  "APP_BASE_URL",
  "DATABASE_URL",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET",
  "S3_REGION",
  "S3_FORCE_PATH_STYLE",
  "IMAGE_UPLOAD_MAX_BYTES",
  "MASK_UPLOAD_MAX_BYTES",
  "PREDICTION_BATCH_UPLOAD_MAX_BYTES",
  "PREDICTION_BATCH_MAX_ITEMS",
  "PREDICTION_BATCH_PROCESS_LIMIT",
  "PREDICTION_BATCH_ITEM_MAX_ATTEMPTS",
  "PREDICTION_BATCH_LEASE_SECONDS",
  "PREDICTION_BATCH_MAX_JOBS_PER_TICK",
  "PREDICTION_BATCH_WORKER_INTERVAL_SECONDS",
  "PREDICTION_IMPORT_PROCESSOR_ID",
  "EXPORT_JOB_LEASE_SECONDS",
  "EXPORT_JOB_MAX_ATTEMPTS",
  "EXPORT_JOB_RETRY_DELAY_SECONDS",
  "EXPORT_JOB_MAX_JOBS_PER_TICK",
  "EXPORT_JOB_WORKER_INTERVAL_SECONDS",
  "EXPORT_JOB_PROCESSOR_ID",
  "BATCH_STAGING_COMPLETED_RETENTION_DAYS",
  "BATCH_STAGING_FAILED_RETENTION_DAYS",
  "PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS",
  "STORAGE_CLEANUP_MAX_DELETE_PER_RUN",
  "SLICE_CROP_DEFAULT_PADDING_PX",
  "HIGH_COST_LIMITS_ENABLED",
  "HIGH_COST_UPLOAD_MAX_REQUESTS",
  "HIGH_COST_UPLOAD_WINDOW_SECONDS",
  "HIGH_COST_EDITOR_SAVE_MAX_REQUESTS",
  "HIGH_COST_EDITOR_SAVE_WINDOW_SECONDS",
  "HIGH_COST_EXPORT_CREATE_MAX_REQUESTS",
  "HIGH_COST_EXPORT_CREATE_WINDOW_SECONDS",
  "HIGH_COST_PREDICTION_IMPORT_MAX_REQUESTS",
  "HIGH_COST_PREDICTION_IMPORT_WINDOW_SECONDS",
  "HIGH_COST_OPERATIONS_MAX_REQUESTS",
  "HIGH_COST_OPERATIONS_WINDOW_SECONDS",
  "TRAINING_EXPORT_MAX_ITEMS",
  "TRAINING_EXPORT_MAX_BYTES",
  "PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS",
  "PREDICTION_ANALYSIS_EXPORT_MAX_BYTES",
  "SHOW_DEMO_CREDENTIALS",
  "LOGIN_RATE_LIMIT_MAX_FAILURES",
  "LOGIN_RATE_LIMIT_WINDOW_SECONDS",
  "LOGIN_RATE_LIMIT_LOCK_SECONDS",
  "SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS",
] as const;

const OPERATIONAL_SCRIPT_VARS = [
  "SAPEN_JOB_BASE_URL",
  "SAPEN_JOB_EMAIL",
  "SAPEN_JOB_PASSWORD_FILE",
  "SAPEN_JOB_PASSWORD",
  "SAPEN_CLEANUP_BASE_URL",
  "SAPEN_CLEANUP_EMAIL",
  "SAPEN_CLEANUP_PASSWORD_FILE",
  "SAPEN_CLEANUP_PASSWORD",
  "SAPEN_TRIAL_USER_PASSWORD_FILE",
  "SAPEN_TRIAL_USER_PASSWORD",
  "SAPEN_OPERATOR_EMAIL",
  "SAPEN_REQUIRE_OPERATOR_ATTRIBUTION",
  "SAPEN_ALLOW_LOCAL_SYSTEM_ACTOR",
] as const;

const DATASET_MATERIALIZER_VARS = [
  "SAPEN_DATASET_BASE_URL",
  "SAPEN_DATASET_EMAIL",
  "SAPEN_DATASET_PASSWORD_FILE",
  "SAPEN_DATASET_PASSWORD",
] as const;

describe("environment inventory", () => {
  it("documents active runtime and operational variables in the environment inventory", () => {
    const environmentDoc = readRepoFile("docs/operations/environment.md");
    const runtimeDoc = readRepoFile("docs/04-server/runtime-config.md");
    const combinedDocs = `${environmentDoc}\n${runtimeDoc}`;

    for (const name of [...APP_RUNTIME_VARS, ...OPERATIONAL_SCRIPT_VARS, ...DATASET_MATERIALIZER_VARS]) {
      expect(combinedDocs, name).toContain(`\`${name}\``);
    }
  });

  it("keeps local environment template aligned with runtime and local operator variables", () => {
    const keys = envKeys(readRepoFile(".env.example"));

    for (const name of [
      ...APP_RUNTIME_VARS,
      ...OPERATIONAL_SCRIPT_VARS,
      ...DATASET_MATERIALIZER_VARS,
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_DB",
      "POSTGRES_PORT",
      "MINIO_ROOT_USER",
      "MINIO_ROOT_PASSWORD",
      "MINIO_API_PORT",
      "MINIO_CONSOLE_PORT",
      "NEXT_PROXY_CLIENT_MAX_BODY_SIZE",
    ]) {
      expect(keys.has(name), name).toBe(true);
    }
  });

  it("keeps trial environment template aligned with customer-trial runtime and secret-file variables", () => {
    const keys = envKeys(readRepoFile("deploy/trial.env.example"));

    for (const name of [
      "TRIAL_HOSTNAME",
      "APP_BASE_URL",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_DB",
      "S3_ACCESS_KEY",
      "S3_SECRET_KEY",
      "S3_BUCKET",
      "S3_REGION",
      "S3_FORCE_PATH_STYLE",
      ...APP_RUNTIME_VARS.filter((name) => name !== "DATABASE_URL" && name !== "S3_ENDPOINT"),
      "NEXT_PROXY_CLIENT_MAX_BODY_SIZE",
      "CADDY_MAX_BODY_SIZE",
      "SAPEN_JOB_EMAIL",
      "SAPEN_JOB_PASSWORD_FILE",
      "SAPEN_JOB_PASSWORD",
      "SAPEN_CLEANUP_EMAIL",
      "SAPEN_CLEANUP_PASSWORD_FILE",
      "SAPEN_CLEANUP_PASSWORD",
      "SAPEN_TRIAL_USER_PASSWORD_FILE",
      "SAPEN_TRIAL_USER_PASSWORD",
      "SAPEN_OPERATOR_EMAIL",
      "SAPEN_REQUIRE_OPERATOR_ATTRIBUTION",
    ]) {
      expect(keys.has(name), name).toBe(true);
    }
  });
});

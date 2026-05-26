import { describe, expect, it } from "vitest";

import { readRuntimeConfig } from "@/server/runtime/config";

const baseEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  S3_ENDPOINT: "http://localhost:9000",
  S3_ACCESS_KEY: "access",
  S3_SECRET_KEY: "secret",
  S3_BUCKET: "bucket",
};

describe("runtime config", () => {
  it("reads required server-side config with safe defaults", () => {
    const config = readRuntimeConfig(baseEnv);

    expect(config.appBaseUrl).toBe("http://localhost:3000");
    expect(config.s3.region).toBe("us-east-1");
    expect(config.s3.forcePathStyle).toBe(true);
    expect(config.uploads.imageMaxBytes).toBe(100 * 1024 * 1024);
    expect(config.uploads.maskMaxBytes).toBe(50 * 1024 * 1024);
    expect(config.uploads.predictionBatchMaxBytes).toBe(100 * 1024 * 1024);
    expect(config.uploads.predictionBatchMaxItems).toBe(200);
    expect(config.uploads.predictionBatchProcessLimit).toBe(25);
    expect(config.uploads.predictionBatchItemMaxAttempts).toBe(3);
    expect(config.batchRunner.leaseSeconds).toBe(15 * 60);
    expect(config.batchRunner.maxJobsPerTick).toBe(5);
    expect(config.batchRunner.workerIntervalSeconds).toBe(30);
    expect(config.batchRunner.processorId).toBe("sapen-annotate-worker");
    expect(config.storageCleanup.batchStagingCompletedRetentionDays).toBe(7);
    expect(config.storageCleanup.batchStagingFailedRetentionDays).toBe(14);
    expect(config.storageCleanup.presignedUploadStagingRetentionHours).toBe(24);
    expect(config.storageCleanup.maxDeletePerRun).toBe(500);
    expect(config.auth.showDemoCredentials).toBe(true);
    expect(config.auth.loginRateLimitMaxFailures).toBe(5);
    expect(config.auth.loginRateLimitWindowSeconds).toBe(15 * 60);
    expect(config.auth.loginRateLimitLockSeconds).toBe(15 * 60);
    expect(config.auth.sessionLastSeenUpdateIntervalSeconds).toBe(15 * 60);
    expect(config.highCostLimits.enabled).toBe(true);
    expect(config.highCostLimits.upload).toEqual({ maxRequests: 20, windowSeconds: 60 });
    expect(config.highCostLimits.editorSave).toEqual({ maxRequests: 120, windowSeconds: 60 });
    expect(config.highCostLimits.exportCreate).toEqual({
      maxRequests: 5,
      windowSeconds: 10 * 60,
    });
    expect(config.highCostLimits.predictionImport).toEqual({
      maxRequests: 10,
      windowSeconds: 10 * 60,
    });
    expect(config.highCostLimits.operations).toEqual({
      maxRequests: 10,
      windowSeconds: 10 * 60,
    });
    expect(config.exportCaps.trainingMaxItems).toBe(500);
    expect(config.exportCaps.trainingMaxBytes).toBe(512 * 1024 * 1024);
    expect(config.exportCaps.predictionAnalysisMaxItems).toBe(500);
    expect(config.exportCaps.predictionAnalysisMaxBytes).toBe(512 * 1024 * 1024);
    expect(config.cropWorkflow.defaultPaddingPx).toBe(32);
  });

  it("fails with an actionable message when critical env is missing", () => {
    expect(() => readRuntimeConfig({ ...baseEnv, S3_BUCKET: "" })).toThrow(
      "Missing required environment variable S3_BUCKET"
    );
  });

  it("parses deployment upload limits", () => {
    const config = readRuntimeConfig({
      ...baseEnv,
      APP_BASE_URL: "https://annotate.example.com",
      S3_FORCE_PATH_STYLE: "false",
      IMAGE_UPLOAD_MAX_BYTES: "209715200",
      MASK_UPLOAD_MAX_BYTES: "104857600",
      PREDICTION_BATCH_UPLOAD_MAX_BYTES: "157286400",
      PREDICTION_BATCH_MAX_ITEMS: "500",
      PREDICTION_BATCH_PROCESS_LIMIT: "50",
      PREDICTION_BATCH_ITEM_MAX_ATTEMPTS: "5",
      PREDICTION_BATCH_LEASE_SECONDS: "120",
      PREDICTION_BATCH_MAX_JOBS_PER_TICK: "9",
      PREDICTION_BATCH_WORKER_INTERVAL_SECONDS: "10",
      PREDICTION_IMPORT_PROCESSOR_ID: "trial-worker-a",
      BATCH_STAGING_COMPLETED_RETENTION_DAYS: "8",
      BATCH_STAGING_FAILED_RETENTION_DAYS: "15",
      PRESIGNED_UPLOAD_STAGING_RETENTION_HOURS: "36",
      STORAGE_CLEANUP_MAX_DELETE_PER_RUN: "250",
      NODE_ENV: "production",
      SHOW_DEMO_CREDENTIALS: "true",
      LOGIN_RATE_LIMIT_MAX_FAILURES: "7",
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: "600",
      LOGIN_RATE_LIMIT_LOCK_SECONDS: "1200",
      SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS: "300",
      HIGH_COST_LIMITS_ENABLED: "false",
      HIGH_COST_UPLOAD_MAX_REQUESTS: "30",
      HIGH_COST_UPLOAD_WINDOW_SECONDS: "120",
      HIGH_COST_EDITOR_SAVE_MAX_REQUESTS: "240",
      HIGH_COST_EDITOR_SAVE_WINDOW_SECONDS: "90",
      HIGH_COST_EXPORT_CREATE_MAX_REQUESTS: "8",
      HIGH_COST_EXPORT_CREATE_WINDOW_SECONDS: "1800",
      HIGH_COST_PREDICTION_IMPORT_MAX_REQUESTS: "12",
      HIGH_COST_PREDICTION_IMPORT_WINDOW_SECONDS: "1200",
      HIGH_COST_OPERATIONS_MAX_REQUESTS: "6",
      HIGH_COST_OPERATIONS_WINDOW_SECONDS: "900",
      TRAINING_EXPORT_MAX_ITEMS: "1000",
      TRAINING_EXPORT_MAX_BYTES: "1073741824",
      PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS: "750",
      PREDICTION_ANALYSIS_EXPORT_MAX_BYTES: "805306368",
      SLICE_CROP_DEFAULT_PADDING_PX: "16",
    });

    expect(config.appBaseUrl).toBe("https://annotate.example.com");
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.uploads.imageMaxBytes).toBe(209715200);
    expect(config.uploads.maskMaxBytes).toBe(104857600);
    expect(config.uploads.predictionBatchMaxBytes).toBe(157286400);
    expect(config.uploads.predictionBatchMaxItems).toBe(500);
    expect(config.uploads.predictionBatchProcessLimit).toBe(50);
    expect(config.uploads.predictionBatchItemMaxAttempts).toBe(5);
    expect(config.batchRunner.leaseSeconds).toBe(120);
    expect(config.batchRunner.maxJobsPerTick).toBe(9);
    expect(config.batchRunner.workerIntervalSeconds).toBe(10);
    expect(config.batchRunner.processorId).toBe("trial-worker-a");
    expect(config.storageCleanup.batchStagingCompletedRetentionDays).toBe(8);
    expect(config.storageCleanup.batchStagingFailedRetentionDays).toBe(15);
    expect(config.storageCleanup.presignedUploadStagingRetentionHours).toBe(36);
    expect(config.storageCleanup.maxDeletePerRun).toBe(250);
    expect(config.auth.showDemoCredentials).toBe(true);
    expect(config.auth.loginRateLimitMaxFailures).toBe(7);
    expect(config.auth.loginRateLimitWindowSeconds).toBe(600);
    expect(config.auth.loginRateLimitLockSeconds).toBe(1200);
    expect(config.auth.sessionLastSeenUpdateIntervalSeconds).toBe(300);
    expect(config.highCostLimits.enabled).toBe(false);
    expect(config.highCostLimits.upload).toEqual({ maxRequests: 30, windowSeconds: 120 });
    expect(config.highCostLimits.editorSave).toEqual({ maxRequests: 240, windowSeconds: 90 });
    expect(config.highCostLimits.exportCreate).toEqual({ maxRequests: 8, windowSeconds: 1800 });
    expect(config.highCostLimits.predictionImport).toEqual({
      maxRequests: 12,
      windowSeconds: 1200,
    });
    expect(config.highCostLimits.operations).toEqual({ maxRequests: 6, windowSeconds: 900 });
    expect(config.exportCaps.trainingMaxItems).toBe(1000);
    expect(config.exportCaps.trainingMaxBytes).toBe(1073741824);
    expect(config.exportCaps.predictionAnalysisMaxItems).toBe(750);
    expect(config.exportCaps.predictionAnalysisMaxBytes).toBe(805306368);
    expect(config.cropWorkflow.defaultPaddingPx).toBe(16);
  });

  it("rejects invalid byte limits", () => {
    expect(() =>
      readRuntimeConfig({ ...baseEnv, IMAGE_UPLOAD_MAX_BYTES: "0" })
    ).toThrow("IMAGE_UPLOAD_MAX_BYTES must be a positive integer number of bytes");
  });

  it("rejects invalid auth limits", () => {
    expect(() =>
      readRuntimeConfig({ ...baseEnv, LOGIN_RATE_LIMIT_MAX_FAILURES: "0" })
    ).toThrow("LOGIN_RATE_LIMIT_MAX_FAILURES must be a positive integer count");
  });

  it("rejects invalid high-cost and export cap limits", () => {
    expect(() =>
      readRuntimeConfig({ ...baseEnv, HIGH_COST_EXPORT_CREATE_MAX_REQUESTS: "0" })
    ).toThrow("HIGH_COST_EXPORT_CREATE_MAX_REQUESTS must be a positive integer count");
    expect(() =>
      readRuntimeConfig({ ...baseEnv, TRAINING_EXPORT_MAX_BYTES: "0" })
    ).toThrow("TRAINING_EXPORT_MAX_BYTES must be a positive integer number of bytes");
  });

  it("rejects unsupported slice crop padding defaults", () => {
    expect(() =>
      readRuntimeConfig({ ...baseEnv, SLICE_CROP_DEFAULT_PADDING_PX: "48" })
    ).toThrow("SLICE_CROP_DEFAULT_PADDING_PX must be one of 0, 16, 32, 64");
  });
});

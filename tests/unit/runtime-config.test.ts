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
    expect(config.auth.showDemoCredentials).toBe(true);
    expect(config.auth.loginRateLimitMaxFailures).toBe(5);
    expect(config.auth.loginRateLimitWindowSeconds).toBe(15 * 60);
    expect(config.auth.loginRateLimitLockSeconds).toBe(15 * 60);
    expect(config.auth.sessionLastSeenUpdateIntervalSeconds).toBe(15 * 60);
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
      NODE_ENV: "production",
      SHOW_DEMO_CREDENTIALS: "true",
      LOGIN_RATE_LIMIT_MAX_FAILURES: "7",
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: "600",
      LOGIN_RATE_LIMIT_LOCK_SECONDS: "1200",
      SESSION_LAST_SEEN_UPDATE_INTERVAL_SECONDS: "300",
    });

    expect(config.appBaseUrl).toBe("https://annotate.example.com");
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.uploads.imageMaxBytes).toBe(209715200);
    expect(config.uploads.maskMaxBytes).toBe(104857600);
    expect(config.uploads.predictionBatchMaxBytes).toBe(157286400);
    expect(config.uploads.predictionBatchMaxItems).toBe(500);
    expect(config.uploads.predictionBatchProcessLimit).toBe(50);
    expect(config.uploads.predictionBatchItemMaxAttempts).toBe(5);
    expect(config.auth.showDemoCredentials).toBe(true);
    expect(config.auth.loginRateLimitMaxFailures).toBe(7);
    expect(config.auth.loginRateLimitWindowSeconds).toBe(600);
    expect(config.auth.loginRateLimitLockSeconds).toBe(1200);
    expect(config.auth.sessionLastSeenUpdateIntervalSeconds).toBe(300);
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
});

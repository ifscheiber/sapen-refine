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
    });

    expect(config.appBaseUrl).toBe("https://annotate.example.com");
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.uploads.imageMaxBytes).toBe(209715200);
    expect(config.uploads.maskMaxBytes).toBe(104857600);
  });

  it("rejects invalid byte limits", () => {
    expect(() =>
      readRuntimeConfig({ ...baseEnv, IMAGE_UPLOAD_MAX_BYTES: "0" })
    ).toThrow("IMAGE_UPLOAD_MAX_BYTES must be a positive integer number of bytes");
  });
});

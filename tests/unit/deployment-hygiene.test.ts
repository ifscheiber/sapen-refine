import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(repoPath: string) {
  return readFileSync(path.join(process.cwd(), repoPath), "utf8");
}

function dockerIgnorePatterns() {
  return readRepoFile(".dockerignore")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function appServiceBlock(compose: string) {
  const match = compose.match(/\n  app:\n([\s\S]*?)\n  migrate:/);
  expect(match?.[1]).toBeTruthy();
  return match?.[1] ?? "";
}

const APP_RUNTIME_TRIAL_LIMITS = [
  ["HIGH_COST_LIMITS_ENABLED", "true"],
  ["HIGH_COST_UPLOAD_MAX_REQUESTS", "20"],
  ["HIGH_COST_UPLOAD_WINDOW_SECONDS", "60"],
  ["HIGH_COST_EDITOR_SAVE_MAX_REQUESTS", "120"],
  ["HIGH_COST_EDITOR_SAVE_WINDOW_SECONDS", "60"],
  ["HIGH_COST_EXPORT_CREATE_MAX_REQUESTS", "5"],
  ["HIGH_COST_EXPORT_CREATE_WINDOW_SECONDS", "600"],
  ["HIGH_COST_PREDICTION_IMPORT_MAX_REQUESTS", "10"],
  ["HIGH_COST_PREDICTION_IMPORT_WINDOW_SECONDS", "600"],
  ["HIGH_COST_OPERATIONS_MAX_REQUESTS", "10"],
  ["HIGH_COST_OPERATIONS_WINDOW_SECONDS", "600"],
  ["TRAINING_EXPORT_MAX_ITEMS", "500"],
  ["TRAINING_EXPORT_MAX_BYTES", "536870912"],
  ["PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS", "500"],
  ["PREDICTION_ANALYSIS_EXPORT_MAX_BYTES", "536870912"],
] as const;

describe("deployment hygiene", () => {
  it("keeps generated artifacts and local secrets out of the Docker build context", () => {
    const patterns = dockerIgnorePatterns();

    expect(patterns).toEqual(
      expect.arrayContaining([
        ".git",
        ".codex",
        "node_modules",
        ".next",
        "out",
        "build",
        "dist",
        ".turbo",
        ".cache",
        "cache",
        ".env",
        ".env.*",
        "!.env.example",
        "!.env*.example",
        "deploy/*.env",
        "deploy/*.env.*",
        "!deploy/*.env.example",
        "!deploy/*.env*.example",
        "coverage",
        "test-results",
        "playwright-report",
        "screenshots",
        "traces",
        "videos",
        "*.log",
        "*.zip",
        "*.tar",
        "*.tgz",
        "*.tar.gz",
        "backups",
        "backup",
        "tmp",
        "temp",
        "pgdata",
        "miniodata",
        "redis-data",
        "storage",
        "uploads",
      ]),
    );
  });

  it("does not exclude required Docker build inputs", () => {
    const patterns = dockerIgnorePatterns();

    expect(patterns).not.toEqual(
      expect.arrayContaining([
        "Dockerfile",
        "package.json",
        "package-lock.json",
        "prisma",
        "public",
        "src",
        "next.config.ts",
        "tsconfig.json",
      ]),
    );
  });

  it("keeps MinIO credentials out of the Compose init command", () => {
    const compose = readRepoFile("deploy/docker-compose.trial.yml");
    const script = readRepoFile("deploy/minio-init.sh");
    const mcCommandLines = script.split(/\r?\n/).filter((line) => line.trim().startsWith("mc "));
    const echoLines = script.split(/\r?\n/).filter((line) => line.includes("echo "));

    expect(compose).toContain('entrypoint: ["/bin/sh", "/scripts/minio-init.sh"]');
    expect(compose).toContain("./minio-init.sh:/scripts/minio-init.sh:ro");
    expect(compose).not.toContain("mc alias set");
    expect(compose).not.toContain("${S3_ACCESS_KEY} ${S3_SECRET_KEY}");
    expect(script).not.toContain("set -x");
    expect(script).not.toContain("mc alias set");
    expect(mcCommandLines.join("\n")).not.toMatch(/S3_(ACCESS|SECRET)_KEY/);
    expect(echoLines.join("\n")).not.toMatch(/S3_(ACCESS|SECRET)_KEY/);
  });

  it("installs OpenSSL in Docker stages that run Prisma", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("apt-get install -y --no-install-recommends openssl");
    expect(dockerfile).not.toContain("libssl1.1");
    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS builder[\s\S]*apt-get install -y --no-install-recommends openssl[\s\S]*RUN npm run prisma:generate/);
    expect(dockerfile).toMatch(/FROM node:22-bookworm-slim AS runner[\s\S]*apt-get install -y --no-install-recommends openssl[\s\S]*CMD \["npm", "run", "start"\]/);
  });

  it("keeps the Next proxy body limit aligned with trial upload limits", () => {
    const nextConfig = readRepoFile("next.config.ts");
    const dockerfile = readRepoFile("Dockerfile");
    const compose = readRepoFile("deploy/docker-compose.trial.yml");
    const trialEnv = readRepoFile("deploy/trial.env.example");

    expect(nextConfig).toContain("proxyClientMaxBodySize");
    expect(nextConfig).toContain("NEXT_PROXY_CLIENT_MAX_BODY_SIZE");
    expect(dockerfile).toContain("ARG NEXT_PROXY_CLIENT_MAX_BODY_SIZE=120mb");
    expect(dockerfile).toContain("ENV NEXT_PROXY_CLIENT_MAX_BODY_SIZE=${NEXT_PROXY_CLIENT_MAX_BODY_SIZE}");
    expect(compose).toContain("NEXT_PROXY_CLIENT_MAX_BODY_SIZE: ${NEXT_PROXY_CLIENT_MAX_BODY_SIZE:-120mb}");
    expect(trialEnv).toContain("NEXT_PROXY_CLIENT_MAX_BODY_SIZE=120mb");
  });

  it("propagates documented high-cost and export cap limits into the trial app service", () => {
    const compose = readRepoFile("deploy/docker-compose.trial.yml");
    const trialEnv = readRepoFile("deploy/trial.env.example");
    const appBlock = appServiceBlock(compose);

    for (const [name, fallback] of APP_RUNTIME_TRIAL_LIMITS) {
      expect(trialEnv).toContain(`${name}=${fallback}`);
      expect(appBlock).toContain(`${name}: ${"${"}${name}:-${fallback}}`);
    }
  });
});

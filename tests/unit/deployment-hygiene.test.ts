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
});

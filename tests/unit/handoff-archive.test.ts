import { describe, expect, it } from "vitest";

import {
  createHandoffManifest,
  filterArchivePaths,
  shouldExcludeArchivePath,
} from "../../scripts/create-handoff-archive.mjs";

describe("handoff archive policy", () => {
  it("keeps source and example env files", () => {
    expect(shouldExcludeArchivePath("src/app/page.tsx")).toBe(false);
    expect(shouldExcludeArchivePath(".env.example")).toBe(false);
    expect(shouldExcludeArchivePath("deploy/trial.env.example")).toBe(false);
  });

  it("excludes secrets, local volumes, caches, and generated artifacts", () => {
    expect(shouldExcludeArchivePath(".env")).toBe(true);
    expect(shouldExcludeArchivePath(".env.local")).toBe(true);
    expect(shouldExcludeArchivePath("deploy/trial.env")).toBe(true);
    expect(shouldExcludeArchivePath("node_modules/pkg/index.js")).toBe(true);
    expect(shouldExcludeArchivePath(".next/server/app.js")).toBe(true);
    expect(shouldExcludeArchivePath("coverage/lcov.info")).toBe(true);
    expect(shouldExcludeArchivePath("test-results/run/trace.zip")).toBe(true);
    expect(shouldExcludeArchivePath("miniodata/bucket/object")).toBe(true);
    expect(shouldExcludeArchivePath("backups/sapen-annotate.sql")).toBe(true);
    expect(shouldExcludeArchivePath("tsconfig.tsbuildinfo")).toBe(true);
  });

  it("filters paths before archive creation", () => {
    expect(filterArchivePaths(["README.md", ".env.local", "docs/README.md", "dist/handoff/a.zip"])).toEqual([
      "README.md",
      "docs/README.md",
    ]);
  });

  it("builds a manifest with dirty state and root summary", () => {
    const manifest = createHandoffManifest({
      createdAt: "2026-05-21T12:00:00.000Z",
      gitCommit: "abc123",
      gitStatus: " M README.md",
      packageInfo: { name: "sapen-annotate", version: "0.1.0", private: true },
      files: ["README.md", "docs/README.md", "src/app/page.tsx"],
    });

    expect(manifest).toMatchObject({
      manifestVersion: "sapen-annotate-handoff-v1",
      gitCommit: "abc123",
      dirty: true,
      includedFileCount: 3,
      includedRootFiles: ["README.md", "docs", "src"],
    });
    expect(manifest.excludedPathSummary).toContain(".git/");
  });
});

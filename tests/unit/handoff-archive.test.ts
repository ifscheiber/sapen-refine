import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  createHandoffManifest,
  filterArchivePaths,
  shouldExcludeArchivePath,
  validateArchiveEntryNames,
} from "../../scripts/create-handoff-archive.mjs";
import {
  formatValidationResult,
  validateHandoffArchive,
} from "../../scripts/validate-handoff-archive.mjs";

async function writeZipFixture(entries: Record<string, string>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sapen-handoff-"));
  const archivePath = path.join(dir, "fixture.zip");
  const zip = new JSZip();
  for (const [entryName, contents] of Object.entries(entries)) {
    zip.file(entryName, contents);
  }
  await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer" }));
  return { dir, archivePath };
}

describe("handoff archive policy", () => {
  it("keeps source and example env files", () => {
    expect(shouldExcludeArchivePath("src/app/page.tsx")).toBe(false);
    expect(shouldExcludeArchivePath(".env.example")).toBe(false);
    expect(shouldExcludeArchivePath(".env.template")).toBe(false);
    expect(shouldExcludeArchivePath(".env.local.example")).toBe(false);
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
    expect(shouldExcludeArchivePath("screenshots/failure.jpg")).toBe(true);
    expect(shouldExcludeArchivePath("videos/run.webm")).toBe(true);
    expect(shouldExcludeArchivePath("miniodata/bucket/object")).toBe(true);
    expect(shouldExcludeArchivePath("backups/sapen-annotate.sql")).toBe(true);
    expect(shouldExcludeArchivePath("tsconfig.tsbuildinfo")).toBe(true);
    expect(shouldExcludeArchivePath(".DS_Store")).toBe(true);
    expect(shouldExcludeArchivePath("Thumbs.db")).toBe(true);
    expect(shouldExcludeArchivePath("repo/.git/config")).toBe(true);
    expect(shouldExcludeArchivePath("wrapper/node_modules/pkg/index.js")).toBe(true);
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

  it("rejects suspicious archive entry paths before policy checks", () => {
    const result = validateArchiveEntryNames([
      "README.md",
      "../evil",
      "a/../../evil",
      "/absolute/path",
      String.raw`C:\Users\me\.env`,
      String.raw`\\server\share\repo.zip`,
      "file:///tmp/archive.zip",
    ]);

    expect(result.ok).toBe(false);
    expect(result.entriesScanned).toBe(7);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entryName: "../evil", reason: "TRAVERSAL_PATH" }),
        expect.objectContaining({ entryName: "a/../../evil", reason: "TRAVERSAL_PATH" }),
        expect.objectContaining({ entryName: "/absolute/path", reason: "ABSOLUTE_PATH" }),
        expect.objectContaining({ reason: "WINDOWS_DRIVE_PATH" }),
        expect.objectContaining({ reason: "ABSOLUTE_PATH,WINDOWS_UNC_PATH" }),
        expect.objectContaining({ reason: "URL_SCHEME_PATH" }),
      ]),
    );
  });

  it("validates a handoff-shaped zip fixture", async () => {
    const fixture = await writeZipFixture({
      "README.md": "repo readme",
      "docs/README.md": "docs readme",
      ".env.example": "PLACEHOLDER=value",
      ".env.template": "PLACEHOLDER=value",
      "handoff-manifest.json": "{}",
    });

    try {
      const result = await validateHandoffArchive(fixture.archivePath);
      expect(result.ok).toBe(true);
      expect(result.entriesScanned).toBeGreaterThanOrEqual(5);
      expect(formatValidationResult(result)).toContain("Result: PASS");
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("rejects forbidden zip entries without printing contents", async () => {
    const secret = "SUPER_SECRET_VALUE_SHOULD_NOT_LEAK";
    const fixture = await writeZipFixture({
      "README.md": "repo readme",
      ".env.local": secret,
      "repo/.git/config": "[remote]\nurl=secret",
      "some-wrapper/node_modules/pkg/index.js": "module.exports = true",
      "archive-root/.next/cache/file": "cache",
      "test-results/run/trace.zip": "trace payload",
      "screenshots/failure.png": "image bytes",
    });

    try {
      let output = "";
      try {
        execFileSync("node", ["scripts/validate-handoff-archive.mjs", fixture.archivePath], {
          cwd: process.cwd(),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string };
        output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
      }

      expect(output).toContain("Result: FAIL");
      expect(output).toContain(".env.local");
      expect(output).toContain("repo/.git/config");
      expect(output).not.toContain(secret);
      expect(output).not.toContain("[remote]");
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("rejects traversal entries from zip fixtures", async () => {
    const fixture = await writeZipFixture({
      "README.md": "repo readme",
      "../evil": "payload",
      "nested/../../evil": "payload",
    });

    try {
      const result = await validateHandoffArchive(fixture.archivePath);
      expect(result.ok).toBe(false);
      expect(result.violations.map((item) => item.reason)).toContain("TRAVERSAL_PATH");
    } finally {
      await rm(fixture.dir, { recursive: true, force: true });
    }
  });

  it("fails clearly when the input is not a zip archive", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sapen-handoff-"));
    const archivePath = path.join(dir, "not-a-zip.zip");
    await writeFile(archivePath, "not a zip");

    try {
      await expect(validateHandoffArchive(archivePath)).rejects.toThrow("Archive is not a readable ZIP file");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

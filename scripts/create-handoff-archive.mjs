#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import {
  EXCLUDED_PATH_SUMMARY,
  filterArchivePaths,
} from "./handoff-archive-policy.mjs";

export {
  EXCLUDED_PATH_SUMMARY,
  filterArchivePaths,
  inspectArchiveEntryPath,
  normalizeRepoPath,
  shouldExcludeArchivePath,
  validateArchiveEntryNames,
} from "./handoff-archive-policy.mjs";

export function createHandoffManifest(params) {
  const includedRootFiles = [...new Set(params.files.map((file) => file.split("/")[0]).filter(Boolean))].sort();
  return {
    manifestVersion: "sapen-annotate-handoff-v1",
    createdAt: params.createdAt,
    gitCommit: params.gitCommit,
    gitStatus: params.gitStatus,
    dirty: params.gitStatus.length > 0,
    package: params.packageInfo,
    includedFileCount: params.files.length,
    includedRootFiles,
    excludedPathSummary: EXCLUDED_PATH_SUMMARY,
  };
}

function git(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitListFiles(repoRoot) {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.split("\0").filter(Boolean);
}

function parseArgs(argv) {
  const options = {
    allowDirty: false,
    dryRun: false,
    output: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--allow-dirty") {
      options.allowDirty = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--output") {
      options.output = argv[i + 1] ?? null;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function createArchive(options) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const gitStatus = git(repoRoot, ["status", "--short"]);
  if (gitStatus && !options.allowDirty) {
    throw new Error("Worktree is dirty. Commit or stash changes, or pass --allow-dirty.");
  }

  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const gitCommit = git(repoRoot, ["rev-parse", "HEAD"]);
  const createdAt = new Date().toISOString();
  const files = filterArchivePaths(gitListFiles(repoRoot));
  const manifest = createHandoffManifest({
    createdAt,
    gitCommit,
    gitStatus,
    files,
    packageInfo: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true,
    },
  });

  const shortCommit = gitCommit.slice(0, 12);
  const timestamp = createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const defaultOutput = path.join(repoRoot, "dist", "handoff", `sapen-annotate-${shortCommit}-${timestamp}.zip`);
  const outputPath = path.resolve(repoRoot, options.output ?? defaultOutput);

  if (options.dryRun) {
    return { outputPath, manifest, dryRun: true };
  }

  const zip = new JSZip();
  for (const repoPath of files) {
    const bytes = await readFile(path.join(repoRoot, repoPath));
    zip.file(repoPath, bytes);
  }
  zip.file("handoff-manifest.json", JSON.stringify(manifest, null, 2));

  const archiveBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archiveBytes);

  return { outputPath, manifest, dryRun: false };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await createArchive(options);
  const mode = result.dryRun ? "Handoff archive dry-run" : "Handoff archive created";
  console.log(`${mode}: ${path.relative(process.cwd(), result.outputPath)}`);
  console.log(`Files: ${result.manifest.includedFileCount}`);
  console.log(`Dirty: ${result.manifest.dirty ? "yes" : "no"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

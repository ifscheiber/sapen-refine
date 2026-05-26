import path from "node:path";

export const EXCLUDED_PATH_SUMMARY = [
  ".git/",
  ".env and .env.* except example templates",
  "deploy/*.env and deploy/trial.env",
  "node_modules/",
  ".next/, out/, build/, dist/",
  "coverage/, test-results/, playwright-report/",
  "*.tsbuildinfo",
  "local database/storage volumes and temporary cache folders",
  "logs, screenshots, traces, and videos",
  "OS/editor noise",
  "backup output",
];

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".pnp",
  ".turbo",
  ".cache",
  ".codex",
  "__MACOSX",
  "node_modules",
  "coverage",
  "test-results",
  "playwright-report",
  "out",
  "build",
  "dist",
  "tmp",
  "temp",
  "pgdata",
  "miniodata",
  "redis-data",
  "storage",
  "uploads",
  "screenshots",
  "traces",
  "videos",
  "backups",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".log",
  ".pem",
  ".tsbuildinfo",
  ".trace",
  ".webm",
  ".mp4",
  ".mov",
]);

const EXCLUDED_FILENAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
]);

function collapseArchiveSlashes(value) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function normalizeRepoPath(value) {
  const repoPath = collapseArchiveSlashes(String(value ?? ""))
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  const parts = repoPath.split("/").filter((part) => part && part !== ".");
  return parts.join("/");
}

export function inspectArchiveEntryPath(value) {
  const originalName = String(value ?? "");
  const slashName = originalName.replace(/\\/g, "/");
  const collapsed = slashName.replace(/\/+/g, "/");
  const withoutLeadingDots = collapsed.replace(/^(\.\/)+/, "");
  const normalizedPath = normalizeRepoPath(originalName);
  const reasons = [];

  if (!originalName || !normalizedPath) {
    reasons.push("EMPTY_PATH");
  }
  if (slashName.startsWith("/") || slashName.startsWith("\\\\")) {
    reasons.push("ABSOLUTE_PATH");
  }
  if (/^[A-Za-z]:(?:\/|$)/.test(slashName)) {
    reasons.push("WINDOWS_DRIVE_PATH");
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(slashName)) {
    reasons.push("URL_SCHEME_PATH");
  }
  if (slashName.startsWith("//")) {
    reasons.push("WINDOWS_UNC_PATH");
  }
  if (withoutLeadingDots.split("/").some((part) => part === "..")) {
    reasons.push("TRAVERSAL_PATH");
  }

  return {
    originalName,
    normalizedPath,
    suspicious: reasons.length > 0,
    reasons,
  };
}

function isAllowedEnvExample(repoPath) {
  const base = path.posix.basename(repoPath);
  return (
    base === ".env.example" ||
    base === ".env.template" ||
    /^\.env.*\.example$/.test(base) ||
    /^\.env.*\.template$/.test(base)
  );
}

function isExcludedEnvPath(repoPath) {
  const base = path.posix.basename(repoPath);
  if (isAllowedEnvExample(repoPath)) return false;
  if (base === ".env" || base.startsWith(".env.")) return true;
  return repoPath.startsWith("deploy/") && base.endsWith(".env");
}

export function shouldExcludeArchivePath(value) {
  const repoPath = normalizeRepoPath(value);
  if (!repoPath || repoPath === ".") return true;
  if (isExcludedEnvPath(repoPath)) return true;

  const parts = repoPath.split("/");
  if (parts.some((part) => EXCLUDED_DIRS.has(part))) return true;

  const base = parts.at(-1) ?? "";
  const lowerBase = base.toLowerCase();
  const ext = path.posix.extname(lowerBase);
  if (EXCLUDED_FILENAMES.has(base)) return true;
  if (EXCLUDED_EXTENSIONS.has(ext)) return true;
  if (repoPath.includes("screenshots/")) return true;
  if (lowerBase.includes("screenshot") || lowerBase.includes("trace")) return true;
  if (repoPath.startsWith("deploy/") && lowerBase === "trial.env") return true;

  return false;
}

export function filterArchivePaths(paths) {
  return paths.map(normalizeRepoPath).filter((repoPath) => !shouldExcludeArchivePath(repoPath));
}

export function validateArchiveEntryNames(entryNames) {
  const violations = [];
  for (const entryName of entryNames) {
    const inspected = inspectArchiveEntryPath(entryName);
    if (inspected.suspicious) {
      violations.push({
        entryName: inspected.originalName,
        normalizedPath: inspected.normalizedPath,
        reason: inspected.reasons.join(","),
      });
      continue;
    }
    if (shouldExcludeArchivePath(inspected.normalizedPath)) {
      violations.push({
        entryName: inspected.originalName,
        normalizedPath: inspected.normalizedPath,
        reason: "FORBIDDEN_PATH",
      });
    }
  }

  return {
    entriesScanned: entryNames.length,
    violations,
    ok: violations.length === 0,
  };
}

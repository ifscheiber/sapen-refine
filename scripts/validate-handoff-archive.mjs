#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import { validateArchiveEntryNames } from "./handoff-archive-policy.mjs";

export class HandoffArchiveValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "HandoffArchiveValidationError";
  }
}

function displayPath(archivePath) {
  const relative = path.relative(process.cwd(), archivePath);
  return relative && !relative.startsWith("..") ? relative : archivePath;
}

function zipEntryName(entry) {
  return typeof entry.unsafeOriginalName === "string" && entry.unsafeOriginalName.length > 0
    ? entry.unsafeOriginalName
    : entry.name;
}

export async function validateHandoffArchive(archivePath) {
  if (!archivePath) {
    throw new HandoffArchiveValidationError("Usage: npm run handoff:validate -- <archive.zip>");
  }

  const resolvedPath = path.resolve(process.cwd(), archivePath);
  let bytes;
  try {
    bytes = await readFile(resolvedPath);
  } catch {
    throw new HandoffArchiveValidationError(`Archive is missing or unreadable: ${displayPath(resolvedPath)}`);
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new HandoffArchiveValidationError(`Archive is not a readable ZIP file: ${displayPath(resolvedPath)}`);
  }

  const entryNames = Object.values(zip.files).map(zipEntryName);
  return {
    archivePath: resolvedPath,
    ...validateArchiveEntryNames(entryNames),
  };
}

export function formatValidationResult(result) {
  const lines = [
    `Handoff archive: ${displayPath(result.archivePath)}`,
    `Entries scanned: ${result.entriesScanned}`,
  ];

  if (result.ok) {
    lines.push("Result: PASS - no forbidden or suspicious entries found.");
    return lines.join("\n");
  }

  lines.push("Result: FAIL - forbidden or suspicious entries found.");
  lines.push("Entries:");
  for (const violation of result.violations) {
    const normalized = violation.normalizedPath && violation.normalizedPath !== violation.entryName
      ? ` -> ${violation.normalizedPath}`
      : "";
    lines.push(`- ${violation.entryName}${normalized} (${violation.reason})`);
  }
  lines.push("Remediation: regenerate with `npm run handoff:archive` or remove forbidden material and rerun validation.");
  return lines.join("\n");
}

function parseArgs(argv) {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    return { help: true, archivePath: null };
  }
  if (argv.length !== 1) {
    throw new HandoffArchiveValidationError("Usage: npm run handoff:validate -- <archive.zip>");
  }
  return { help: false, archivePath: argv[0] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: npm run handoff:validate -- <archive.zip>");
    return;
  }

  const result = await validateHandoffArchive(args.archivePath);
  const output = formatValidationResult(result);
  if (!result.ok) {
    console.error(output);
    process.exit(1);
  }
  console.log(output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

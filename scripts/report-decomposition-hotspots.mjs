#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_PATH = "docs/01-architecture/opportunistic-decomposition-map.md";
const MIN_WARNING_LINES = 150;
const WARNING_RATIO = 0.1;

function countLines(repoPath) {
  const source = readFileSync(path.join(ROOT, repoPath), "utf8");
  return source.match(/\n/g)?.length ?? 0;
}

function parseHotspots() {
  const source = readFileSync(path.join(ROOT, MAP_PATH), "utf8");
  const lines = source.split(/\r?\n/);
  const tableStart = lines.findIndex((line) => line.startsWith("| Module | Size |"));
  if (tableStart < 0) {
    throw new Error(`Could not find hotspot table in ${MAP_PATH}`);
  }

  const rows = [];
  for (const line of lines.slice(tableStart + 2)) {
    if (!line.startsWith("|")) break;
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*(\d+)\s+lines\s*\|/);
    if (!match) continue;
    rows.push({ repoPath: match[1], documentedLines: Number.parseInt(match[2], 10) });
  }

  if (rows.length === 0) {
    throw new Error(`Could not parse hotspot rows in ${MAP_PATH}`);
  }
  return rows;
}

function main() {
  const rows = parseHotspots();
  const warnings = [];

  console.log("Decomposition hotspot line-count report");
  for (const row of rows) {
    const absolute = path.join(ROOT, row.repoPath);
    if (!existsSync(absolute)) {
      throw new Error(`Configured hotspot file is missing: ${row.repoPath}`);
    }

    const currentLines = countLines(row.repoPath);
    const delta = currentLines - row.documentedLines;
    const threshold = Math.max(MIN_WARNING_LINES, Math.ceil(row.documentedLines * WARNING_RATIO));
    const status = Math.abs(delta) > threshold ? "warn" : "ok";
    console.log(
      `${status.padEnd(4)} ${row.repoPath}: documented=${row.documentedLines}, current=${currentLines}, delta=${delta}`,
    );

    if (status === "warn") {
      warnings.push(`${row.repoPath} drifted by ${delta} lines; refresh ${MAP_PATH}`);
    }
  }

  if (warnings.length > 0) {
    console.warn("\nReport-only hotspot drift warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

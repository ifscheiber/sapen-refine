import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIRECT_FILES = [
  "AGENTS.md",
  "ARCHITECTURE.md",
];
const DOC_DIRS = ["docs"];
const TICKET_ROOT = "tickets";
const ACTIVE_TICKET_INDEX_FILES = new Set(["README.md", "00-sprint-index.md"]);

function hasPathSegment(repoPath: string, segment: string) {
  return repoPath.split(path.sep).includes(segment);
}

function walkDirectories(repoPath: string): string[] {
  const absolute = path.join(ROOT, repoPath);
  if (!existsSync(absolute)) return [];

  const stat = statSync(absolute);
  if (!stat.isDirectory()) return [];

  return [
    repoPath,
    ...readdirSync(absolute).flatMap((entry) => walkDirectories(path.join(repoPath, entry))),
  ].sort();
}

function walkMarkdownFiles(repoPath: string): string[] {
  const absolute = path.join(ROOT, repoPath);
  const stat = statSync(absolute);
  if (stat.isFile()) return repoPath.endsWith(".md") ? [repoPath] : [];

  return readdirSync(absolute)
    .flatMap((entry) => walkMarkdownFiles(path.join(repoPath, entry)))
    .sort();
}

function withoutFencedCode(source: string) {
  let inFence = false;
  return source
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return "";
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

function localLinkTarget(raw: string) {
  const trimmed = raw.trim().replace(/^<|>$/g, "");
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return null;
  }

  const withoutTitle = trimmed.match(/^(\S+)(?:\s+["'][^"']*["'])?$/)?.[1] ?? trimmed;
  const withoutAnchor = withoutTitle.split("#")[0];
  return withoutAnchor || null;
}

function markdownLinks(source: string) {
  const linkPattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
  return Array.from(withoutFencedCode(source).matchAll(linkPattern), (match) => match[1]);
}

function activeTicketIndexDirs() {
  return walkDirectories(TICKET_ROOT)
    .filter((repoPath) => !hasPathSegment(repoPath, "done"))
    .filter((repoPath) =>
      readdirSync(path.join(ROOT, repoPath)).some((entry) => ACTIVE_TICKET_INDEX_FILES.has(entry)),
    )
    .sort();
}

function topLevelMarkdownFiles(repoPath: string) {
  return readdirSync(path.join(ROOT, repoPath))
    .filter((entry) => {
      const filePath = path.join(ROOT, repoPath, entry);
      return statSync(filePath).isFile() && entry.endsWith(".md");
    })
    .map((entry) => path.join(repoPath, entry))
    .sort();
}

function scannedMarkdownFiles() {
  return Array.from(new Set([
    ...DIRECT_FILES,
    ...DOC_DIRS.flatMap(walkMarkdownFiles),
    ...activeTicketIndexDirs().flatMap(topLevelMarkdownFiles),
  ])).sort();
}

describe("documentation link governance", () => {
  it("keeps governed local markdown links resolvable relative to their source file", () => {
    const failures: string[] = [];

    for (const repoPath of scannedMarkdownFiles()) {
      const source = readFileSync(path.join(ROOT, repoPath), "utf8");
      for (const rawLink of markdownLinks(source)) {
        const target = localLinkTarget(rawLink);
        if (!target) continue;

        let decodedTarget = target;
        try {
          decodedTarget = decodeURI(target);
        } catch {
          failures.push(`${repoPath}: invalid URI in link ${rawLink}`);
          continue;
        }

        const resolved = path.normalize(path.join(path.dirname(repoPath), decodedTarget));
        if (!existsSync(path.join(ROOT, resolved))) {
          failures.push(`${repoPath}: ${rawLink} -> ${resolved}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("protects the rejected docs README false positive and active indexed sprint links", () => {
    expect(existsSync(path.join(ROOT, "docs/src/app/README.md"))).toBe(true);
    expect(existsSync(path.join(ROOT, "docs/08-adr/ADR-008-upload-content-safety.md"))).toBe(true);

    const sprintReadme = readFileSync(path.join(ROOT, "tickets/2026-05-23/README.md"), "utf8");
    expect(sprintReadme).toContain("docs/README.md` broken-link claim");

    const scanned = scannedMarkdownFiles();
    expect(scanned).toContain("tickets/2026-05-27/README.md");
    expect(scanned).toContain("tickets/design/00-sprint-index.md");
    expect(scanned.some((repoPath) => repoPath.includes(`${path.sep}done${path.sep}`))).toBe(false);
  });
});

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIRECT_FILES = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "tickets/2026-05-23/README.md",
];
const DOC_DIRS = ["docs"];

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

function scannedMarkdownFiles() {
  return [
    ...DIRECT_FILES,
    ...DOC_DIRS.flatMap(walkMarkdownFiles),
  ].sort();
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

  it("protects the rejected docs README false positive and active sprint links", () => {
    expect(existsSync(path.join(ROOT, "docs/src/app/README.md"))).toBe(true);
    expect(existsSync(path.join(ROOT, "docs/08-adr/ADR-008-upload-content-safety.md"))).toBe(true);

    const sprintReadme = readFileSync(path.join(ROOT, "tickets/2026-05-23/README.md"), "utf8");
    expect(sprintReadme).toContain("docs/README.md` broken-link claim");
  });
});

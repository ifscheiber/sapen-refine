import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MATRIX_PATH = "docs/testing/audit-coverage-matrix.md";
const HTTP_METHOD_EXPORT = /\bexport\s+(?:const|async function)\s+(GET|POST|PATCH|DELETE|PUT|HEAD|OPTIONS)\b/g;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_ACTOR_CONTEXT_STATUSES = new Set([
  "current",
  "sufficient-for-trial",
  "follow-up-required",
  "not-applicable",
]);
const ALLOWED_AUDIT_SUFFICIENCY = new Set(["sufficient", "partial", "missing", "exempt"]);

type MatrixRow = {
  id: string;
  area: string;
  route_or_entrypoint: string;
  method_or_trigger: string;
  domain_write: string;
  attribution_mechanism: string;
  triggered_by: string;
  performed_by: string;
  rb115_actor_context_status: string;
  audit_sufficiency: string;
  follow_up: string;
  notes: string;
};

const EXPECTED_COLUMNS = [
  "id",
  "area",
  "route_or_entrypoint",
  "method_or_trigger",
  "domain_write",
  "attribution_mechanism",
  "triggered_by",
  "performed_by",
  "rb115_actor_context_status",
  "audit_sufficiency",
  "follow_up",
  "notes",
] as const;

const REQUIRED_OPERATIONAL_ENTRYPOINTS = [
  { route_or_entrypoint: "scripts/process-export-jobs.mjs", method_or_trigger: "CLI" },
  { route_or_entrypoint: "scripts/process-prediction-import-batch.mjs", method_or_trigger: "CLI" },
  { route_or_entrypoint: "scripts/storage-cleanup.mjs", method_or_trigger: "CLI" },
  { route_or_entrypoint: "scripts/trial-bootstrap.mjs", method_or_trigger: "CLI" },
  { route_or_entrypoint: "scripts/create-trial-user.mjs", method_or_trigger: "CLI" },
  { route_or_entrypoint: "src/server/http/highCostRateLimit.ts", method_or_trigger: "guard write" },
] as const;

function routeFiles(dir = path.resolve("src/app/api")): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) return routeFiles(absolute);
    if (!absolute.endsWith("/route.ts")) return [];
    return path.relative(process.cwd(), absolute).split(path.sep).join("/");
  }).sort();
}

function exportedMutationMethods(source: string) {
  return Array.from(source.matchAll(HTTP_METHOD_EXPORT), (match) => match[1])
    .filter((method) => MUTATION_METHODS.has(method))
    .sort();
}

function cleanCell(value: string) {
  return value.trim().replace(/^`|`$/g, "");
}

function parseMatrixRows(): MatrixRow[] {
  const lines = readFileSync(MATRIX_PATH, "utf8").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("| id | area | route_or_entrypoint |"));
  if (headerIndex === -1) throw new Error("Audit coverage matrix table header not found");

  const header = lines[headerIndex].split("|").slice(1, -1).map(cleanCell);
  expect(header).toEqual([...EXPECTED_COLUMNS]);

  const rows: MatrixRow[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map(cleanCell);
    expect(cells, line).toHaveLength(EXPECTED_COLUMNS.length);
    rows.push(Object.fromEntries(EXPECTED_COLUMNS.map((column, index) => [column, cells[index]])) as MatrixRow);
  }
  return rows;
}

function apiMutationEntries() {
  return routeFiles().flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return exportedMutationMethods(source).map((method) => ({
      route_or_entrypoint: file,
      method_or_trigger: method,
    }));
  }).sort((a, b) =>
    a.route_or_entrypoint.localeCompare(b.route_or_entrypoint) ||
    a.method_or_trigger.localeCompare(b.method_or_trigger),
  );
}

function entryKey(entry: { route_or_entrypoint: string; method_or_trigger: string }) {
  return `${entry.route_or_entrypoint} ${entry.method_or_trigger}`;
}

describe("audit coverage matrix", () => {
  it("classifies every app API mutation method", () => {
    const rows = parseMatrixRows();
    const matrixEntries = new Set(
      rows
        .filter((row) => row.route_or_entrypoint.startsWith("src/app/api/"))
        .map(entryKey),
    );

    expect(apiMutationEntries().map(entryKey).filter((entry) => !matrixEntries.has(entry))).toEqual([]);
  });

  it("classifies known operational mutation entrypoints", () => {
    const rows = parseMatrixRows();
    const matrixEntries = new Set(rows.map(entryKey));

    expect(REQUIRED_OPERATIONAL_ENTRYPOINTS.map(entryKey).filter((entry) => !matrixEntries.has(entry))).toEqual([]);
  });

  it("uses stable ids and controlled classification values", () => {
    const rows = parseMatrixRows();
    const ids = rows.map((row) => row.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const row of rows) {
      expect(row.id, row.id).toMatch(/^MUT-[A-Z0-9-]+$/);
      expect(ALLOWED_ACTOR_CONTEXT_STATUSES.has(row.rb115_actor_context_status), row.id).toBe(true);
      expect(ALLOWED_AUDIT_SUFFICIENCY.has(row.audit_sufficiency), row.id).toBe(true);
      if (row.audit_sufficiency === "partial" || row.audit_sufficiency === "missing") {
        expect(row.follow_up, row.id).not.toBe("none");
      }
    }
  });
});

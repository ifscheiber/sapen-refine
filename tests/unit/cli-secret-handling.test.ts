import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

type SecretInputModule = {
  markDeprecatedPasswordFlag: (
    args: Record<string, unknown>,
    stderr: { write: (chunk: string) => unknown },
  ) => void;
  resolveSecretInput: (params: Record<string, unknown>) => { secret: string; source: string };
};

let secretInput: SecretInputModule;

beforeAll(async () => {
  secretInput = await import(pathToFileURL(path.join(process.cwd(), "scripts/secret-input.mjs")).href);
});

function baseSecretParams(overrides: Record<string, unknown> = {}) {
  return {
    cliPassword: undefined,
    cliPasswordFile: undefined,
    cliPasswordStdin: false,
    envPassword: undefined,
    envPasswordFile: undefined,
    envPasswordName: "SAPEN_JOB_PASSWORD",
    envPasswordFileName: "SAPEN_JOB_PASSWORD_FILE",
    secretDescription: "operator password",
    ...overrides,
  };
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    if (statSync(absolute).isDirectory()) return walkFiles(absolute);
    return [absolute];
  });
}

describe("cli secret handling", () => {
  it("resolves env, file, stdin, and deprecated cli password inputs with stable precedence", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "sapen-secret-test-"));
    try {
      const secretPath = path.join(tempDir, "password");
      writeFileSync(secretPath, "file-secret\n", "utf8");

      expect(secretInput.resolveSecretInput(baseSecretParams({
        envPassword: "env-secret",
      }))).toEqual({ secret: "env-secret", source: "SAPEN_JOB_PASSWORD" });

      expect(secretInput.resolveSecretInput(baseSecretParams({
        cliPassword: "cli-secret",
        cliPasswordFile: secretPath,
        envPassword: "env-secret",
      }))).toEqual({ secret: "file-secret", source: "--password-file" });

      expect(secretInput.resolveSecretInput(baseSecretParams({
        cliPasswordStdin: true,
        stdinReader: () => "stdin-secret",
      }))).toEqual({ secret: "stdin-secret", source: "--password-stdin" });

      expect(secretInput.resolveSecretInput(baseSecretParams({
        cliPassword: "cli-secret",
      }))).toEqual({ secret: "cli-secret", source: "--password" });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("prints the deprecated password warning without echoing the secret", () => {
    let warning = "";
    secretInput.markDeprecatedPasswordFlag(
      { password: "super-secret-value" },
      { write: (chunk) => { warning += chunk; return true; } },
    );

    expect(warning).toContain("--password is deprecated");
    expect(warning).not.toContain("super-secret-value");
  });

  it("documents preferred secret inputs in script help output", () => {
    const commands = [
      ["node", ["scripts/process-export-jobs.mjs", "--help"]],
      ["node", ["scripts/process-prediction-import-batch.mjs", "--help"]],
      ["node", ["scripts/storage-cleanup.mjs", "--help"]],
      ["node", ["scripts/create-trial-user.mjs", "--help"]],
      ["node", ["scripts/materialize-sapen-cnn-dataset.mjs", "--help"]],
    ] as const;

    for (const [command, args] of commands) {
      const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8" });
      expect(result.status, `${command} ${args.join(" ")} stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("--password-file");
      expect(result.stdout).toContain("--password-stdin");
      expect(result.stdout).toContain("Deprecated");
    }
  });

  it("does not recommend password command arguments in active docs", () => {
    const files = [
      ...walkFiles(path.join(process.cwd(), "docs")),
      ...walkFiles(path.join(process.cwd(), "deploy")),
      path.join(process.cwd(), "README.md"),
    ];
    const offendingLines = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line, index) => ({ file, line, index: index + 1 }))
        .filter(({ line }) => /(npm run|docker compose).*\s--password\b/.test(line)),
    );

    expect(offendingLines.map(({ file, index, line }) =>
      `${path.relative(process.cwd(), file)}:${index}: ${line}`,
    )).toEqual([]);
  });
});

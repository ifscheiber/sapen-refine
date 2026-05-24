#!/usr/bin/env node

import {
  markDeprecatedPasswordFlag,
  resolveSecretInput,
} from "./secret-input.mjs";

const DEFAULT_BASE_URL =
  process.env.SAPEN_CLEANUP_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";

function parsePositiveInteger(value, flagName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }

  const args = {
    baseUrl: DEFAULT_BASE_URL,
    email: process.env.SAPEN_CLEANUP_EMAIL || "",
    password: "",
    passwordFile: "",
    passwordStdin: false,
    execute: false,
    dryRun: true,
    category: undefined,
    projectId: undefined,
    batchId: undefined,
    limit: undefined,
    completedRetentionDays: undefined,
    failedRetentionDays: undefined,
    presignedRetentionHours: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--base-url" && next) {
      args.baseUrl = next;
      index += 1;
    } else if (arg === "--email" && next) {
      args.email = next;
      index += 1;
    } else if (arg === "--password" && next) {
      args.password = next;
      markDeprecatedPasswordFlag(args);
      index += 1;
    } else if (arg === "--password-file" && next) {
      args.passwordFile = next;
      index += 1;
    } else if (arg === "--password-stdin") {
      args.passwordStdin = true;
    } else if (arg === "--execute") {
      args.execute = true;
      args.dryRun = false;
    } else if (arg === "--dry-run") {
      args.execute = false;
      args.dryRun = true;
    } else if (arg === "--category" && next) {
      args.category = next;
      index += 1;
    } else if (arg === "--project" && next) {
      args.projectId = next;
      index += 1;
    } else if (arg === "--batch" && next) {
      args.batchId = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = parsePositiveInteger(next, "--limit");
      index += 1;
    } else if (arg === "--completed-retention-days" && next) {
      args.completedRetentionDays = parsePositiveInteger(next, "--completed-retention-days");
      index += 1;
    } else if (arg === "--failed-retention-days" && next) {
      args.failedRetentionDays = parsePositiveInteger(next, "--failed-retention-days");
      index += 1;
    } else if (arg === "--presigned-retention-hours" && next) {
      args.presignedRetentionHours = parsePositiveInteger(next, "--presigned-retention-hours");
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!args.email) throw new Error("--email or SAPEN_CLEANUP_EMAIL is required");
  args.password = resolveSecretInput({
    cliPassword: args.password,
    cliPasswordFile: args.passwordFile,
    cliPasswordStdin: args.passwordStdin,
    envPassword: process.env.SAPEN_CLEANUP_PASSWORD,
    envPasswordFile: process.env.SAPEN_CLEANUP_PASSWORD_FILE,
    envPasswordName: "SAPEN_CLEANUP_PASSWORD",
    envPasswordFileName: "SAPEN_CLEANUP_PASSWORD_FILE",
    secretDescription: "cleanup operator password",
  }).secret;
  return args;
}

function printHelp() {
  console.log(`Usage:
npm run storage:cleanup -- [options]

Options:
  --base-url <url>                 App base URL. Defaults to SAPEN_CLEANUP_BASE_URL, APP_BASE_URL, or http://localhost:3000.
  --email <email>                  Admin account email. Defaults to SAPEN_CLEANUP_EMAIL.
  --password-file <path>           Read the admin password from a mounted secret file.
  --password-stdin                 Read the admin password from stdin.
  --execute                        Delete eligible temporary objects.
  --dry-run                        Report candidates without deleting. Default.
  --category <all|batch-staging|upload-orphans>
  --project <project-id>
  --batch <batch-id>
  --limit <n>
  --completed-retention-days <n>
  --failed-retention-days <n>
  --presigned-retention-hours <n>
  --help                           Show this help.

Secret input precedence:
  --password-file, SAPEN_CLEANUP_PASSWORD_FILE, SAPEN_CLEANUP_PASSWORD, --password-stdin, deprecated --password.

Deprecated:
  --password <password> is retained temporarily for compatibility but can leak via shell history or process lists.`);
}

function sessionCookieFromHeaders(headers) {
  const cookie = headers.get("set-cookie");
  if (!cookie) throw new Error("Login response did not set a session cookie");
  return cookie.split(";")[0];
}

async function jsonOrThrow(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return body;
}

function hardDriftCount(result) {
  const value = result?.cleanup?.consistency?.hardDriftCount;
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function requestBody(args) {
  return {
    execute: args.execute,
    dryRun: args.dryRun,
    ...(args.category ? { category: args.category } : {}),
    ...(args.projectId ? { projectId: args.projectId } : {}),
    ...(args.batchId ? { batchId: args.batchId } : {}),
    ...(args.limit ? { limit: args.limit } : {}),
    ...(args.completedRetentionDays ? { completedRetentionDays: args.completedRetentionDays } : {}),
    ...(args.failedRetentionDays ? { failedRetentionDays: args.failedRetentionDays } : {}),
    ...(args.presignedRetentionHours ? { presignedRetentionHours: args.presignedRetentionHours } : {}),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const baseUrl = args.baseUrl.replace(/\/$/, "");
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: args.email, password: args.password }),
  });
  await jsonOrThrow(login);
  const cookie = sessionCookieFromHeaders(login.headers);

  const response = await fetch(`${baseUrl}/api/storage-cleanup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(requestBody(args)),
  });
  const result = await jsonOrThrow(response);
  console.log(JSON.stringify(result, null, 2));
  if (hardDriftCount(result) > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

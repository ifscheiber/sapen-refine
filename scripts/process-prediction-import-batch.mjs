#!/usr/bin/env node

import {
  markDeprecatedPasswordFlag,
  resolveSecretInput,
} from "./secret-input.mjs";

const DEFAULT_BASE_URL =
  process.env.SAPEN_JOB_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
const DEFAULT_PROCESSOR_ID =
  process.env.PREDICTION_IMPORT_PROCESSOR_ID || "sapen-annotate-worker";
const DEFAULT_INTERVAL_SECONDS = readPositiveIntegerEnv(
  "PREDICTION_BATCH_WORKER_INTERVAL_SECONDS",
  30,
);

function readPositiveIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

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
    batchId: "",
    limit: process.env.PREDICTION_BATCH_PROCESS_LIMIT
      ? parsePositiveInteger(process.env.PREDICTION_BATCH_PROCESS_LIMIT, "PREDICTION_BATCH_PROCESS_LIMIT")
      : undefined,
    maxJobs: process.env.PREDICTION_BATCH_MAX_JOBS_PER_TICK
      ? parsePositiveInteger(process.env.PREDICTION_BATCH_MAX_JOBS_PER_TICK, "PREDICTION_BATCH_MAX_JOBS_PER_TICK")
      : undefined,
    email: process.env.SAPEN_JOB_EMAIL || "",
    password: "",
    passwordFile: "",
    passwordStdin: false,
    processorId: DEFAULT_PROCESSOR_ID,
    loop: false,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    recoverStale: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--batch" && next) {
      args.batchId = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = parsePositiveInteger(next, "--limit");
      index += 1;
    } else if (arg === "--max-jobs" && next) {
      args.maxJobs = parsePositiveInteger(next, "--max-jobs");
      index += 1;
    } else if (arg === "--base-url" && next) {
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
    } else if (arg === "--processor-id" && next) {
      args.processorId = next;
      index += 1;
    } else if (arg === "--interval" && next) {
      args.intervalSeconds = parsePositiveInteger(next, "--interval");
      index += 1;
    } else if (arg === "--loop") {
      args.loop = true;
    } else if (arg === "--recover-stale") {
      args.recoverStale = true;
    } else if (arg === "--no-recover-stale") {
      args.recoverStale = false;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!args.email) throw new Error("--email or SAPEN_JOB_EMAIL is required");
  args.password = resolveSecretInput({
    cliPassword: args.password,
    cliPasswordFile: args.passwordFile,
    cliPasswordStdin: args.passwordStdin,
    envPassword: process.env.SAPEN_JOB_PASSWORD,
    envPasswordFile: process.env.SAPEN_JOB_PASSWORD_FILE,
    envPasswordName: "SAPEN_JOB_PASSWORD",
    envPasswordFileName: "SAPEN_JOB_PASSWORD_FILE",
    secretDescription: "operator password",
  }).secret;
  if (!args.processorId.trim()) throw new Error("--processor-id must not be empty");
  return args;
}

function printHelp() {
  console.log(`Usage:
npm run jobs:prediction-import -- [options]

Options:
  --batch <batch-id>      Process one batch instead of due batches.
  --limit <n>             Maximum batch items for this pass.
  --max-jobs <n>          Maximum due batches for this pass.
  --base-url <url>        App base URL. Defaults to SAPEN_JOB_BASE_URL, APP_BASE_URL, or http://localhost:3000.
  --email <email>         Operator account email. Defaults to SAPEN_JOB_EMAIL.
  --password-file <path>  Read the operator password from a mounted secret file.
  --password-stdin        Read the operator password from stdin.
  --processor-id <id>     Non-secret processor label.
  --interval <seconds>    Loop interval.
  --loop                  Run continuously.
  --recover-stale         Recover stale PROCESSING items. Default.
  --no-recover-stale      Do not recover stale PROCESSING items.
  --help                  Show this help.

Secret input precedence:
  --password-file, SAPEN_JOB_PASSWORD_FILE, SAPEN_JOB_PASSWORD, --password-stdin, deprecated --password.

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

async function login(baseUrl, args) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: args.email, password: args.password }),
  });
  await jsonOrThrow(response);
  return sessionCookieFromHeaders(response.headers);
}

function requestBody(args) {
  return {
    ...(args.limit ? { limit: args.limit } : {}),
    ...(args.maxJobs ? { maxJobs: args.maxJobs } : {}),
    processorId: args.processorId,
    recoverStale: args.recoverStale,
  };
}

async function runOnce(baseUrl, args, cookie) {
  const endpoint = args.batchId
    ? `/api/prediction-import-batches/${encodeURIComponent(args.batchId)}/process`
    : "/api/prediction-import-batches/process-due";
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(requestBody(args)),
  });
  return jsonOrThrow(response);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const baseUrl = args.baseUrl.replace(/\/$/, "");
  let cookie = await login(baseUrl, args);

  do {
    try {
      const result = await runOnce(baseUrl, args, cookie);
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: args.batchId ? "batch" : "due",
        result,
      }, null, 2));
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }));
      if (!args.loop) throw error;
      cookie = await login(baseUrl, args).catch(() => cookie);
    }

    if (args.loop) {
      await sleep(args.intervalSeconds * 1000);
    }
  } while (args.loop);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

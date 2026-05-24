#!/usr/bin/env node

const DEFAULT_BASE_URL =
  process.env.SAPEN_JOB_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
const DEFAULT_PROCESSOR_ID =
  process.env.EXPORT_JOB_PROCESSOR_ID || "sapen-annotate-export-worker";
const DEFAULT_INTERVAL_SECONDS = readPositiveIntegerEnv("EXPORT_JOB_WORKER_INTERVAL_SECONDS", 30);

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
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    maxJobs: process.env.EXPORT_JOB_MAX_JOBS_PER_TICK
      ? parsePositiveInteger(process.env.EXPORT_JOB_MAX_JOBS_PER_TICK, "EXPORT_JOB_MAX_JOBS_PER_TICK")
      : undefined,
    email: process.env.SAPEN_JOB_EMAIL || "",
    password: process.env.SAPEN_JOB_PASSWORD || "",
    processorId: DEFAULT_PROCESSOR_ID,
    loop: false,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    recoverStale: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--max-jobs" && next) {
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
      index += 1;
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
  if (!args.password) throw new Error("--password or SAPEN_JOB_PASSWORD is required");
  if (!args.processorId.trim()) throw new Error("--processor-id must not be empty");
  return args;
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
    ...(args.maxJobs ? { maxJobs: args.maxJobs } : {}),
    processorId: args.processorId,
    recoverStale: args.recoverStale,
  };
}

async function runOnce(baseUrl, args, cookie) {
  const response = await fetch(`${baseUrl}/api/export-jobs/process-due`, {
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
  const baseUrl = args.baseUrl.replace(/\/$/, "");
  let cookie = await login(baseUrl, args);

  do {
    try {
      const result = await runOnce(baseUrl, args, cookie);
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: "due",
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

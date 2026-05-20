#!/usr/bin/env node

const DEFAULT_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    batchId: "",
    limit: undefined,
    email: process.env.SAPEN_JOB_EMAIL || "",
    password: process.env.SAPEN_JOB_PASSWORD || "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--batch" && next) {
      args.batchId = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      args.limit = Number(next);
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
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!args.batchId) throw new Error("--batch is required");
  if (!args.email) throw new Error("--email or SAPEN_JOB_EMAIL is required");
  if (!args.password) throw new Error("--password or SAPEN_JOB_PASSWORD is required");
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive integer");
  }
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl.replace(/\/$/, "");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: args.email, password: args.password }),
  });
  await jsonOrThrow(login);
  const cookie = sessionCookieFromHeaders(login.headers);

  const processResponse = await fetch(`${baseUrl}/api/prediction-import-batches/${args.batchId}/process`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ limit: args.limit }),
  });
  const result = await jsonOrThrow(processResponse);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

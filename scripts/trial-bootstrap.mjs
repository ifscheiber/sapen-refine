import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { resolveOperatorActorContext } from "./operator-actor-context.mjs";
import { ensureTrialBootstrap } from "./trial-bootstrap-lib.mjs";

const { Pool } = pg;

function usage() {
  console.log(`Usage:
node scripts/trial-bootstrap.mjs [--operator-email operator@example.com] [--allow-local-system-actor]

Creates trial-safe global roles and the default label schema without demo users or projects.

Operator attribution:
  --operator-email <email>       Record the named operator in AuditLog details.actorContext.
  SAPEN_OPERATOR_EMAIL           Environment alternative to --operator-email.
  --allow-local-system-actor     Local-development only fallback to system:local-bootstrap.
  SAPEN_ALLOW_LOCAL_SYSTEM_ACTOR Environment alternative for the local fallback.
  SAPEN_REQUIRE_OPERATOR_ATTRIBUTION=true or NODE_ENV=production requires operator identity.
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--allow-local-system-actor") {
      args["allow-local-system-actor"] = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    if (key !== "operator-email") {
      throw new Error(`Unknown option: --${key}`);
    }

    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const actorContext = resolveOperatorActorContext({
    cliOperatorEmail: args["operator-email"],
    allowLocalSystemActor: Boolean(args["allow-local-system-actor"]),
    scriptLabel: "trial-bootstrap",
  });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    const result = await ensureTrialBootstrap(prisma, { actorContext });
    console.log("Trial bootstrap complete");
    console.log(`Roles: ${result.roles.map((role) => role.name).sort().join(", ")}`);
    console.log(`Label schema: ${result.labelSchema.name}@${result.labelSchema.version}`);
    console.log("No demo users or demo projects were created.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

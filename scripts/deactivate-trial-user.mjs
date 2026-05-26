import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  resolveOperatorActorContext,
  withAuditActorContext,
} from "./operator-actor-context.mjs";

const { Pool } = pg;

function usage() {
  console.log(`Usage:
node scripts/deactivate-trial-user.mjs --email tester@example.com [--reason 'left trial'] [operator attribution]

Disables a named trial user without deleting the user row or historical attribution.

Operator attribution:
  --operator-email <email>       Must identify an active global ADMIN operator.
  SAPEN_OPERATOR_EMAIL           Environment alternative to --operator-email.
  --allow-local-system-actor     Local-development only fallback to system:local-bootstrap.
  SAPEN_ALLOW_LOCAL_SYSTEM_ACTOR Environment alternative for the local fallback.
  SAPEN_REQUIRE_OPERATOR_ATTRIBUTION=true or NODE_ENV=production requires operator identity.
`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
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
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function normalizeEmail(value, field) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function normalizeReason(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

async function loadOperator(prisma, operatorEmail) {
  if (!operatorEmail) return null;
  const operator = await prisma.user.findUnique({
    where: { email: operatorEmail },
    select: {
      id: true,
      email: true,
      disabledAt: true,
      globalRoles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!operator || operator.disabledAt) {
    throw new Error(`Operator is not active: ${operatorEmail}`);
  }
  if (!operator.globalRoles.some((entry) => entry.role.name === "ADMIN")) {
    throw new Error(`Operator is not a global ADMIN: ${operatorEmail}`);
  }
  return operator;
}

async function targetHasAdminRole(prisma, userId) {
  const role = await prisma.userGlobalRole.findFirst({
    where: { userId, role: { name: "ADMIN" } },
    select: { userId: true },
  });
  return Boolean(role);
}

async function activeAdminCountExcluding(prisma, userId) {
  return prisma.userGlobalRole.count({
    where: {
      role: { name: "ADMIN" },
      user: {
        id: { not: userId },
        disabledAt: null,
      },
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const email = normalizeEmail(args.email, "--email");
  const operatorEmail = (args["operator-email"] ?? process.env.SAPEN_OPERATOR_EMAIL)?.trim().toLowerCase() || null;
  const reason = normalizeReason(args.reason);
  const actorContext = resolveOperatorActorContext({
    cliOperatorEmail: args["operator-email"],
    allowLocalSystemActor: Boolean(args["allow-local-system-actor"]),
    scriptLabel: "deactivate-trial-user",
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
    const operator = await loadOperator(prisma, operatorEmail);
    const target = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, disabledAt: true },
    });
    if (!target) throw new Error(`User not found: ${email}`);

    if (await targetHasAdminRole(prisma, target.id)) {
      const remainingAdmins = await activeAdminCountExcluding(prisma, target.id);
      if (remainingAdmins === 0) {
        throw new Error("Cannot disable the last active global ADMIN user");
      }
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const updated = target.disabledAt
        ? target
        : await tx.user.update({
            where: { id: target.id },
            data: {
              disabledAt: now,
              disabledById: operator?.id ?? null,
              disabledReason: reason,
            },
            select: { id: true, email: true, disabledAt: true },
          });
      const revoked = await tx.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (!target.disabledAt) {
        await tx.auditLog.create({
          data: {
            actorId: operator?.id ?? null,
            action: "USER_DEACTIVATED",
            entity: "User",
            entityId: target.id,
            details: withAuditActorContext({
              email: target.email,
              disabledReason: reason,
              revokedSessionCount: revoked.count,
            }, actorContext),
          },
        });
      }
      return { updated, revokedSessionCount: revoked.count, alreadyDisabled: Boolean(target.disabledAt) };
    });

    console.log(result.alreadyDisabled ? `Trial user already disabled: ${email}` : `Trial user disabled: ${email}`);
    console.log(`Revoked sessions: ${result.revokedSessionCount}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

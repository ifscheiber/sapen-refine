import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  resolveOperatorActorContext,
  withAuditActorContext,
} from "./operator-actor-context.mjs";
import { ensureGlobalRole } from "./trial-bootstrap-lib.mjs";
import {
  markDeprecatedPasswordFlag,
  resolveSecretInput,
} from "./secret-input.mjs";

const { Pool } = pg;

function usage() {
  console.log(`Usage:
node scripts/create-trial-user.mjs --email tester@example.com --name 'Tester Name' [secret options] [operator attribution] [--global-role USER|ADMIN] [--project-id demo_project] [--project-role LABELER]

Creates or updates a named trial user and optionally adds project membership.

Secret input precedence:
  --password-file, SAPEN_TRIAL_USER_PASSWORD_FILE, SAPEN_TRIAL_USER_PASSWORD, --password-stdin, deprecated --password.

Secret options:
  --password-file <path>  Read the trial user password from a mounted secret file.
  --password-stdin        Read the trial user password from stdin.
  --password <password>   Deprecated compatibility option. Prefer file, env, or stdin input.

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
    if (token === "--password-stdin") {
      args["password-stdin"] = true;
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
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    args[key] = value;
    if (key === "password") {
      markDeprecatedPasswordFlag(args);
    }
    i += 1;
  }
  return args;
}

function assertProjectRole(role) {
  const allowed = new Set(["OWNER", "QA", "LABELER", "VIEWER"]);
  if (!allowed.has(role)) {
    throw new Error(`Invalid project role "${role}". Use one of: ${[...allowed].join(", ")}`);
  }
}

function assertGlobalRole(role) {
  const allowed = new Set(["USER", "ADMIN"]);
  if (!allowed.has(role)) {
    throw new Error(`Invalid global role "${role}". Use one of: ${[...allowed].join(", ")}`);
  }
}

async function ensureRequestedGlobalRoles(prisma, userId, role) {
  await ensureGlobalRole(prisma, userId, "USER");
  if (role === "ADMIN") {
    await ensureGlobalRole(prisma, userId, "ADMIN");
    return ["USER", "ADMIN"];
  }
  return ["USER"];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const email = args.email?.trim().toLowerCase();
  const name = args.name?.trim();
  const projectId = args["project-id"]?.trim();
  const projectRole = args["project-role"]?.trim() || "LABELER";
  const globalRole = args["global-role"]?.trim() || "USER";

  if (!email) {
    usage();
    process.exit(1);
  }
  const actorContext = resolveOperatorActorContext({
    cliOperatorEmail: args["operator-email"],
    allowLocalSystemActor: Boolean(args["allow-local-system-actor"]),
    scriptLabel: "create-trial-user",
  });
  const password = resolveSecretInput({
    cliPassword: args.password,
    cliPasswordFile: args["password-file"],
    cliPasswordStdin: Boolean(args["password-stdin"]),
    envPassword: process.env.SAPEN_TRIAL_USER_PASSWORD,
    envPasswordFile: process.env.SAPEN_TRIAL_USER_PASSWORD_FILE,
    envPasswordName: "SAPEN_TRIAL_USER_PASSWORD",
    envPasswordFileName: "SAPEN_TRIAL_USER_PASSWORD_FILE",
    secretDescription: "trial user password",
  }).secret;
  assertProjectRole(projectRole);
  assertGlobalRole(globalRole);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { disabledAt: true },
    });
    if (existingUser?.disabledAt) {
      throw new Error(`User is disabled and cannot be updated by trial:user:create: ${email}`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name || undefined,
        passwordHash,
      },
      create: {
        email,
        name: name || undefined,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    const globalRoles = await ensureRequestedGlobalRoles(prisma, user.id, globalRole);

    if (projectId) {
      const project = await prisma.annotationProject.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
      });
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      await prisma.annotationProjectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        update: { role: projectRole },
        create: { projectId: project.id, userId: user.id, role: projectRole },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: "TRIAL_USER_UPSERT",
        entity: "User",
        entityId: user.id,
        details: withAuditActorContext({
          actorKind: "TRIAL_USER_CLI",
          email: user.email,
          globalRoles,
          projectId: projectId ?? null,
          projectRole: projectId ? projectRole : null,
        }, actorContext),
      },
    });

    console.log(`Trial user ready: ${user.email}`);
    console.log(`Global roles: ${globalRoles.join(", ")}`);
    if (projectId) {
      console.log(`Project membership: ${projectId} / ${projectRole}`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

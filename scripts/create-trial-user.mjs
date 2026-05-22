import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { ensureGlobalRole } from "./trial-bootstrap-lib.mjs";

const { Pool } = pg;

function usage() {
  console.error(`Usage:
node scripts/create-trial-user.mjs --email tester@example.com --password '<password>' --name 'Tester Name' [--global-role USER|ADMIN] [--project-id demo_project] [--project-role LABELER]

Creates or updates a named trial user and optionally adds project membership.
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    args[key] = value;
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
  const email = args.email?.trim().toLowerCase();
  const password = args.password;
  const name = args.name?.trim();
  const projectId = args["project-id"]?.trim();
  const projectRole = args["project-role"]?.trim() || "LABELER";
  const globalRole = args["global-role"]?.trim() || "USER";

  if (!email || !password) {
    usage();
    process.exit(1);
  }
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
        details: {
          actorKind: "TRIAL_USER_CLI",
          email: user.email,
          globalRoles,
          projectId: projectId ?? null,
          projectRole: projectId ? projectRole : null,
        },
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

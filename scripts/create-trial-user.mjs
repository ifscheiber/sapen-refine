import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const { Pool } = pg;

function usage() {
  console.error(`Usage:
node scripts/create-trial-user.mjs --email tester@example.com --password '<password>' --name 'Tester Name' [--project-id demo_project] [--project-role LABELER]

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

async function ensureGlobalUserRole(prisma, userId) {
  const role = await prisma.role.upsert({
    where: { name: "USER" },
    update: {},
    create: { name: "USER" },
  });

  await prisma.userGlobalRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email?.trim().toLowerCase();
  const password = args.password;
  const name = args.name?.trim();
  const projectId = args["project-id"]?.trim();
  const projectRole = args["project-role"]?.trim() || "LABELER";

  if (!email || !password) {
    usage();
    process.exit(1);
  }
  assertProjectRole(projectRole);

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

    await ensureGlobalUserRole(prisma, user.id);

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
        details: { email: user.email, projectId: projectId ?? null, projectRole },
      },
    });

    console.log(`Trial user ready: ${user.email}`);
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

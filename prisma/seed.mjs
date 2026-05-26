import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { ensureDefaultLabelSchema, ensureGlobalRole, ensureRole } from "../scripts/trial-bootstrap-lib.mjs";

const { Pool } = pg;

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function upsertUser({ email, name, password }) {
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.upsert({
    where: { email },
    update: { name: name ?? undefined, passwordHash },
    create: { email, name, passwordHash },
  });
}

async function main() {
  await ensureRole(prisma, "ADMIN");
  await ensureRole(prisma, "USER");

  const admin = await upsertUser({
    email: "admin@sapen.local",
    name: "Admin",
    password: "admin1234",
  });

  const labeler = await upsertUser({
    email: "labeler@sapen.local",
    name: "Labeler",
    password: "labeler1234",
  });

  await ensureGlobalRole(prisma, admin.id, "ADMIN");
  await ensureGlobalRole(prisma, admin.id, "USER");
  await ensureGlobalRole(prisma, labeler.id, "USER");

  const labelSchema = await ensureDefaultLabelSchema(prisma, admin.id);

  const project = await prisma.annotationProject.upsert({
    where: { id: "demo_project" },
    update: {
      name: "Demo Project",
      labelSchemaVersionId: labelSchema.id,
    },
    create: {
      id: "demo_project",
      name: "Demo Project",
      labelSchemaVersionId: labelSchema.id,
      createdById: admin.id,
    },
  });

  await prisma.annotationProjectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: { role: "OWNER" },
    create: { projectId: project.id, userId: admin.id, role: "OWNER" },
  });

  await prisma.annotationProjectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: labeler.id } },
    update: { role: "LABELER" },
    create: { projectId: project.id, userId: labeler.id, role: "LABELER" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED",
      entity: "System",
      entityId: project.id,
      details: {
        users: [admin.email, labeler.email],
        project: project.name,
        labelSchemaVersionId: labelSchema.id,
      },
    },
  });

  console.log("Seed complete");
  console.log("Admin:   admin@sapen.local / admin1234");
  console.log("Labeler: labeler@sapen.local / labeler1234");
  console.log(`Project: ${project.name} (${project.id})`);
  console.log(`Label schema: ${labelSchema.name}@${labelSchema.version}`);
}

main()
  .catch((e) => {
    console.error("Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

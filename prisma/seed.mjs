import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const { Pool } = pg;

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function upsertRole(name) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function upsertUser({ email, name, password }) {
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.upsert({
    where: { email },
    update: { name: name ?? undefined, passwordHash },
    create: { email, name, passwordHash },
  });
}

async function ensureGlobalRole(userId, roleId) {
  await prisma.userGlobalRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

async function main() {
  const adminRole = await upsertRole("ADMIN");
  const userRole = await upsertRole("USER");

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

  await ensureGlobalRole(admin.id, adminRole.id);
  await ensureGlobalRole(admin.id, userRole.id);
  await ensureGlobalRole(labeler.id, userRole.id);

  const project = await prisma.project.upsert({
    where: { id: "demo_project" },
    update: { name: "Demo Project" },
    create: { id: "demo_project", name: "Demo Project" },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: { role: "OWNER" },
    create: { projectId: project.id, userId: admin.id, role: "OWNER" },
  });

  await prisma.projectMember.upsert({
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
      details: { users: [admin.email, labeler.email], project: project.name },
    },
  });

  console.log("✅ Seed complete");
  console.log("Admin:   admin@sapen.local / admin1234");
  console.log("Labeler: labeler@sapen.local / labeler1234");
  console.log(`Project: ${project.name} (${project.id})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

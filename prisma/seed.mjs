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

async function ensureDefaultLabelSchema(createdById) {
  const schema = await prisma.labelSchemaVersion.upsert({
    where: {
      name_version: {
        name: "sapen-annotate-default",
        version: "1.0.0",
      },
    },
    update: {
      status: "ACTIVE",
      isDefault: true,
    },
    create: {
      name: "sapen-annotate-default",
      version: "1.0.0",
      status: "ACTIVE",
      isDefault: true,
      createdById,
    },
  });

  await prisma.labelSchemaVersion.updateMany({
    where: { id: { not: schema.id }, isDefault: true },
    data: { isDefault: false },
  });

  const labels = [
    {
      stableId: "background",
      byteValue: 0,
      displayName: "Background",
      semanticMeaning: "Background or non-annotated pixel in a semantic material mask.",
      applicability: "SEMANTIC_MASK",
      colorToken: "mask.background",
      sortOrder: 0,
      isTrainable: false,
    },
    {
      stableId: "sapwood",
      byteValue: 1,
      displayName: "Sapwood",
      semanticMeaning: "Sapwood material region.",
      applicability: "SEMANTIC_MASK",
      colorToken: "mask.sapwood",
      sortOrder: 10,
      isTrainable: true,
    },
    {
      stableId: "heartwood",
      byteValue: 2,
      displayName: "Heartwood",
      semanticMeaning: "Heartwood material region.",
      applicability: "SEMANTIC_MASK",
      colorToken: "mask.heartwood",
      sortOrder: 20,
      isTrainable: true,
    },
    {
      stableId: "copper",
      byteValue: 3,
      displayName: "Copper",
      semanticMeaning: "Copper-stained or penetrated material region; not physical slice support geometry.",
      applicability: "SEMANTIC_MASK",
      colorToken: "mask.copper",
      sortOrder: 30,
      isTrainable: true,
    },
    {
      stableId: "unknown",
      byteValue: 4,
      displayName: "Unknown",
      semanticMeaning: "Unknown material region that should be visible for review/export decisions.",
      applicability: "SEMANTIC_MASK",
      colorToken: "mask.unknown",
      sortOrder: 40,
      isTrainable: false,
    },
    {
      stableId: "slice_support",
      byteValue: 10,
      displayName: "Slice support",
      semanticMeaning: "Physical wood-slice support geometry; distinct from copper semantic material.",
      applicability: "SUPPORT_MASK",
      colorToken: "mask.sliceSupport",
      sortOrder: 100,
      isTrainable: true,
    },
    {
      stableId: "review_required",
      byteValue: null,
      displayName: "Review required",
      semanticMeaning: "Flag indicating a label/artifact requires human review.",
      applicability: "REVIEW_FLAG",
      colorToken: "status.reviewRequired",
      sortOrder: 200,
      isTrainable: false,
    },
    {
      stableId: "slice_class.sap_heartwood_slice",
      byteValue: null,
      displayName: "Sapwood/heartwood slice",
      semanticMeaning: "Slice classification for sapwood/heartwood annotation workflows.",
      applicability: "SLICE_CLASSIFICATION",
      colorToken: "sliceClass.sapHeartwood",
      sortOrder: 300,
      isTrainable: true,
    },
    {
      stableId: "slice_class.copper_slice",
      byteValue: null,
      displayName: "Copper slice",
      semanticMeaning: "Slice classification for copper annotation workflows.",
      applicability: "SLICE_CLASSIFICATION",
      colorToken: "sliceClass.copper",
      sortOrder: 310,
      isTrainable: true,
    },
    {
      stableId: "slice_class.unknown",
      byteValue: null,
      displayName: "Unknown slice",
      semanticMeaning: "Slice classification for unresolved slice type.",
      applicability: "SLICE_CLASSIFICATION",
      colorToken: "sliceClass.unknown",
      sortOrder: 320,
      isTrainable: false,
    },
    {
      stableId: "slice_class.review_required",
      byteValue: null,
      displayName: "Slice review required",
      semanticMeaning: "Slice classification for items that need reviewer decision.",
      applicability: "SLICE_CLASSIFICATION",
      colorToken: "sliceClass.reviewRequired",
      sortOrder: 330,
      isTrainable: false,
    },
  ];

  for (const label of labels) {
    await prisma.labelDefinition.upsert({
      where: {
        schemaVersionId_stableId: {
          schemaVersionId: schema.id,
          stableId: label.stableId,
        },
      },
      update: label,
      create: {
        schemaVersionId: schema.id,
        ...label,
      },
    });
  }

  return schema;
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

  const labelSchema = await ensureDefaultLabelSchema(admin.id);

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

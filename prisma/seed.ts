import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function upsertRole(name: "ADMIN" | "USER") {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function upsertUser(params: {
  email: string;
  name?: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 12);

  return prisma.user.upsert({
    where: { email: params.email },
    update: { name: params.name ?? undefined, passwordHash },
    create: { email: params.email, name: params.name, passwordHash },
  });
}

async function ensureGlobalRole(userId: string, roleId: string) {
  await prisma.userGlobalRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

async function ensureDefaultLabelSchema(createdById: string) {
  const schema = await prisma.labelSchemaVersion.upsert({
    where: {
      name_version: {
        name: "sapen-annotate-default",
        version: "1.0.0",
      },
    },
    update: { status: "ACTIVE", isDefault: true },
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
    ["background", 0, "Background", "Background or non-annotated pixel in a semantic material mask.", "SEMANTIC_MASK", "mask.background", 0, false],
    ["sapwood", 1, "Sapwood", "Sapwood material region.", "SEMANTIC_MASK", "mask.sapwood", 10, true],
    ["heartwood", 2, "Heartwood", "Heartwood material region.", "SEMANTIC_MASK", "mask.heartwood", 20, true],
    ["copper", 3, "Copper", "Copper-stained or penetrated material region; not physical slice support geometry.", "SEMANTIC_MASK", "mask.copper", 30, true],
    ["unknown", 4, "Unknown", "Unknown material region that should be visible for review/export decisions.", "SEMANTIC_MASK", "mask.unknown", 40, false],
    ["slice_support", 10, "Slice support", "Physical wood-slice support geometry; distinct from copper semantic material.", "SUPPORT_MASK", "mask.sliceSupport", 100, true],
    ["review_required", null, "Review required", "Flag indicating a label/artifact requires human review.", "REVIEW_FLAG", "status.reviewRequired", 200, false],
    ["slice_class.sap_heartwood_slice", null, "Sapwood/heartwood slice", "Slice classification for sapwood/heartwood annotation workflows.", "SLICE_CLASSIFICATION", "sliceClass.sapHeartwood", 300, true],
    ["slice_class.copper_slice", null, "Copper slice", "Slice classification for copper annotation workflows.", "SLICE_CLASSIFICATION", "sliceClass.copper", 310, true],
    ["slice_class.unknown", null, "Unknown slice", "Slice classification for unresolved slice type.", "SLICE_CLASSIFICATION", "sliceClass.unknown", 320, false],
    ["slice_class.review_required", null, "Slice review required", "Slice classification for items that need reviewer decision.", "SLICE_CLASSIFICATION", "sliceClass.reviewRequired", 330, false],
  ] as const;

  for (const [
    stableId,
    byteValue,
    displayName,
    semanticMeaning,
    applicability,
    colorToken,
    sortOrder,
    isTrainable,
  ] of labels) {
    await prisma.labelDefinition.upsert({
      where: {
        schemaVersionId_stableId: {
          schemaVersionId: schema.id,
          stableId,
        },
      },
      update: {
        stableId,
        byteValue,
        displayName,
        semanticMeaning,
        applicability,
        colorToken,
        sortOrder,
        isTrainable,
      },
      create: {
        schemaVersionId: schema.id,
        stableId,
        byteValue,
        displayName,
        semanticMeaning,
        applicability,
        colorToken,
        sortOrder,
        isTrainable,
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
    update: { name: "Demo Project", labelSchemaVersionId: labelSchema.id },
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

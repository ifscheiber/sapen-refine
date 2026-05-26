export const DEFAULT_LABEL_SCHEMA = {
  name: "sapen-annotate-default",
  version: "1.0.0",
};

export const DEFAULT_LABEL_DEFINITIONS = [
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

export async function ensureRole(prisma, name) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

export async function ensureGlobalRole(prisma, userId, roleName) {
  const role = await ensureRole(prisma, roleName);
  await prisma.userGlobalRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
  return role;
}

export async function ensureDefaultLabelSchema(prisma, createdById = null) {
  const schema = await prisma.labelSchemaVersion.upsert({
    where: {
      name_version: DEFAULT_LABEL_SCHEMA,
    },
    update: {
      status: "ACTIVE",
      isDefault: true,
    },
    create: {
      ...DEFAULT_LABEL_SCHEMA,
      status: "ACTIVE",
      isDefault: true,
      createdById,
    },
  });

  await prisma.labelSchemaVersion.updateMany({
    where: { id: { not: schema.id }, isDefault: true },
    data: { isDefault: false },
  });

  for (const label of DEFAULT_LABEL_DEFINITIONS) {
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

export async function ensureTrialBootstrap(prisma, { actorId = null, actorContext } = {}) {
  const adminRole = await ensureRole(prisma, "ADMIN");
  const userRole = await ensureRole(prisma, "USER");
  const labelSchema = await ensureDefaultLabelSchema(prisma, actorId);

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "TRIAL_BOOTSTRAP",
      entity: "System",
      entityId: labelSchema.id,
      details: {
        ...(actorContext ? { actorContext } : {}),
        roles: [adminRole.name, userRole.name],
        labelSchema: {
          id: labelSchema.id,
          name: labelSchema.name,
          version: labelSchema.version,
        },
      },
    },
  });

  return { roles: [adminRole, userRole], labelSchema };
}

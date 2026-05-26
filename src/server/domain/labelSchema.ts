import { prisma } from "@/server/db";

export async function getProjectLabelSchemaVersionId(projectId: string): Promise<string> {
  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: { labelSchemaVersionId: true },
  });

  if (project?.labelSchemaVersionId) {
    return project.labelSchemaVersionId;
  }

  const fallback = await prisma.labelSchemaVersion.findFirst({
    where: { isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });

  if (!fallback) {
    throw new Error("DEFAULT_LABEL_SCHEMA_MISSING");
  }

  return fallback.id;
}

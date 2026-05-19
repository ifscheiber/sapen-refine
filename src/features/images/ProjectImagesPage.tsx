import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { requireProjectRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { ImagesClient } from "./ImagesClient";

export async function ProjectImagesPage({ projectId }: { projectId: string }) {
  const { membership } = await requireProjectRole(projectId, [
    "OWNER",
    "QA",
    "LABELER",
    "VIEWER",
  ]);

  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");

  return (
    <AppMain>
      <AppPageHeader title={project.name} description={`Images · Role: ${membership.role}`} />
      <ImagesClient projectId={project.id} canUpload={membership.role !== "VIEWER"} />
    </AppMain>
  );
}

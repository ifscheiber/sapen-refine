import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { ProjectOperationsNav } from "@/features/projects/ProjectOperationsNav";
import { canUploadImage, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { ImagesClient } from "./ImagesClient";

export async function ProjectImagesPage({ projectId }: { projectId: string }) {
  const { membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const project = await prisma.annotationProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");

  return (
    <AppMain>
      <AppPageHeader title="Project images" description={`${project.name} · Role: ${membership.role}`} />
      <ProjectOperationsNav projectId={project.id} current="images" />
      <ImagesClient projectId={project.id} canUpload={canUploadImage(membership.role)} />
    </AppMain>
  );
}

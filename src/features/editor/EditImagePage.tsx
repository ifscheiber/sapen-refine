import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { canAnnotate, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import EditorClient from "./EditorClient";

export async function EditImagePage({
  projectId,
  imageId,
}: {
  projectId: string;
  imageId: string;
}) {
  const { membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, filename: true, contentType: true, size: true, projectId: true },
  });

  if (!image || image.projectId !== projectId) {
    throw new Error("IMAGE_NOT_FOUND");
  }

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`Edit: ${image.filename ?? image.id}`}
        description={`${image.contentType ?? "unknown type"} · ${image.size ?? 0} bytes · Role: ${membership.role}`}
      />
      <EditorClient projectId={projectId} imageId={image.id} canEdit={canAnnotate(membership.role)} />
    </AppMain>
  );
}

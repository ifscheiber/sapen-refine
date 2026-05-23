import { redirect } from "next/navigation";

import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { listSliceBoundingBoxesForUser } from "@/server/domain/sliceBboxes";

export async function ImageCropWorkflowEntryPage({
  projectId,
  imageId,
}: {
  projectId: string;
  imageId: string;
}) {
  const { user } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const image = await prisma.imageAsset.findFirst({
    where: { id: imageId, projectId },
    select: { id: true },
  });

  if (!image) {
    return (
      <AppMain>
        <AppPageHeader title="Image not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Image not found or no longer available"
          description="The image may have been removed, the database may have been rebuilt, or the copied link may be stale."
          actions={[
            { kind: "images", href: `/app/projects/${projectId}/images` },
            { kind: "project", href: `/app/projects/${projectId}` },
          ]}
        />
      </AppMain>
    );
  }

  const state = await listSliceBoundingBoxesForUser({ imageId: image.id, userId: user.id });
  const target =
    state.bboxWorkflow.bboxSetStatus === "BBOX_CONFIRMED"
      ? `/app/projects/${projectId}/images/${image.id}/crop/slices`
      : `/app/projects/${projectId}/images/${image.id}/crop/bboxes`;

  redirect(target);
}

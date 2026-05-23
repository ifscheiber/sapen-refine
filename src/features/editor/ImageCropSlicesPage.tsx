import Link from "next/link";
import { ArrowLeftIcon, PencilLineIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { listSliceBoundingBoxesForUser } from "@/server/domain/sliceBboxes";

export async function ImageCropSlicesPage({
  projectId,
  imageId,
}: {
  projectId: string;
  imageId: string;
}) {
  const { user, membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const image = await prisma.imageAsset.findFirst({
    where: { id: imageId, projectId },
    select: { id: true, filename: true, contentType: true },
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
  if (state.bboxWorkflow.bboxSetStatus !== "BBOX_CONFIRMED") {
    redirect(`/app/projects/${projectId}/images/${image.id}/crop/bboxes`);
  }

  return (
    <AppMain>
      <AppPageHeader
        title={`Slice annotation workspace: ${image.filename ?? image.id}`}
        description={`${image.contentType ?? "unknown type"} · ${state.boxes.length} slice work area${
          state.boxes.length === 1 ? "" : "s"
        } · Role: ${membership.role}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images/${image.id}/crop/bboxes`}>
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
                Edit BBoxes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images/${image.id}/edit`}>
                <PencilLineIcon className="size-4" aria-hidden="true" />
                Full editor
              </Link>
            </Button>
          </div>
        }
      />
      <div className="rounded-lg border border-border p-4 text-sm">
        <div className="font-medium">BBox set confirmed</div>
        <div className="mt-1 text-muted-foreground">
          {state.boxes.length} slice work area{state.boxes.length === 1 ? "" : "s"} ready.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.boxes.map((box, index) => (
            <div key={box.bboxVersionId} className="rounded-md border border-border px-3 py-2 text-muted-foreground">
              Slice {index + 1}: x {box.x}, y {box.y}, {box.width} x {box.height}
            </div>
          ))}
        </div>
      </div>
    </AppMain>
  );
}

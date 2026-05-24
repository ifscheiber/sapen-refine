import Link from "next/link";
import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react";

import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { evaluateTrialImageEditability } from "@/lib/imageSizePolicy";
import { canAnnotate, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import EditorClient from "./EditorClient";

export async function ImageCropBBoxesPage({
  projectId,
  imageId,
}: {
  projectId: string;
  imageId: string;
}) {
  const { membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const image = await prisma.imageAsset.findFirst({
    where: { id: imageId, projectId },
    select: { id: true, filename: true, contentType: true, size: true, width: true, height: true },
  });

  if (!image) {
    return (
      <AppMain>
        <AppPageHeader title="Image not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Image not found or no longer available"
          description="The image may have been removed, the database may have been rebuilt, or the copied link may be stale."
          actions={[{ kind: "project", href: `/app/projects/${projectId}` }]}
        />
      </AppMain>
    );
  }

  const editability = evaluateTrialImageEditability(image.width, image.height);
  const baseDescription =
    `${image.contentType ?? "unknown type"} · ${image.size ?? 0} bytes · ` +
    `${image.width && image.height ? `${image.width} x ${image.height}` : "dimensions missing"} · ` +
    `Role: ${membership.role}`;

  if (editability.status === "unsupported") {
    return (
      <AppMain>
        <AppPageHeader
          title={`Step 1: Mark slice work areas: ${image.filename ?? image.id}`}
          description={baseDescription}
          actions={
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images/${image.id}`}>
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
                Image
              </Link>
            </Button>
          }
        />
        <AppEmptyState
          title="Image is too large for the current BBox stage"
          description="The current source-image BBox stage uses the trial editor canvas and supports images up to 8000 x 6000 pixels."
        />
      </AppMain>
    );
  }

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`Step 1: Mark slice work areas: ${image.filename ?? image.id}`}
        description={
          editability.status === "large"
            ? `${baseDescription} · Large image: avoid multiple editor tabs, especially on iPad`
            : baseDescription
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images/${image.id}`}>
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
                Image
              </Link>
            </Button>
          </div>
        }
      />
      {editability.status === "large" && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          <AlertTriangleIcon className="size-4" aria-hidden="true" />
          Full-resolution BBox drawing may use significant browser memory on iPad.
        </div>
      )}
      <EditorClient
        projectId={projectId}
        imageId={image.id}
        canEdit={canAnnotate(membership.role)}
        workflowMode="bboxStage"
      />
    </AppMain>
  );
}

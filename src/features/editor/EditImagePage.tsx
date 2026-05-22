import Link from "next/link";
import { AlertTriangleIcon, ArrowLeftIcon } from "lucide-react";

import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { AppMain } from "@/components/shell/AppMain";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { evaluateTrialImageEditability } from "@/lib/imageSizePolicy";
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
    select: { id: true, filename: true, contentType: true, size: true, width: true, height: true, projectId: true },
  });

  if (!image || image.projectId !== projectId) {
    throw new Error("IMAGE_NOT_FOUND");
  }
  const editability = evaluateTrialImageEditability(image.width, image.height);
  const baseDescription = `${image.contentType ?? "unknown type"} · ${image.size ?? 0} bytes · Role: ${membership.role}`;

  if (editability.status === "unsupported") {
    return (
      <AppMain>
        <AppPageHeader
          title={`Edit: ${image.filename ?? image.id}`}
          description={baseDescription}
          actions={
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images`}>
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
                Images
              </Link>
            </Button>
          }
        />
        <AppEmptyState
          title="Image is too large for the trial editor"
          description="The full-resolution trial editor supports images up to 8000 x 6000 pixels. Larger images need a future tiled or downscaled workflow."
        />
      </AppMain>
    );
  }

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`Edit: ${image.filename ?? image.id}`}
        description={
          editability.status === "large"
            ? `${baseDescription} · Large image: avoid multiple editor tabs, especially on iPad`
            : baseDescription
        }
      />
      {editability.status === "large" && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          <AlertTriangleIcon className="size-4" aria-hidden="true" />
          Full-resolution editing may use significant browser memory on iPad.
        </div>
      )}
      <EditorClient projectId={projectId} imageId={image.id} canEdit={canAnnotate(membership.role)} />
    </AppMain>
  );
}

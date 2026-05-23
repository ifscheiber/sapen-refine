import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { canAnnotate, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { CropSupportEditorClient } from "./CropSupportEditorClient";

export async function CropSupportEditorPage({
  projectId,
  imageId,
  sliceInstanceId,
  cropId,
}: {
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  cropId: string;
}) {
  const { membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  const crop = await prisma.derivedSliceCrop.findFirst({
    where: {
      id: cropId,
      projectId,
      sourceImageId: imageId,
      sliceInstanceId,
    },
    select: {
      id: true,
      version: true,
      cropWidth: true,
      cropHeight: true,
      sourceX: true,
      sourceY: true,
      sourceWidth: true,
      sourceHeight: true,
      sourceImage: { select: { filename: true, contentType: true } },
    },
  });

  if (!crop) {
    return (
      <AppMain>
        <AppPageHeader title="Crop not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Crop not found or no longer available"
          description="The crop may have been removed, the database may have been rebuilt, or the copied link may be stale."
          actions={[
            { kind: "images", href: `/app/projects/${projectId}/images` },
            { kind: "project", href: `/app/projects/${projectId}` },
          ]}
        />
      </AppMain>
    );
  }

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`Support mask: ${crop.sourceImage.filename ?? crop.id}`}
        description={
          `${crop.sourceImage.contentType ?? "unknown type"} · crop v${crop.version} · ` +
          `${crop.cropWidth} x ${crop.cropHeight} · source x ${crop.sourceX}, y ${crop.sourceY}, ` +
          `${crop.sourceWidth} x ${crop.sourceHeight} · Role: ${membership.role}`
        }
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/projects/${projectId}/images/${imageId}/edit`}>
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Editor
            </Link>
          </Button>
        }
      />
      <CropSupportEditorClient cropId={cropId} canEdit={canAnnotate(membership.role)} />
    </AppMain>
  );
}

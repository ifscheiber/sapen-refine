import Link from "next/link";
import { LayoutDashboardIcon, ShieldIcon, SquareMousePointerIcon } from "lucide-react";

import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { canAnnotate, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { loadCropSliceNavigatorForUser } from "@/server/domain/cropSliceNavigator";
import { CropEditorSliceNavigatorRailClient } from "./CropEditorSliceNavigatorRailClient";
import { CropSemanticEditorClient } from "./CropSemanticEditorClient";
import type { CropSemanticMode } from "./editorTypes";

export async function CropSemanticEditorPage({
  projectId,
  imageId,
  sliceInstanceId,
  cropId,
  initialSemanticMode,
}: {
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  cropId: string;
  initialSemanticMode?: CropSemanticMode;
}) {
  const { user, membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

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

  const navigator = await loadCropSliceNavigatorForUser({
    projectId,
    imageId,
    userId: user.id,
    selectedSliceInstanceId: sliceInstanceId,
  });

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`Semantic crop mask: ${crop.sourceImage.filename ?? crop.id}`}
        description={
          `${crop.sourceImage.contentType ?? "unknown type"} · crop v${crop.version} · ` +
          `${crop.cropWidth} x ${crop.cropHeight} · source x ${crop.sourceX}, y ${crop.sourceY}, ` +
          `${crop.sourceWidth} x ${crop.sourceHeight} · Role: ${membership.role}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images/${imageId}/crop/slices/${sliceInstanceId}/crops/${cropId}`}>
                <LayoutDashboardIcon className="size-4" aria-hidden="true" />
                Workbench
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/projects/${projectId}/images/${imageId}/crop/bboxes`}>
                <SquareMousePointerIcon className="size-4" aria-hidden="true" />
                Edit BBoxes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                href={`/app/projects/${projectId}/images/${imageId}/crop/slices/${sliceInstanceId}/crops/${cropId}/support`}
              >
                <ShieldIcon className="size-4" aria-hidden="true" />
                Support
              </Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <CropSemanticEditorClient
          cropId={cropId}
          canEdit={canAnnotate(membership.role)}
          initialSemanticMode={initialSemanticMode}
        />
        <CropEditorSliceNavigatorRailClient navigator={navigator} editorMode="semantic" />
      </div>
    </AppMain>
  );
}

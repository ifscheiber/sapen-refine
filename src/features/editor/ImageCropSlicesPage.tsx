import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { Button } from "@/components/ui/button";
import { PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import {
  CropSliceNavigatorWorkflowError,
  loadCropSliceNavigatorForUser,
} from "@/server/domain/cropSliceNavigator";
import { ImageCropSliceNavigatorClient } from "./ImageCropSliceNavigatorClient";

export async function ImageCropSlicesPage({
  projectId,
  imageId,
  selectedSliceInstanceId,
}: {
  projectId: string;
  imageId: string;
  selectedSliceInstanceId?: string;
}) {
  const { user, membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  let navigator;
  try {
    navigator = await loadCropSliceNavigatorForUser({
      projectId,
      imageId,
      userId: user.id,
      selectedSliceInstanceId,
    });
  } catch (error) {
    if (!(error instanceof CropSliceNavigatorWorkflowError) || error.code !== "IMAGE_NOT_FOUND") {
      throw error;
    }
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

  if (navigator.bboxWorkflow.bboxSetStatus !== "BBOX_CONFIRMED") {
    redirect(navigator.routes.bboxesHref);
  }

  if (!selectedSliceInstanceId && navigator.slices[0]) {
    redirect(navigator.slices[0].selectedHref);
  }

  const selectedSlice = navigator.slices.find((slice) => slice.sliceInstanceId === selectedSliceInstanceId) ?? null;

  if (selectedSliceInstanceId && !selectedSlice) {
    return (
      <AppMain>
        <AppPageHeader title="Slice not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Slice not found or no longer available"
          description="The selected slice may have been replaced when the image-level BBox set changed."
          actions={[
            { kind: "project", href: `/app/projects/${projectId}` },
            { kind: "images", href: `/app/projects/${projectId}/images` },
          ]}
        />
      </AppMain>
    );
  }

  if (selectedSlice?.semanticHref) {
    redirect(selectedSlice.semanticHref);
  }

  return (
    <AppMain className="max-w-none">
      <AppPageHeader
        title={`Slice navigator: ${navigator.image.filename ?? navigator.image.id}`}
        description={
          `${navigator.image.contentType ?? "unknown type"} · ` +
          `${navigator.summary.totalSlices} slice${navigator.summary.totalSlices === 1 ? "" : "s"} · ` +
          `${navigator.summary.currentCropCount} current crop${navigator.summary.currentCropCount === 1 ? "" : "s"} · ` +
          `Role: ${membership.role}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={navigator.routes.bboxesHref}>
                <ArrowLeftIcon className="size-4" aria-hidden="true" />
                Edit BBoxes
              </Link>
            </Button>
          </div>
        }
      />
      {navigator.slices.length === 0 ? (
        <AppEmptyState
          title="No confirmed slice work areas"
          description="Return to the BBox stage and confirm at least one slice work area before using the navigator."
          action={
            <Button asChild>
              <Link href={navigator.routes.bboxesHref}>Open BBox stage</Link>
            </Button>
          }
        />
      ) : (
        <ImageCropSliceNavigatorClient navigator={navigator} />
      )}
    </AppMain>
  );
}

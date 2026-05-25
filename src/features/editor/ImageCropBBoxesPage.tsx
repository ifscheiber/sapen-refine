import { AlertTriangleIcon } from "lucide-react";

import { AppEmptyState } from "@/components/shell/AppEmptyState";
import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { evaluateTrialImageEditability } from "@/lib/imageSizePolicy";
import { canAnnotate, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import {
  CropSliceNavigatorWorkflowError,
  loadCropSliceNavigatorForUser,
} from "@/server/domain/cropSliceNavigator";
import { AnnotationEditorWorkspace } from "./AnnotationEditorWorkspace";
import EditorClient from "./EditorClient";

export async function ImageCropBBoxesPage({
  projectId,
  imageId,
}: {
  projectId: string;
  imageId: string;
}) {
  const { user, membership } = await requireWorkspaceProjectRole(projectId, PROJECT_READ_ROLES);

  let navigator;
  try {
    navigator = await loadCropSliceNavigatorForUser({
      projectId,
      imageId,
      userId: user.id,
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
          actions={[{ kind: "project", href: `/app/projects/${projectId}` }]}
        />
      </AppMain>
    );
  }

  const image = navigator.image;
  const editability = evaluateTrialImageEditability(image.width, image.height);

  if (editability.status === "unsupported") {
    return (
      <AnnotationEditorWorkspace
        navigator={navigator}
        activeTab="bboxes"
        modeLabel="BBoxes"
        cropContextLabel="BBox stage"
        main={
          <AppEmptyState
            title="Image is too large for the current BBox stage"
            description="The current source-image BBox stage uses the trial editor canvas and supports images up to 8000 x 6000 pixels."
          />
        }
      />
    );
  }

  return (
    <AnnotationEditorWorkspace
      navigator={navigator}
      activeTab="bboxes"
      modeLabel="BBoxes"
      cropContextLabel="BBox stage"
      main={
        <>
          {editability.status === "large" && (
            <div className="mb-3 flex items-center gap-2 border border-[var(--border-warning)] bg-[var(--warning-surface)] px-3 py-2 text-xs font-medium text-[var(--warning-text)]">
              <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
              Full-resolution BBox drawing may use significant browser memory on iPad.
            </div>
          )}
          <EditorClient
            projectId={projectId}
            imageId={image.id}
            canEdit={canAnnotate(membership.role)}
            workflowMode="bboxStage"
          />
        </>
      }
    />
  );
}

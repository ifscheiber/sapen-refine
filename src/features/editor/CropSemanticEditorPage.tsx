import { AppMain } from "@/components/shell/AppMain";
import { AppMissingResource } from "@/components/shell/AppMissingResource";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { canAnnotate, PROJECT_READ_ROLES } from "@/server/auth/policies";
import { requireWorkspaceProjectRole } from "@/server/auth/workspaceSession";
import { prisma } from "@/server/db";
import { loadCropSliceNavigatorForUser } from "@/server/domain/cropSliceNavigator";
import { AnnotationEditorWorkspace } from "./AnnotationEditorWorkspace";
import { CropSemanticEditorClient } from "./CropSemanticEditorClient";
import type { CropSemanticMode } from "./editorTypes";

function initialEditorModeLabel(mode: CropSemanticMode | undefined, target: "semantic" | "support" | undefined) {
  if (target === "support") return "Support mask";
  if (mode === "COPPER") return "Copper semantic";
  return "Sap/Heartwood semantic";
}

export async function CropSemanticEditorPage({
  projectId,
  imageId,
  sliceInstanceId,
  cropId,
  initialSemanticMode,
  initialTarget,
}: {
  projectId: string;
  imageId: string;
  sliceInstanceId: string;
  cropId: string;
  initialSemanticMode?: CropSemanticMode;
  initialTarget?: "semantic" | "support";
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
    },
  });

  if (!crop) {
    return (
      <AppMain>
        <AppPageHeader title="Crop not found" description="SaPen Annotate" />
        <AppMissingResource
          title="Crop not found or no longer available"
          description="The crop may have been removed, the database may have been rebuilt, or the copied link may be stale."
          actions={[{ kind: "project", href: `/app/projects/${projectId}` }]}
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
  const modeLabel = initialEditorModeLabel(initialSemanticMode, initialTarget);
  const baseEditorHref =
    `/app/projects/${projectId}/images/${imageId}/crop/slices/${sliceInstanceId}/crops/${cropId}`;

  return (
    <AnnotationEditorWorkspace
      navigator={navigator}
      activeTab={initialTarget === "support" ? "support" : "semantic"}
      modeLabel={modeLabel}
      cropContextLabel={`v${crop.version}`}
      semanticMode={initialSemanticMode ?? "SAP_HEARTWOOD"}
      editorBaseHref={baseEditorHref}
      main={
        <CropSemanticEditorClient
          cropId={cropId}
          canEdit={canAnnotate(membership.role)}
          initialSemanticMode={initialSemanticMode}
          initialTarget={initialTarget}
        />
      }
    />
  );
}

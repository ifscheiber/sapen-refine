import { Prisma, PrismaClient } from "@prisma/client";

import type {
  CropWorkflowCandidate,
  CropWorkflowNextAction,
  CropWorkflowReadinessStatus,
} from "@/server/domain/cropReadiness";
import type { ImageBBoxWorkflowStatus, SerializedImageBBoxWorkflow } from "@/server/domain/imageCropWorkflow";

type CropSliceNavigatorDb = PrismaClient | Prisma.TransactionClient;

export type CropSliceNavigatorCropStatus = "MISSING" | "CURRENT" | "STALE";
export type CropSliceNavigatorArtifactStatus = "MISSING" | "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type CropSliceNavigatorClassificationStatus =
  | "MISSING"
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

export type CropSliceNavigatorImage = {
  id: string;
  projectId: string;
  filename: string | null;
  contentType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  assetUrl: string;
};

export type CropSliceNavigatorCrop = {
  id: string;
  version: number;
  sliceInstanceId: string;
  bboxVersionId: string;
  cropWidth: number;
  cropHeight: number;
  paddingRequestedPx: number;
  paddingClipped: boolean;
  assetUrl: string;
  createdAt: string;
};

export type CropSliceNavigatorSlice = {
  index: number;
  label: string;
  sliceInstanceId: string;
  bboxVersionId: string;
  bboxVersion: number;
  bboxStatus: ImageBBoxWorkflowStatus;
  sourceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  sourceRectPercent: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  cropStatus: CropSliceNavigatorCropStatus;
  currentCrop: CropSliceNavigatorCrop | null;
  latestCrop: CropSliceNavigatorCrop | null;
  supportStatus: CropSliceNavigatorArtifactStatus;
  supportVersion: number | null;
  semanticStatus: CropSliceNavigatorArtifactStatus;
  semanticVersion: number | null;
  semanticMode: string | null;
  semanticFamilyState: string;
  semanticFamilyActiveMode: string | null;
  classificationStatus: CropSliceNavigatorClassificationStatus;
  classificationClass: string | null;
  classificationSource: string | null;
  classificationVersion: number | null;
  readinessStatus: CropWorkflowReadinessStatus;
  readinessReasons: string[];
  nextActions: CropWorkflowNextAction[];
  selectedHref: string;
  workbenchHref: string | null;
  supportHref: string | null;
  semanticHref: string | null;
};

export type CropSliceNavigatorModel = {
  projectId: string;
  imageId: string;
  image: CropSliceNavigatorImage;
  myRole: string;
  canGenerateCrop: boolean;
  bboxWorkflow: SerializedImageBBoxWorkflow;
  selectedSliceInstanceId: string | null;
  slices: CropSliceNavigatorSlice[];
  summary: {
    totalSlices: number;
    missingCropCount: number;
    currentCropCount: number;
    staleCropCount: number;
    readyCount: number;
    reviewRequiredCount: number;
  };
  routes: {
    bboxesHref: string;
    slicesHref: string;
  };
};

export class CropSliceNavigatorWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
  }
}

type SliceBBoxForNavigator = {
  bboxVersionId: string;
  sliceInstanceId: string;
  version: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function sortBBoxesForNavigation(left: SliceBBoxForNavigator, right: SliceBBoxForNavigator) {
  return left.y - right.y || left.x - right.x || left.sliceInstanceId.localeCompare(right.sliceInstanceId);
}

function sortCropCandidatesDesc(left: CropWorkflowCandidate, right: CropWorkflowCandidate) {
  return (
    right.crop.version - left.crop.version ||
    right.crop.createdAt.getTime() - left.crop.createdAt.getTime() ||
    right.crop.id.localeCompare(left.crop.id)
  );
}

function percent(value: number, total: number | null) {
  if (!Number.isFinite(total) || !total || total <= 0) return 0;
  return (value / total) * 100;
}

function artifactStatus(
  version: { reviewState: string; version: number } | null,
): { status: CropSliceNavigatorArtifactStatus; version: number | null } {
  if (!version) return { status: "MISSING", version: null };
  return {
    status: version.reviewState as CropSliceNavigatorArtifactStatus,
    version: version.version,
  };
}

function classificationStatus(
  version: {
    reviewState: string;
    version: number;
    class: string;
    source: string;
  } | null,
): {
  status: CropSliceNavigatorClassificationStatus;
  version: number | null;
  classificationClass: string | null;
  source: string | null;
} {
  if (!version) {
    return {
      status: "MISSING",
      version: null,
      classificationClass: null,
      source: null,
    };
  }
  return {
    status: version.reviewState as CropSliceNavigatorClassificationStatus,
    version: version.version,
    classificationClass: version.class,
    source: version.source,
  };
}

function serializeCrop(candidate: CropWorkflowCandidate): CropSliceNavigatorCrop {
  return {
    id: candidate.crop.id,
    version: candidate.crop.version,
    sliceInstanceId: candidate.crop.sliceInstanceId,
    bboxVersionId: candidate.crop.bboxVersionId,
    cropWidth: candidate.crop.cropWidth,
    cropHeight: candidate.crop.cropHeight,
    paddingRequestedPx: candidate.crop.paddingRequestedPx,
    paddingClipped: candidate.crop.paddingClipped,
    assetUrl: `/api/slice-crops/${candidate.crop.id}/asset`,
    createdAt: candidate.crop.createdAt.toISOString(),
  };
}

function summarizeSlices(slices: CropSliceNavigatorSlice[]) {
  return {
    totalSlices: slices.length,
    missingCropCount: slices.filter((slice) => slice.cropStatus === "MISSING").length,
    currentCropCount: slices.filter((slice) => slice.cropStatus === "CURRENT").length,
    staleCropCount: slices.filter((slice) => slice.cropStatus === "STALE").length,
    readyCount: slices.filter((slice) => slice.readinessStatus === "READY").length,
    reviewRequiredCount: slices.filter((slice) => slice.readinessStatus === "REVIEW_REQUIRED").length,
  };
}

export function buildCropSliceNavigatorModel(params: {
  projectId: string;
  image: Omit<CropSliceNavigatorImage, "assetUrl">;
  myRole: string;
  canGenerateCrop: boolean;
  bboxWorkflow: SerializedImageBBoxWorkflow;
  boxes: SliceBBoxForNavigator[];
  cropReadinessCandidates: CropWorkflowCandidate[];
  selectedSliceInstanceId?: string | null;
}): CropSliceNavigatorModel {
  const baseHref = `/app/projects/${params.projectId}/images/${params.image.id}/crop/slices`;
  const candidatesBySlice = new Map<string, CropWorkflowCandidate[]>();
  for (const candidate of params.cropReadinessCandidates) {
    const current = candidatesBySlice.get(candidate.crop.sliceInstanceId) ?? [];
    current.push(candidate);
    candidatesBySlice.set(candidate.crop.sliceInstanceId, current);
  }

  const slices = params.boxes
    .slice()
    .sort(sortBBoxesForNavigation)
    .map((box, index): CropSliceNavigatorSlice => {
      const candidates = (candidatesBySlice.get(box.sliceInstanceId) ?? []).slice().sort(sortCropCandidatesDesc);
      const currentCandidate = candidates.find((candidate) => candidate.crop.bboxVersionId === box.bboxVersionId) ?? null;
      const latestCandidate = candidates[0] ?? null;
      const support = artifactStatus(currentCandidate?.latestSupportMask ?? null);
      const semantic = artifactStatus(currentCandidate?.latestSemanticMask ?? null);
      const classification = classificationStatus(currentCandidate?.latestClassification ?? null);
      const currentCrop = currentCandidate ? serializeCrop(currentCandidate) : null;
      const latestCrop = latestCandidate ? serializeCrop(latestCandidate) : null;
      const cropStatus: CropSliceNavigatorCropStatus = currentCrop ? "CURRENT" : latestCrop ? "STALE" : "MISSING";
      const workbenchHref = currentCrop ? `${baseHref}/${box.sliceInstanceId}/crops/${currentCrop.id}` : null;
      const supportHref = workbenchHref ? `${workbenchHref}/support` : null;
      const semanticHref = workbenchHref ? `${workbenchHref}/semantic` : null;

      return {
        index: index + 1,
        label: `Slice ${index + 1}`,
        sliceInstanceId: box.sliceInstanceId,
        bboxVersionId: box.bboxVersionId,
        bboxVersion: box.version,
        bboxStatus: params.bboxWorkflow.bboxSetStatus,
        sourceRect: {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
        sourceRectPercent: {
          left: percent(box.x, params.image.width),
          top: percent(box.y, params.image.height),
          width: percent(box.width, params.image.width),
          height: percent(box.height, params.image.height),
        },
        cropStatus,
        currentCrop,
        latestCrop,
        supportStatus: support.status,
        supportVersion: support.version,
        semanticStatus: semantic.status,
        semanticVersion: semantic.version,
        semanticMode: currentCandidate?.latestSemanticMask?.cropSemanticMode ?? null,
        semanticFamilyState: currentCandidate?.semanticFamily?.state ?? "NONE",
        semanticFamilyActiveMode: currentCandidate?.semanticFamily?.activeMode ?? null,
        classificationStatus: classification.status,
        classificationClass: classification.classificationClass,
        classificationSource: classification.source,
        classificationVersion: classification.version,
        readinessStatus: currentCandidate?.readinessStatus ?? "NOT_READY",
        readinessReasons: currentCandidate?.readinessReasons ?? (cropStatus === "STALE" ? ["CROP_NOT_CURRENT"] : []),
        nextActions: currentCandidate?.nextActions ?? [],
        selectedHref: workbenchHref ?? `${baseHref}/${box.sliceInstanceId}`,
        workbenchHref,
        supportHref,
        semanticHref,
      };
    });

  const selectedSliceInstanceId =
    params.selectedSliceInstanceId && slices.some((slice) => slice.sliceInstanceId === params.selectedSliceInstanceId)
      ? params.selectedSliceInstanceId
      : null;

  return {
    projectId: params.projectId,
    imageId: params.image.id,
    image: {
      ...params.image,
      assetUrl: `/api/images/${params.image.id}/asset`,
    },
    myRole: params.myRole,
    canGenerateCrop: params.canGenerateCrop,
    bboxWorkflow: params.bboxWorkflow,
    selectedSliceInstanceId,
    slices,
    summary: summarizeSlices(slices),
    routes: {
      bboxesHref: `/app/projects/${params.projectId}/images/${params.image.id}/crop/bboxes`,
      slicesHref: baseHref,
    },
  };
}

export async function loadCropSliceNavigatorForUser(params: {
  projectId: string;
  imageId: string;
  userId: string;
  selectedSliceInstanceId?: string | null;
}, db?: CropSliceNavigatorDb) {
  const dbClient = db ?? (await import("@/server/db")).prisma;
  const { resolveCropWorkflowReadinessForUser } = await import("@/server/domain/cropReadiness");
  const { listSliceBoundingBoxesForUser } = await import("@/server/domain/sliceBboxes");
  const image = await dbClient.imageAsset.findFirst({
    where: { id: params.imageId, projectId: params.projectId },
    select: {
      id: true,
      projectId: true,
      filename: true,
      contentType: true,
      size: true,
      width: true,
      height: true,
    },
  });
  if (!image) throw new CropSliceNavigatorWorkflowError("IMAGE_NOT_FOUND");

  const [bboxState, cropReadiness] = await Promise.all([
    listSliceBoundingBoxesForUser({ imageId: image.id, userId: params.userId }, dbClient),
    resolveCropWorkflowReadinessForUser(
      { projectId: params.projectId, imageId: image.id, userId: params.userId },
      dbClient,
    ),
  ]);

  return buildCropSliceNavigatorModel({
    projectId: params.projectId,
    image,
    myRole: bboxState.myRole,
    canGenerateCrop: bboxState.canEdit,
    bboxWorkflow: bboxState.bboxWorkflow,
    boxes: bboxState.boxes,
    cropReadinessCandidates: cropReadiness.candidates,
    selectedSliceInstanceId: params.selectedSliceInstanceId,
  });
}

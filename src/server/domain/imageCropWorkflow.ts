import { type ImageCropBBoxSetStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";

type ImageCropWorkflowDb = PrismaClient | Prisma.TransactionClient;

export type ImageBBoxWorkflowStatus =
  | "NO_BBOXES"
  | "BBOX_DRAFT"
  | "BBOX_CONFIRMED"
  | "BBOX_NEEDS_UPDATE";

export const IMAGE_BBOX_WORKFLOW_STATE_SELECT = {
  id: true,
  bboxSetStatus: true,
  confirmedBBoxVersionIds: true,
  confirmedAt: true,
  confirmedBy: { select: { id: true, email: true, name: true } },
  lastBBoxChangeAt: true,
  lastBBoxVersionId: true,
} satisfies Prisma.ImageCropWorkflowStateSelect;

type ImageBBoxWorkflowState = Prisma.ImageCropWorkflowStateGetPayload<{
  select: typeof IMAGE_BBOX_WORKFLOW_STATE_SELECT;
}>;

export type SerializedImageBBoxWorkflow = {
  bboxSetStatus: ImageBBoxWorkflowStatus;
  persistedStatus: ImageCropBBoxSetStatus | null;
  activeBBoxCount: number;
  confirmedAt: Date | null;
  confirmedBy: { id: string; email: string; name: string | null } | null;
  lastBBoxChangeAt: Date | null;
  lastBBoxVersionId: string | null;
  canConfirm: boolean;
  canEdit: boolean;
};

function normalizeConfirmedIds(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").sort();
}

function sortedIds(values: string[]) {
  return values.slice().sort();
}

function sameIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function resolveImageBBoxWorkflowStatus(params: {
  state: ImageBBoxWorkflowState | null;
  activeBBoxVersionIds: string[];
}): ImageBBoxWorkflowStatus {
  const activeIds = sortedIds(params.activeBBoxVersionIds);
  if (activeIds.length === 0) return "NO_BBOXES";

  const state = params.state;
  if (!state) return "BBOX_DRAFT";
  if (state.bboxSetStatus === "DRAFT") return "BBOX_DRAFT";
  if (state.bboxSetStatus === "NEEDS_UPDATE") return "BBOX_NEEDS_UPDATE";

  const confirmedIds = normalizeConfirmedIds(state.confirmedBBoxVersionIds);
  return sameIdSet(confirmedIds, activeIds) ? "BBOX_CONFIRMED" : "BBOX_NEEDS_UPDATE";
}

export function serializeImageBBoxWorkflow(params: {
  state: ImageBBoxWorkflowState | null;
  activeBBoxVersionIds: string[];
  canEdit: boolean;
}): SerializedImageBBoxWorkflow {
  const bboxSetStatus = resolveImageBBoxWorkflowStatus(params);

  return {
    bboxSetStatus,
    persistedStatus: params.state?.bboxSetStatus ?? null,
    activeBBoxCount: params.activeBBoxVersionIds.length,
    confirmedAt: params.state?.confirmedAt ?? null,
    confirmedBy: params.state?.confirmedBy ?? null,
    lastBBoxChangeAt: params.state?.lastBBoxChangeAt ?? null,
    lastBBoxVersionId: params.state?.lastBBoxVersionId ?? null,
    canConfirm: params.canEdit && params.activeBBoxVersionIds.length > 0,
    canEdit: params.canEdit,
  };
}

export async function markImageBBoxWorkflowChanged(params: {
  db: ImageCropWorkflowDb;
  projectId: string;
  imageId: string;
  bboxVersionId: string;
  actorId: string;
}) {
  const existing = await params.db.imageCropWorkflowState.findUnique({
    where: { imageId: params.imageId },
    select: { id: true, bboxSetStatus: true },
  });
  const changedAt = new Date();

  if (!existing) {
    await params.db.imageCropWorkflowState.create({
      data: {
        projectId: params.projectId,
        imageId: params.imageId,
        bboxSetStatus: "DRAFT",
        lastBBoxChangeAt: changedAt,
        lastBBoxVersionId: params.bboxVersionId,
      },
    });
    return;
  }

  const nextStatus = existing.bboxSetStatus === "CONFIRMED" ? "NEEDS_UPDATE" : existing.bboxSetStatus;
  await params.db.imageCropWorkflowState.update({
    where: { id: existing.id },
    data: {
      bboxSetStatus: nextStatus,
      lastBBoxChangeAt: changedAt,
      lastBBoxVersionId: params.bboxVersionId,
    },
  });

  if (existing.bboxSetStatus === "CONFIRMED") {
    await recordAuditEvent(
      {
        action: "IMAGE_BBOX_SET_NEEDS_UPDATE",
        entity: "ImageCropWorkflowState",
        entityId: existing.id,
        actorId: params.actorId,
        details: {
          projectId: params.projectId,
          imageId: params.imageId,
          bboxVersionId: params.bboxVersionId,
          previousStatus: existing.bboxSetStatus,
          nextStatus,
        },
      },
      params.db,
    );
  }
}

export async function confirmImageBBoxWorkflowState(params: {
  db?: ImageCropWorkflowDb;
  projectId: string;
  imageId: string;
  activeBBoxVersionIds: string[];
  actorId: string;
}) {
  const db = params.db ?? prisma;
  const activeIds = sortedIds(params.activeBBoxVersionIds);
  const confirmedAt = new Date();

  const state = await db.imageCropWorkflowState.upsert({
    where: { imageId: params.imageId },
    create: {
      projectId: params.projectId,
      imageId: params.imageId,
      bboxSetStatus: "CONFIRMED",
      confirmedBBoxVersionIds: activeIds,
      confirmedAt,
      confirmedById: params.actorId,
    },
    update: {
      bboxSetStatus: "CONFIRMED",
      confirmedBBoxVersionIds: activeIds,
      confirmedAt,
      confirmedById: params.actorId,
    },
    select: IMAGE_BBOX_WORKFLOW_STATE_SELECT,
  });

  await recordAuditEvent(
    {
      action: "IMAGE_BBOX_SET_CONFIRMED",
      entity: "ImageCropWorkflowState",
      entityId: state.id,
      actorId: params.actorId,
      details: {
        projectId: params.projectId,
        imageId: params.imageId,
        activeBBoxVersionIds: activeIds,
      },
    },
    db,
  );

  return state;
}

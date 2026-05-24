import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  createCropSupportMaskVersionForUser,
  cropSupportMaskErrorResponse,
  loadCropSupportMaskStateForUser,
} from "@/server/domain/cropSupportMasks";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";
import { deleteObjectBestEffort, putObject, verifyStoredObject } from "@/server/storage/s3";
import {
  integrityErrorPayload,
  normalizeContentType,
  validateMaskBytes,
  validateSupportMaskValues,
} from "@/server/uploads/integrity";
import { maskUploadDiagnosticsFromError, readMaskUploadRequest } from "@/server/uploads/maskRequest";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ cropId: string }> },
) {
  const user = await requireUser();
  const { cropId } = await props.params;

  try {
    const preflight = await loadCropSupportMaskStateForUser({ cropId, userId: user.id });
    if (!preflight.canEdit) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    await enforceHighCostRouteLimit({
      family: "save:crop-artifact",
      userId: user.id,
      scope: [preflight.crop.projectId, cropId],
    });

    let upload;
    try {
      upload = await readMaskUploadRequest(req);
    } catch (error) {
      const payload = integrityErrorPayload(error);
      if (!payload) throw error;
      await recordAuditEvent({
        action: "ARTIFACT_VALIDATION_FAILED",
        entity: "DerivedSliceCrop",
        entityId: cropId,
        actorId: user.id,
        details: {
          projectId: preflight.crop.projectId,
          imageId: preflight.crop.sourceImageId,
          sliceInstanceId: preflight.crop.sliceInstanceId,
          artifactKind: "SLICE_SUPPORT_MASK",
          coordinateSpace: "CROP_PIXEL",
          route: "crop-support-mask-upload",
          error: payload.body.error,
          ...(maskUploadDiagnosticsFromError(error) ?? {}),
        },
      });
      return NextResponse.json(payload.body, { status: payload.status });
    }

    let integrity;
    try {
      integrity = validateMaskBytes({
        bytes: upload.bytes,
        width: upload.width,
        height: upload.height,
        imageWidth: preflight.crop.cropWidth,
        imageHeight: preflight.crop.cropHeight,
        format: upload.format,
        expectedChecksum: req.headers.get("x-checksum"),
      });
      validateSupportMaskValues(upload.bytes, preflight.supportLabels.sliceSupport);
    } catch (error) {
      const payload = integrityErrorPayload(error);
      if (!payload) throw error;
      await recordAuditEvent({
        action: "ARTIFACT_VALIDATION_FAILED",
        entity: "DerivedSliceCrop",
        entityId: cropId,
        actorId: user.id,
        details: {
          projectId: preflight.crop.projectId,
          imageId: preflight.crop.sourceImageId,
          sliceInstanceId: preflight.crop.sliceInstanceId,
          artifactKind: "SLICE_SUPPORT_MASK",
          coordinateSpace: "CROP_PIXEL",
          route: "crop-support-mask-upload",
          error: payload.body.error,
          ...upload.diagnostics,
        },
      });
      return NextResponse.json(payload.body, { status: payload.status });
    }

    const contentType = normalizeContentType(req.headers.get("content-type"));
    const storageKey =
      `projects/${preflight.crop.projectId}/crop-support-masks/` +
      `${preflight.crop.sourceImageId}/${preflight.crop.sliceInstanceId}/${cropId}/${randomUUID()}.msk`;

    let objectWritten = false;
    try {
      await putObject(storageKey, upload.bytes, contentType);
      objectWritten = true;
      await verifyStoredObject({ key: storageKey, size: integrity.size, contentType });
    } catch {
      if (objectWritten) await deleteObjectBestEffort(storageKey);
      await recordAuditEvent({
        action: "ARTIFACT_VALIDATION_FAILED",
        entity: "DerivedSliceCrop",
        entityId: cropId,
        actorId: user.id,
        details: {
          projectId: preflight.crop.projectId,
          imageId: preflight.crop.sourceImageId,
          sliceInstanceId: preflight.crop.sliceInstanceId,
          artifactKind: "SLICE_SUPPORT_MASK",
          coordinateSpace: "CROP_PIXEL",
          route: "crop-support-mask-upload",
          error: objectWritten ? "OBJECT_STAT_FAILED" : "OBJECT_WRITE_FAILED",
        },
      });
      return NextResponse.json(
        { ok: false, error: objectWritten ? "OBJECT_STAT_FAILED" : "OBJECT_WRITE_FAILED" },
        { status: 500 },
      );
    }

    let state: Awaited<ReturnType<typeof createCropSupportMaskVersionForUser>> | null = null;
    try {
      state = await createCropSupportMaskVersionForUser({
        cropId,
        userId: user.id,
        storageKey,
        contentType,
        size: integrity.size,
        checksum: integrity.checksum,
        width: integrity.width,
        height: integrity.height,
        format: integrity.format,
      });
    } catch (error) {
      await deleteObjectBestEffort(storageKey);
      throw error;
    }
    if (!state) throw new Error("CROP_SUPPORT_MASK_SAVE_FAILED");

    await recordAuditEvent({
      action: "CROP_SUPPORT_MASK_COMMITTED",
      entity: "AnnotationArtifactVersion",
      entityId: state.latestSupportMask?.id ?? cropId,
      actorId: user.id,
      details: {
        projectId: state.crop.projectId,
        imageId: state.crop.sourceImageId,
        sliceInstanceId: state.crop.sliceInstanceId,
        derivedCropId: cropId,
        supportArtifactVersionId: state.latestSupportMask?.id,
        checksum: integrity.checksum,
        size: integrity.size,
        width: integrity.width,
        height: integrity.height,
        coordinateSpace: "CROP_PIXEL",
      },
    });

    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") throw error;
    const payload = cropSupportMaskErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

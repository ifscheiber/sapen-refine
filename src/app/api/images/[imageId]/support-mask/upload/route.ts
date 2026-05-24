import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createSupportMaskVersionForUser,
  loadSliceStateForUser,
  sliceErrorResponse,
} from "@/server/domain/slices";
import { recordAuditEvent } from "@/server/domain/audit";
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
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const preflight = await loadSliceStateForUser({ imageId, userId: user.id });
    if (!preflight.canEdit) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    await enforceHighCostRouteLimit({
      family: "upload:mask",
      userId: user.id,
      scope: [preflight.image.projectId, imageId],
    });

    let upload;
    try {
      upload = await readMaskUploadRequest(req);
    } catch (error) {
      const payload = integrityErrorPayload(error);
      if (!payload) throw error;
      await recordAuditEvent({
        action: "ARTIFACT_VALIDATION_FAILED",
        entity: "ImageAsset",
        entityId: imageId,
        actorId: user.id,
        details: {
          projectId: preflight.image.projectId,
          artifactKind: "SLICE_SUPPORT_MASK",
          route: "support-mask-upload",
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
        imageWidth: preflight.image.width,
        imageHeight: preflight.image.height,
        format: upload.format,
        expectedChecksum: req.headers.get("x-checksum"),
      });
      validateSupportMaskValues(upload.bytes, preflight.supportLabels.sliceSupport);
    } catch (error) {
      const payload = integrityErrorPayload(error);
      if (!payload) throw error;
      await recordAuditEvent({
        action: "ARTIFACT_VALIDATION_FAILED",
        entity: "ImageAsset",
        entityId: imageId,
        actorId: user.id,
        details: {
          projectId: preflight.image.projectId,
          artifactKind: "SLICE_SUPPORT_MASK",
          route: "support-mask-upload",
          error: payload.body.error,
          ...upload.diagnostics,
        },
      });
      return NextResponse.json(payload.body, { status: payload.status });
    }

    const contentType = normalizeContentType(req.headers.get("content-type"));
    const storageKey = `projects/${preflight.image.projectId}/support-masks/${imageId}/${randomUUID()}.msk`;

    let objectWritten = false;
    try {
      await putObject(storageKey, upload.bytes, contentType);
      objectWritten = true;
      await verifyStoredObject({ key: storageKey, size: integrity.size, contentType });
    } catch {
      if (objectWritten) await deleteObjectBestEffort(storageKey);
      await recordAuditEvent({
        action: "ARTIFACT_VALIDATION_FAILED",
        entity: "ImageAsset",
        entityId: imageId,
        actorId: user.id,
        details: {
          projectId: preflight.image.projectId,
          artifactKind: "SLICE_SUPPORT_MASK",
          error: objectWritten ? "OBJECT_STAT_FAILED" : "OBJECT_WRITE_FAILED",
        },
      });
      return NextResponse.json(
        { ok: false, error: objectWritten ? "OBJECT_STAT_FAILED" : "OBJECT_WRITE_FAILED" },
        { status: 500 },
      );
    }

    const state = await createSupportMaskVersionForUser({
      imageId,
      userId: user.id,
      storageKey,
      contentType,
      size: integrity.size,
      checksum: integrity.checksum,
      width: integrity.width,
      height: integrity.height,
      format: integrity.format,
    });

    await recordAuditEvent({
      action: "SUPPORT_MASK_COMMITTED",
      entity: "ImageAsset",
      entityId: imageId,
      actorId: user.id,
      details: {
        projectId: preflight.image.projectId,
        supportArtifactVersionId: state.latestSupportMask?.id,
        checksum: integrity.checksum,
        size: integrity.size,
        width: integrity.width,
        height: integrity.height,
      },
    });

    return NextResponse.json({
      ok: true,
      sliceInstance: state.sliceInstance,
      latestSupportMask: state.latestSupportMask,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") throw error;
    const payload = sliceErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

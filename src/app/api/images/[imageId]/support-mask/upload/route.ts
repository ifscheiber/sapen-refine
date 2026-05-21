import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createSupportMaskVersionForUser,
  loadSliceStateForUser,
  sliceErrorResponse,
} from "@/server/domain/slices";
import { recordAuditEvent } from "@/server/domain/audit";
import { deleteObjectBestEffort, putObject, verifyStoredObject } from "@/server/storage/s3";
import {
  integrityErrorPayload,
  maskByteLengthDiagnostics,
  normalizeContentType,
  readDeclaredMaskByteLength,
  validateMaskBytes,
  validateSupportMaskValues,
} from "@/server/uploads/integrity";
import {
  readContentLength,
  uploadErrorPayload,
  validateUploadSize,
} from "@/server/uploads/validation";

function readPositiveInteger(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(
  req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  const width = readPositiveInteger(req.headers, "x-mask-width");
  if (!width) return NextResponse.json({ ok: false, error: "WIDTH_REQUIRED" }, { status: 400 });

  const height = readPositiveInteger(req.headers, "x-mask-height");
  if (!height) return NextResponse.json({ ok: false, error: "HEIGHT_REQUIRED" }, { status: 400 });

  const contentLength = readContentLength(req.headers);
  if (contentLength !== null) {
    const earlyValidation = validateUploadSize(contentLength, "mask");
    if (!earlyValidation.ok) {
      return NextResponse.json(uploadErrorPayload(earlyValidation), {
        status: earlyValidation.status,
      });
    }
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  const declaredClientBytes = readDeclaredMaskByteLength(req.headers);
  const sizeValidation = validateUploadSize(bytes.byteLength, "mask");
  if (!sizeValidation.ok) {
    return NextResponse.json(uploadErrorPayload(sizeValidation), {
      status: sizeValidation.status,
    });
  }

  try {
    const preflight = await loadSliceStateForUser({ imageId, userId: user.id });
    if (!preflight.canEdit) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    let integrity;
    try {
      integrity = validateMaskBytes({
        bytes,
        width,
        height,
        imageWidth: preflight.image.width,
        imageHeight: preflight.image.height,
        format: req.headers.get("x-mask-format"),
        expectedChecksum: req.headers.get("x-checksum"),
      });
      validateSupportMaskValues(bytes, preflight.supportLabels.sliceSupport);
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
          error: payload.body.error,
          ...maskByteLengthDiagnostics({
            width,
            height,
            receivedBytes: bytes.byteLength,
            declaredClientBytes,
            format: req.headers.get("x-mask-format"),
          }),
        },
      });
      return NextResponse.json(payload.body, { status: payload.status });
    }

    const contentType = normalizeContentType(req.headers.get("content-type"));
    const storageKey = `projects/${preflight.image.projectId}/support-masks/${imageId}/${randomUUID()}.msk`;

    let objectWritten = false;
    try {
      await putObject(storageKey, bytes, contentType);
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
    const payload = sliceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

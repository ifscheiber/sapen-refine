import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { recordAuditEvent } from "@/server/domain/audit";
import {
  createCropSemanticMaskVersionForUser,
  cropSemanticMaskErrorResponse,
  loadCropSemanticMaskStateForUser,
  parseCropSemanticMode,
} from "@/server/domain/cropSemanticMasks";
import { cropSemanticFamilySaveGuard } from "@/server/domain/cropSemanticFamily";
import { deleteObjectBestEffort, putObject, verifyStoredObject } from "@/server/storage/s3";
import {
  integrityErrorPayload,
  normalizeContentType,
  validateMaskBytes,
} from "@/server/uploads/integrity";
import { maskUploadDiagnosticsFromError, readMaskUploadRequest } from "@/server/uploads/maskRequest";

export async function POST(
  req: Request,
  props: { params: Promise<{ cropId: string }> },
) {
  const user = await requireUser();
  const { cropId } = await props.params;

  try {
    const preflight = await loadCropSemanticMaskStateForUser({ cropId, userId: user.id });
    if (!preflight.canEdit) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const supportMaskVersionId = req.headers.get("x-support-mask-version-id")?.trim() || null;
    const semanticMode = parseCropSemanticMode(req.headers.get("x-semantic-mode")?.trim());
    const semanticFamilyReset =
      req.headers.get("x-semantic-family-reset")?.trim().toLowerCase() === "true";
    const familyGuard = cropSemanticFamilySaveGuard(preflight.semanticFamily, semanticMode);
    if (familyGuard.resetRequired && !semanticFamilyReset) {
      return NextResponse.json(
        { ok: false, error: familyGuard.error ?? "SEMANTIC_FAMILY_RESET_REQUIRED" },
        { status: 409 },
      );
    }

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
          artifactKind: "SEMANTIC_MASK",
          coordinateSpace: "CROP_PIXEL",
          supportMaskVersionId,
          semanticMode,
          route: "crop-semantic-mask-upload",
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
          artifactKind: "SEMANTIC_MASK",
          coordinateSpace: "CROP_PIXEL",
          supportMaskVersionId,
          semanticMode,
          route: "crop-semantic-mask-upload",
          error: payload.body.error,
          ...upload.diagnostics,
        },
      });
      return NextResponse.json(payload.body, { status: payload.status });
    }

    const contentType = normalizeContentType(req.headers.get("content-type"));
    const storageKey =
      `projects/${preflight.crop.projectId}/crop-semantic-masks/` +
      `${preflight.crop.sourceImageId}/${preflight.crop.sliceInstanceId}/${cropId}/${semanticMode}/${randomUUID()}.msk`;

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
          artifactKind: "SEMANTIC_MASK",
          coordinateSpace: "CROP_PIXEL",
          supportMaskVersionId,
          semanticMode,
          route: "crop-semantic-mask-upload",
          error: objectWritten ? "OBJECT_STAT_FAILED" : "OBJECT_WRITE_FAILED",
        },
      });
      return NextResponse.json(
        { ok: false, error: objectWritten ? "OBJECT_STAT_FAILED" : "OBJECT_WRITE_FAILED" },
        { status: 500 },
      );
    }

    let state: Awaited<ReturnType<typeof createCropSemanticMaskVersionForUser>> | null = null;
    try {
      state = await createCropSemanticMaskVersionForUser({
        cropId,
        userId: user.id,
        supportMaskVersionId,
        semanticMode,
        storageKey,
        contentType,
        size: integrity.size,
        checksum: integrity.checksum,
        width: integrity.width,
        height: integrity.height,
        format: integrity.format,
        semanticBytes: upload.bytes,
        semanticFamilyReset,
      });
    } catch (error) {
      await deleteObjectBestEffort(storageKey);
      throw error;
    }
    if (!state) throw new Error("CROP_SEMANTIC_MASK_SAVE_FAILED");

    const latest = state.latestSemanticMasks[semanticMode];
    await recordAuditEvent({
      action: "CROP_SEMANTIC_MASK_COMMITTED",
      entity: "AnnotationArtifactVersion",
      entityId: latest?.id ?? cropId,
      actorId: user.id,
      details: {
        projectId: state.crop.projectId,
        imageId: state.crop.sourceImageId,
        sliceInstanceId: state.crop.sliceInstanceId,
        derivedCropId: cropId,
        semanticArtifactVersionId: latest?.id,
        supportMaskVersionId,
        semanticMode,
        checksum: integrity.checksum,
        size: integrity.size,
        width: integrity.width,
        height: integrity.height,
        coordinateSpace: "CROP_PIXEL",
      },
    });

    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = cropSemanticMaskErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

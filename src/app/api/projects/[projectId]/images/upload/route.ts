import crypto from "crypto";
import { NextResponse } from "next/server";

import { evaluateTrialImageEditability } from "@/lib/imageSizePolicy";
import { PROJECT_ANNOTATE_ROLES } from "@/server/auth/policies";
import { requireProjectRole } from "@/server/auth/rbac";
import { recordAuditEvent } from "@/server/domain/audit";
import { prisma } from "@/server/db";
import { withApiErrorHandling } from "@/server/http/apiErrors";
import { deleteObjectBestEffort, putObject, verifyStoredObject } from "@/server/storage/s3";
import {
  integrityErrorPayload,
  UploadIntegrityError,
  validateImageBytes,
} from "@/server/uploads/integrity";
import {
  readContentLength,
  uploadErrorPayload,
  validateUploadSize,
} from "@/server/uploads/validation";

function decodeFilename(value: string | null): string {
  if (!value) return "upload.bin";

  try {
    const decoded = decodeURIComponent(value);
    const cleaned = decoded.replace(/[\\/]/g, "_").trim();
    return cleaned.slice(0, 255) || "upload.bin";
  } catch {
    return "upload.bin";
  }
}

function extensionFor(contentType: string): string {
  return contentType === "image/jpeg" ? "jpg" : "png";
}

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const { user } = await requireProjectRole(projectId, PROJECT_ANNOTATE_ROLES);

  const contentLength = readContentLength(req.headers);
  if (contentLength !== null) {
    const earlyValidation = validateUploadSize(contentLength, "image");
    if (!earlyValidation.ok) {
      await recordAuditEvent({
        action: "IMAGE_UPLOAD_REJECTED",
        entity: "AnnotationProject",
        entityId: projectId,
        actorId: user.id,
        details: { error: earlyValidation.error, size: contentLength },
      });
      return NextResponse.json(uploadErrorPayload(earlyValidation), {
        status: earlyValidation.status,
      });
    }
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  const sizeValidation = validateUploadSize(bytes.byteLength, "image");
  if (!sizeValidation.ok) {
    await recordAuditEvent({
      action: "IMAGE_UPLOAD_REJECTED",
      entity: "AnnotationProject",
      entityId: projectId,
      actorId: user.id,
      details: { error: sizeValidation.error, size: bytes.byteLength },
    });
    return NextResponse.json(uploadErrorPayload(sizeValidation), {
      status: sizeValidation.status,
    });
  }

  const filename = decodeFilename(req.headers.get("x-filename"));
  let integrity;
  try {
    integrity = validateImageBytes({
      bytes,
      contentType: req.headers.get("content-type"),
      expectedChecksum: req.headers.get("x-checksum"),
    });
    const editability = evaluateTrialImageEditability(integrity.width, integrity.height);
    if (editability.status === "unsupported") {
      throw new UploadIntegrityError("IMAGE_DIMENSIONS_UNSUPPORTED");
    }
  } catch (error) {
    const payload = integrityErrorPayload(error);
    if (!payload) throw error;
    await recordAuditEvent({
      action: "IMAGE_UPLOAD_REJECTED",
      entity: "AnnotationProject",
      entityId: projectId,
      actorId: user.id,
      details: {
        error: payload.body.error,
        filename,
        ...(integrity
          ? {
              width: integrity.width,
              height: integrity.height,
              pixels: integrity.width * integrity.height,
            }
          : {}),
      },
    });
    return NextResponse.json(payload.body, { status: payload.status });
  }

  const key = `projects/${projectId}/images/${crypto.randomUUID()}.${extensionFor(integrity.contentType)}`;

  let objectWritten = false;
  try {
    await putObject(key, bytes, integrity.contentType);
    objectWritten = true;
    await verifyStoredObject({ key, size: integrity.size, contentType: integrity.contentType });

    const image = await prisma.imageAsset.create({
      data: {
        projectId,
        storageKey: key,
        filename,
        contentType: integrity.contentType,
        size: integrity.size,
        checksum: integrity.checksum,
        width: integrity.width,
        height: integrity.height,
        validationStatus: "VALIDATED",
        uploadedById: user.id,
      },
      select: {
        id: true,
        filename: true,
        contentType: true,
        size: true,
        checksum: true,
        width: true,
        height: true,
        validationStatus: true,
        createdAt: true,
      },
    });

    await recordAuditEvent({
      action: "IMAGE_UPLOAD_ACCEPTED",
      entity: "ImageAsset",
      entityId: image.id,
      actorId: user.id,
      details: {
        projectId,
        checksum: integrity.checksum,
        size: integrity.size,
        width: integrity.width,
        height: integrity.height,
        contentType: integrity.contentType,
      },
    });

    return NextResponse.json({ ok: true, image }, { status: 201 });
  } catch (error) {
    if (objectWritten) await deleteObjectBestEffort(key);
    const code =
      error instanceof Error && error.message.startsWith("OBJECT_STAT")
        ? "OBJECT_STAT_FAILED"
        : "OBJECT_WRITE_FAILED";
    await recordAuditEvent({
      action: "IMAGE_UPLOAD_REJECTED",
      entity: "AnnotationProject",
      entityId: projectId,
      actorId: user.id,
      details: { error: code, filename },
    });
    return NextResponse.json({ ok: false, error: code }, { status: 500 });
  }
});

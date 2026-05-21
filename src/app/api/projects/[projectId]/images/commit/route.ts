import { NextResponse } from "next/server";
import { PROJECT_ANNOTATE_ROLES } from "@/server/auth/policies";
import { requireProjectRole } from "@/server/auth/rbac";
import { recordAuditEvent } from "@/server/domain/audit";
import { prisma } from "@/server/db";
import { getObjectBytes, statObject } from "@/server/storage/s3";
import { integrityErrorPayload, validateImageBytes } from "@/server/uploads/integrity";
import { uploadErrorPayload, validateUploadSize } from "@/server/uploads/validation";

function safeFilename(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "upload.png";
  return value.replace(/[\\/]/g, "_").trim().slice(0, 255) || "upload.png";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;

  const { user } = await requireProjectRole(projectId, PROJECT_ANNOTATE_ROLES);

  const body = await req.json().catch(() => null);

  const key = body?.key;
  const filename = safeFilename(body?.filename);

  if (!key || typeof key !== "string") {
    return NextResponse.json(
      { ok: false, error: "KEY_REQUIRED" },
      { status: 400 }
    );
  }
  if (!key.startsWith(`projects/${projectId}/images/`)) {
    await recordAuditEvent({
      action: "IMAGE_UPLOAD_REJECTED",
      entity: "AnnotationProject",
      entityId: projectId,
      actorId: user.id,
      details: { error: "OBJECT_KEY_INVALID" },
    });
    return NextResponse.json({ ok: false, error: "OBJECT_KEY_INVALID" }, { status: 400 });
  }

  let object;
  let bytes;
  try {
    object = await statObject(key);
    bytes = await getObjectBytes(key);
  } catch {
    await recordAuditEvent({
      action: "IMAGE_UPLOAD_REJECTED",
      entity: "AnnotationProject",
      entityId: projectId,
      actorId: user.id,
      details: { error: "OBJECT_STAT_FAILED", key },
    });
    return NextResponse.json({ ok: false, error: "OBJECT_STAT_FAILED" }, { status: 500 });
  }

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

  let integrity;
  try {
    integrity = validateImageBytes({
      bytes,
      contentType: object.contentType ?? body?.contentType,
      expectedChecksum: body?.checksum,
    });
    if (object.contentLength !== null && object.contentLength !== integrity.size) {
      return NextResponse.json({ ok: false, error: "OBJECT_STAT_FAILED" }, { status: 500 });
    }
  } catch (error) {
    const payload = integrityErrorPayload(error);
    if (!payload) throw error;
    await recordAuditEvent({
      action: "IMAGE_UPLOAD_REJECTED",
      entity: "AnnotationProject",
      entityId: projectId,
      actorId: user.id,
      details: { error: payload.body.error, key },
    });
    return NextResponse.json(payload.body, { status: payload.status });
  }

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
      source: "presigned-commit",
    },
  });

  return NextResponse.json({ ok: true, image });
}

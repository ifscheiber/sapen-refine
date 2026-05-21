import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { canAnnotate } from "@/server/auth/policies";
import { requireUser } from "@/server/auth/rbac";
import { AnnotationArtifactKind } from "@prisma/client";
import { recordAuditEvent } from "@/server/domain/audit";
import { getProjectLabelSchemaVersionId } from "@/server/domain/labelSchema";
import { getObjectBytes, statObject } from "@/server/storage/s3";
import { integrityErrorPayload, normalizeContentType, validateMaskBytes } from "@/server/uploads/integrity";
import { uploadErrorPayload, validateUploadSize } from "@/server/uploads/validation";

export async function POST(
  req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  const { key, size, width, height, format } = body ?? {};

  if (!imageId) return NextResponse.json({ error: "IMAGE_ID_REQUIRED" }, { status: 400 });

  if (!key || typeof key !== "string")
    return NextResponse.json({ error: "KEY_REQUIRED" }, { status: 400 });

  if (!Number.isInteger(size) || size <= 0)
    return NextResponse.json({ error: "SIZE_REQUIRED" }, { status: 400 });

  const sizeValidation = validateUploadSize(size, "mask");
  if (!sizeValidation.ok) {
    return NextResponse.json(uploadErrorPayload(sizeValidation), {
      status: sizeValidation.status,
    });
  }

  if (!Number.isInteger(width) || width <= 0)
    return NextResponse.json({ error: "WIDTH_REQUIRED" }, { status: 400 });

  if (!Number.isInteger(height) || height <= 0)
    return NextResponse.json({ error: "HEIGHT_REQUIRED" }, { status: 400 });

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true, width: true, height: true },
  });
  if (!image) return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || !canAnnotate(membership.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!key.startsWith(`projects/${image.projectId}/masks/${imageId}/`)) {
    await recordAuditEvent({
      action: "ARTIFACT_VALIDATION_FAILED",
      entity: "ImageAsset",
      entityId: image.id,
      actorId: user.id,
      details: { projectId: image.projectId, artifactKind: "SEMANTIC_MASK", error: "OBJECT_KEY_INVALID" },
    });
    return NextResponse.json({ ok: false, error: "OBJECT_KEY_INVALID" }, { status: 400 });
  }

  let bytes;
  let object;
  try {
    object = await statObject(key);
    bytes = await getObjectBytes(key);
  } catch {
    await recordAuditEvent({
      action: "ARTIFACT_VALIDATION_FAILED",
      entity: "ImageAsset",
      entityId: image.id,
      actorId: user.id,
      details: { projectId: image.projectId, artifactKind: "SEMANTIC_MASK", error: "OBJECT_STAT_FAILED" },
    });
    return NextResponse.json({ ok: false, error: "OBJECT_STAT_FAILED" }, { status: 500 });
  }

  let integrity;
  try {
    integrity = validateMaskBytes({
      bytes,
      width,
      height,
      imageWidth: image.width,
      imageHeight: image.height,
      format,
      expectedChecksum: body?.checksum,
    });
    if (object.contentLength !== null && object.contentLength !== integrity.size) {
      return NextResponse.json({ ok: false, error: "OBJECT_STAT_FAILED" }, { status: 500 });
    }
  } catch (error) {
    const payload = integrityErrorPayload(error);
    if (!payload) throw error;
    await recordAuditEvent({
      action: "ARTIFACT_VALIDATION_FAILED",
      entity: "ImageAsset",
      entityId: image.id,
      actorId: user.id,
      details: { projectId: image.projectId, artifactKind: "SEMANTIC_MASK", error: payload.body.error },
    });
    return NextResponse.json(payload.body, { status: payload.status });
  }

  const labelSchemaVersionId = await getProjectLabelSchemaVersionId(image.projectId);
  const kind = AnnotationArtifactKind.SEMANTIC_MASK;

  const artifact = await prisma.annotationArtifact.upsert({
    where: { imageId_kind_scopeKey: { imageId, kind, scopeKey: "default" } },
    update: {},
    create: { projectId: image.projectId, imageId, kind, scopeKey: "default", createdById: user.id },
    select: { id: true },
  });

  const last = await prisma.annotationArtifactVersion.findFirst({
    where: { artifactId: artifact.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (last?.version ?? 0) + 1;

  const version = await prisma.annotationArtifactVersion.create({
    data: {
      artifactId: artifact.id,
      version: nextVersion,
      storageKey: key,
      contentType: normalizeContentType(object.contentType),
      size: integrity.size,
      checksum: integrity.checksum,
      width: integrity.width,
      height: integrity.height,
      format: integrity.format,
      labelSchemaVersionId,
      createdById: user.id,
    },
    select: { id: true, createdAt: true, version: true },
  });

  await recordAuditEvent({
    action: "SEMANTIC_MASK_COMMITTED",
    entity: "AnnotationArtifactVersion",
    entityId: version.id,
    actorId: user.id,
    details: {
      projectId: image.projectId,
      imageId: image.id,
      artifactId: artifact.id,
      checksum: integrity.checksum,
      size: integrity.size,
      width: integrity.width,
      height: integrity.height,
      source: "presigned-commit",
    },
  });

  return NextResponse.json({
    ok: true,
    maskId: artifact.id,
    versionId: version.id,
    version: version.version,
    createdAt: version.createdAt,
  });
}

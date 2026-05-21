import { randomUUID } from "crypto";
import { AnnotationArtifactKind } from "@prisma/client";
import { NextResponse } from "next/server";

import { canAnnotate } from "@/server/auth/policies";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { getProjectLabelSchemaVersionId } from "@/server/domain/labelSchema";
import { deleteObjectBestEffort, putObject, verifyStoredObject } from "@/server/storage/s3";
import {
  integrityErrorPayload,
  maskByteLengthDiagnostics,
  normalizeContentType,
  readDeclaredMaskByteLength,
  validateMaskBytes,
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
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const width = readPositiveInteger(req.headers, "x-mask-width");
  if (!width) return NextResponse.json({ error: "WIDTH_REQUIRED" }, { status: 400 });

  const height = readPositiveInteger(req.headers, "x-mask-height");
  if (!height) return NextResponse.json({ error: "HEIGHT_REQUIRED" }, { status: 400 });

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

  let integrity;
  try {
    integrity = validateMaskBytes({
      bytes,
      width,
      height,
      imageWidth: image.width,
      imageHeight: image.height,
      format: req.headers.get("x-mask-format"),
      expectedChecksum: req.headers.get("x-checksum"),
    });
  } catch (error) {
    const payload = integrityErrorPayload(error);
    if (!payload) throw error;
    await recordAuditEvent({
      action: "ARTIFACT_VALIDATION_FAILED",
      entity: "ImageAsset",
      entityId: image.id,
      actorId: user.id,
      details: {
        projectId: image.projectId,
        artifactKind: "SEMANTIC_MASK",
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

  const key = `projects/${image.projectId}/masks/${imageId}/${randomUUID()}.msk`;
  const contentType = normalizeContentType(req.headers.get("content-type"));

  let objectWritten = false;
  try {
    await putObject(key, bytes, contentType);
    objectWritten = true;
    await verifyStoredObject({ key, size: integrity.size, contentType });

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

    const version = await prisma.annotationArtifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: (last?.version ?? 0) + 1,
        storageKey: key,
        contentType,
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
      },
    });

    return NextResponse.json({
      ok: true,
      maskId: artifact.id,
      versionId: version.id,
      version: version.version,
      createdAt: version.createdAt,
    });
  } catch (error) {
    if (objectWritten) await deleteObjectBestEffort(key);
    const code =
      error instanceof Error && error.message.startsWith("OBJECT_STAT")
        ? "OBJECT_STAT_FAILED"
        : "OBJECT_WRITE_FAILED";
    await recordAuditEvent({
      action: "ARTIFACT_VALIDATION_FAILED",
      entity: "ImageAsset",
      entityId: image.id,
      actorId: user.id,
      details: { projectId: image.projectId, artifactKind: "SEMANTIC_MASK", error: code },
    });
    return NextResponse.json({ ok: false, error: code }, { status: 500 });
  }
}

import { randomUUID } from "crypto";
import { AnnotationArtifactKind } from "@prisma/client";
import { NextResponse } from "next/server";

import { canAnnotate } from "@/server/auth/policies";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/audit";
import { getProjectLabelSchemaVersionId } from "@/server/domain/labelSchema";
import {
  annotationArtifactVersionFamilyKey,
  isVersionAllocationError,
  withVersionAllocationLock,
} from "@/server/domain/versionAllocation";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";
import { deleteObjectBestEffort, putObject, verifyStoredObject } from "@/server/storage/s3";
import {
  integrityErrorPayload,
  normalizeContentType,
  validateMaskBytes,
} from "@/server/uploads/integrity";
import { maskUploadDiagnosticsFromError, readMaskUploadRequest } from "@/server/uploads/maskRequest";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true, width: true, height: true },
  });
  if (!image) return apiError("IMAGE_NOT_FOUND", 404);

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || !canAnnotate(membership.role)) {
    return apiError("FORBIDDEN", 403);
  }

  let upload;
  try {
    upload = await readMaskUploadRequest(req);
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
        route: "semantic-mask-upload",
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
      imageWidth: image.width,
      imageHeight: image.height,
      format: upload.format,
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
        route: "semantic-mask-upload",
        error: payload.body.error,
        ...upload.diagnostics,
      },
    });
    return NextResponse.json(payload.body, { status: payload.status });
  }

  const key = `projects/${image.projectId}/masks/${imageId}/${randomUUID()}.msk`;
  const contentType = normalizeContentType(req.headers.get("content-type"));

  let objectWritten = false;
  try {
    await putObject(key, upload.bytes, contentType);
    objectWritten = true;
    await verifyStoredObject({ key, size: integrity.size, contentType });

    const kind = AnnotationArtifactKind.SEMANTIC_MASK;
    const scopeKey = "default";
    const labelSchemaVersionId = await getProjectLabelSchemaVersionId(image.projectId);

    const result = await prisma.$transaction(async (tx) =>
      withVersionAllocationLock(
        tx,
        annotationArtifactVersionFamilyKey({ imageId, kind, scopeKey }),
        async () => {
          const artifact = await tx.annotationArtifact.upsert({
            where: { imageId_kind_scopeKey: { imageId, kind, scopeKey } },
            update: {},
            create: { projectId: image.projectId, imageId, kind, scopeKey, createdById: user.id },
            select: { id: true },
          });

          const last = await tx.annotationArtifactVersion.findFirst({
            where: { artifactId: artifact.id },
            orderBy: { version: "desc" },
            select: { version: true },
          });

          const version = await tx.annotationArtifactVersion.create({
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
          }, tx);

          return { artifact, version };
        },
      ),
    );

    return NextResponse.json({
      ok: true,
      maskId: result.artifact.id,
      versionId: result.version.id,
      version: result.version.version,
      createdAt: result.version.createdAt,
    });
  } catch (error) {
    if (objectWritten) await deleteObjectBestEffort(key);
    if (isVersionAllocationError(error)) {
      return apiError(error.code, error.status);
    }
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
});

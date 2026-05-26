import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { AnnotationArtifactKind } from "@prisma/client";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  if (!imageId) {
    return apiError("IMAGE_ID_REQUIRED", 400);
  }

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) {
    return apiError("IMAGE_NOT_FOUND", 404);
  }

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) {
    return apiError("FORBIDDEN", 403);
  }

  const kind = AnnotationArtifactKind.SEMANTIC_MASK;

  const artifact = await prisma.annotationArtifact.findUnique({
    where: { imageId_kind_scopeKey: { imageId, kind, scopeKey: "default" } },
    select: { id: true },
  });

  if (!artifact) {
    return NextResponse.json({ ok: true, exists: false });
  }

  const latest = await prisma.annotationArtifactVersion.findFirst({
    where: { artifactId: artifact.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      size: true,
      width: true,
      height: true,
      format: true,
      reviewState: true,
      createdAt: true,
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });

  if (!latest) {
    return NextResponse.json({ ok: true, exists: false, maskId: artifact.id });
  }

  return NextResponse.json({
    ok: true,
    exists: true,
    maskId: artifact.id,
    versionId: latest.id,
    version: latest.version,
    size: latest.size,
    width: latest.width,
    height: latest.height,
    format: latest.format,
    reviewState: latest.reviewState,
    createdAt: latest.createdAt,
    createdBy: latest.createdBy,
    url: `/api/images/${imageId}/mask/versions/${latest.id}/asset`,
  });
});

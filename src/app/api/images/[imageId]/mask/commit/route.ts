import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { AnnotationArtifactKind } from "@prisma/client";
import { getProjectLabelSchemaVersionId } from "@/server/domain/labelSchema";
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
    select: { id: true, projectId: true },
  });
  if (!image) return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || membership.role === "VIEWER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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
      size,
      width,
      height,
      format: typeof format === "string" && format.length ? format : "u8raw-v1",
      labelSchemaVersionId,
      createdById: user.id,
    },
    select: { id: true, createdAt: true, version: true },
  });

  return NextResponse.json({
    ok: true,
    maskId: artifact.id,
    versionId: version.id,
    version: version.version,
    createdAt: version.createdAt,
  });
}

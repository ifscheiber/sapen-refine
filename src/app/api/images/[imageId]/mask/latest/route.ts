import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { MaskKind } from "@prisma/client";
import { presignGetObject } from "@/server/storage/s3";

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  if (!imageId) {
    return NextResponse.json({ error: "IMAGE_ID_REQUIRED" }, { status: 400 });
  }

  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) {
    return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const kind: MaskKind = MaskKind.REFINED;

  // ✅ eindeutige Maske per (imageId, kind)
  const mask = await prisma.mask.findUnique({
    where: { imageId_kind: { imageId, kind } },
    select: { id: true },
  });

  if (!mask) {
    return NextResponse.json({ ok: true, exists: false });
  }

  // ✅ neueste Version
  const latest = await prisma.maskVersion.findFirst({
    where: { maskId: mask.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      storageKey: true,
      size: true,
      width: true,
      height: true,
      format: true,
      createdAt: true,
    },
  });

  if (!latest) {
    return NextResponse.json({ ok: true, exists: false, maskId: mask.id });
  }

  const url = await presignGetObject(latest.storageKey, 300);

  return NextResponse.json({
    ok: true,
    exists: true,
    maskId: mask.id,
    versionId: latest.id,
    version: latest.version,
    key: latest.storageKey,
    size: latest.size,
    width: latest.width,
    height: latest.height,
    format: latest.format,
    createdAt: latest.createdAt,
    url,
  });
}

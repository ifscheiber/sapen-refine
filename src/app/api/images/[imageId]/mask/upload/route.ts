import { randomUUID } from "crypto";
import { MaskKind } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { putObject } from "@/server/storage/s3";
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
  const sizeValidation = validateUploadSize(bytes.byteLength, "mask");
  if (!sizeValidation.ok) {
    return NextResponse.json(uploadErrorPayload(sizeValidation), {
      status: sizeValidation.status,
    });
  }

  const image = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || membership.role === "VIEWER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const key = `projects/${image.projectId}/masks/${imageId}/${randomUUID()}.msk`;
  const contentType = req.headers.get("content-type") || "application/octet-stream";
  await putObject(key, bytes, contentType);

  const kind: MaskKind = MaskKind.REFINED;
  const mask = await prisma.mask.upsert({
    where: { imageId_kind: { imageId, kind } },
    update: {},
    create: { imageId, kind },
    select: { id: true },
  });

  const last = await prisma.maskVersion.findFirst({
    where: { maskId: mask.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = await prisma.maskVersion.create({
    data: {
      maskId: mask.id,
      version: (last?.version ?? 0) + 1,
      storageKey: key,
      size: bytes.byteLength,
      width,
      height,
      format: req.headers.get("x-mask-format") || "u8raw-v1",
      createdById: user.id,
    },
    select: { id: true, createdAt: true, version: true },
  });

  return NextResponse.json({
    ok: true,
    maskId: mask.id,
    versionId: version.id,
    version: version.version,
    createdAt: version.createdAt,
  });
}

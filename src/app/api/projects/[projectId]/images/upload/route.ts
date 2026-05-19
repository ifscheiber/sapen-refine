import crypto from "crypto";
import { NextResponse } from "next/server";

import { requireProjectRole } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { putObject } from "@/server/storage/s3";
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

function extensionFor(filename: string): string {
  const ext = filename.includes(".") ? filename.split(".").pop() : null;
  return ext?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "bin";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const { user } = await requireProjectRole(projectId, ["OWNER", "QA", "LABELER"]);

  const contentLength = readContentLength(req.headers);
  if (contentLength !== null) {
    const earlyValidation = validateUploadSize(contentLength, "image");
    if (!earlyValidation.ok) {
      return NextResponse.json(uploadErrorPayload(earlyValidation), {
        status: earlyValidation.status,
      });
    }
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  const sizeValidation = validateUploadSize(bytes.byteLength, "image");
  if (!sizeValidation.ok) {
    return NextResponse.json(uploadErrorPayload(sizeValidation), {
      status: sizeValidation.status,
    });
  }

  const filename = decodeFilename(req.headers.get("x-filename"));
  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const key = `projects/${projectId}/images/${crypto.randomUUID()}.${extensionFor(filename)}`;

  await putObject(key, bytes, contentType);

  const image = await prisma.imageAsset.create({
    data: {
      projectId,
      storageKey: key,
      filename,
      contentType,
      size: bytes.byteLength,
      uploadedById: user.id,
    },
    select: { id: true, filename: true, storageKey: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, image }, { status: 201 });
}

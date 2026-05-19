import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import { prisma } from "@/server/db";
import { getObjectBytes } from "@/server/storage/s3";

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      projectId: true,
      storageKey: true,
      contentType: true,
      filename: true,
    },
  });
  if (!image) return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const bytes = await getObjectBytes(image.storageKey);
  const headers = new Headers({
    "content-type": image.contentType || "application/octet-stream",
    "cache-control": "private, no-store",
  });
  if (image.filename) {
    headers.set("content-disposition", `inline; filename="${image.filename}"`);
  }

  return new Response(toArrayBuffer(bytes), {
    status: 200,
    headers,
  });
}

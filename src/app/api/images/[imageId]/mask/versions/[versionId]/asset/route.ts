import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import { prisma } from "@/server/db";
import { getObjectBytes } from "@/server/storage/s3";

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string; versionId: string }> }
) {
  const user = await requireUser();
  const { imageId, versionId } = await props.params;

  const version = await prisma.annotationArtifactVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      storageKey: true,
      format: true,
      artifact: {
        select: {
          imageId: true,
          image: { select: { projectId: true } },
        },
      },
    },
  });

  if (!version || version.artifact.imageId !== imageId) {
    return NextResponse.json({ error: "MASK_VERSION_NOT_FOUND" }, { status: 404 });
  }

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: version.artifact.image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const bytes = await getObjectBytes(version.storageKey);
  return new Response(toArrayBuffer(bytes), {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "private, no-store",
      "x-mask-format": version.format,
    },
  });
}

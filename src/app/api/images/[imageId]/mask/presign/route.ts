import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { presignPutObject } from "@/server/storage/s3";
import { randomUUID } from "crypto";

export async function POST(req: Request, props: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  if (!body?.contentType || typeof body.contentType !== "string") {
    return NextResponse.json({ error: "CONTENT_TYPE_REQUIRED" }, { status: 400 });
  }

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) return NextResponse.json({ error: "IMAGE_NOT_FOUND" }, { status: 404 });

  // optional: membership check (recommended)
  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || membership.role === "VIEWER") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const key = `projects/${image.projectId}/masks/${imageId}/${randomUUID()}.msk`;
  const uploadUrl = await presignPutObject(key, body.contentType, 300);

  return NextResponse.json({ uploadUrl, key });
}

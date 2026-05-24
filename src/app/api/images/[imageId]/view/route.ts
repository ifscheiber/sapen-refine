import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  const img = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true, storageKey: true, contentType: true, filename: true },
  });
  if (!img) return apiError("IMAGE_NOT_FOUND", 404);

  // Access check: user must be member of project
  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: img.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return apiError("FORBIDDEN", 403);

  return NextResponse.json({
    url: `/api/images/${img.id}/asset`,
    filename: img.filename,
    contentType: img.contentType,
  });
});

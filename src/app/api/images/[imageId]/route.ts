import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });

  if (!image) {
    return apiError("IMAGE_NOT_FOUND", 404);
  }

  // Authorization: User muss Projektmitglied sein
  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });

  if (!membership) {
    return apiError("FORBIDDEN", 403);
  }

  return NextResponse.redirect(new URL(`/api/images/${image.id}/asset`, _req.url));
});

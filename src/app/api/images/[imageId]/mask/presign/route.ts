import { prisma } from "@/server/db";
import { canAnnotate } from "@/server/auth/policies";
import { requireUser } from "@/server/auth/rbac";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await props.params;
  const user = await requireUser();

  const image = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) return apiError("IMAGE_NOT_FOUND", 404);

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership || !canAnnotate(membership.role)) {
    return apiError("FORBIDDEN", 403);
  }

  return apiError("PRESIGNED_UPLOADS_DISABLED", 410);
});

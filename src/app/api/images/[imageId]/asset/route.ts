import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import { prisma } from "@/server/db";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";
import { inlineContentDisposition } from "@/server/http/contentDisposition";
import { getObjectBytes } from "@/server/storage/s3";

export const GET = withApiErrorHandling(async function GET(
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
  if (!image) return apiError("IMAGE_NOT_FOUND", 404);

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return apiError("FORBIDDEN", 403);

  const bytes = await getObjectBytes(image.storageKey);
  const headers = new Headers({
    "content-type": image.contentType || "application/octet-stream",
    "cache-control": "private, no-store",
  });
  if (image.filename) {
    headers.set("content-disposition", inlineContentDisposition(image.filename, `image-${image.id}`));
  }

  return new Response(toArrayBuffer(bytes), {
    status: 200,
    headers,
  });
});

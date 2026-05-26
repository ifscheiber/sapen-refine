import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";
import { computeBBoxPreviewMetadata, makeIdentityBBoxPreviewMetadata } from "@/features/editor/canvasGeometry";

export const GET = withApiErrorHandling(async function GET(
  req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const user = await requireUser();
  const { imageId } = await props.params;
  const variant = new URL(req.url).searchParams.get("variant");

  const img = await prisma.imageAsset.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      projectId: true,
      storageKey: true,
      contentType: true,
      filename: true,
      width: true,
      height: true,
    },
  });
  if (!img) return apiError("IMAGE_NOT_FOUND", 404);

  // Access check: user must be member of project
  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: img.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return apiError("FORBIDDEN", 403);

  const fallbackUrl = `/api/images/${img.id}/asset`;
  const preview =
    variant === "bbox-preview"
      ? computeBBoxPreviewMetadata(img.width, img.height)
      : img.width && img.height
        ? makeIdentityBBoxPreviewMetadata(img.width, img.height)
        : null;
  const url =
    variant === "bbox-preview" && preview?.variant === "bbox-preview"
      ? `/api/images/${img.id}/bbox-preview`
      : fallbackUrl;

  return NextResponse.json({
    url,
    fallbackUrl,
    filename: img.filename,
    contentType: img.contentType,
    variant: preview?.variant ?? "original",
    originalWidth: preview?.originalWidth ?? img.width,
    originalHeight: preview?.originalHeight ?? img.height,
    displayWidth: preview?.previewWidth ?? img.width,
    displayHeight: preview?.previewHeight ?? img.height,
    scaleX: preview?.scaleX ?? 1,
    scaleY: preview?.scaleY ?? 1,
  });
});

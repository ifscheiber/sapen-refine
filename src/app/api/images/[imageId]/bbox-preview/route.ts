import sharp from "sharp";

import { computeBBoxPreviewMetadata } from "@/features/editor/canvasGeometry";
import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import { prisma } from "@/server/db";
import { apiError, withApiErrorHandling } from "@/server/http/apiErrors";
import { inlineContentDisposition } from "@/server/http/contentDisposition";
import { getObjectBytes } from "@/server/storage/s3";

function previewContentType(contentType: string | null) {
  return contentType === "image/jpeg" ? "image/jpeg" : "image/png";
}

export const GET = withApiErrorHandling(async function GET(
  req: Request,
  props: { params: Promise<{ imageId: string }> },
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
      checksum: true,
      width: true,
      height: true,
    },
  });
  if (!image) return apiError("IMAGE_NOT_FOUND", 404);

  const membership = await prisma.annotationProjectMember.findUnique({
    where: { projectId_userId: { projectId: image.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return apiError("FORBIDDEN", 403);

  const preview = computeBBoxPreviewMetadata(image.width, image.height);
  if (!preview || preview.variant !== "bbox-preview") return apiError("BBOX_PREVIEW_NOT_REQUIRED", 404);

  const etag = `W/"bbox-preview-${image.id}-${image.checksum ?? "no-checksum"}-${preview.previewWidth}x${preview.previewHeight}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        "cache-control": "private, max-age=86400",
      },
    });
  }

  const sourceBytes = await getObjectBytes(image.storageKey);
  const contentType = previewContentType(image.contentType);
  let pipeline = sharp(Buffer.from(sourceBytes), { limitInputPixels: false })
    .resize({
      width: preview.previewWidth,
      height: preview.previewHeight,
      fit: "fill",
      withoutEnlargement: true,
    });

  pipeline = contentType === "image/jpeg"
    ? pipeline.jpeg({ quality: 86, mozjpeg: true })
    : pipeline.png({ compressionLevel: 8 });

  const bytes = await pipeline.toBuffer();
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "private, max-age=86400",
    etag,
    "x-original-width": String(preview.originalWidth),
    "x-original-height": String(preview.originalHeight),
    "x-preview-width": String(preview.previewWidth),
    "x-preview-height": String(preview.previewHeight),
  });
  if (image.filename) {
    headers.set("content-disposition", inlineContentDisposition(image.filename, `bbox-preview-${image.id}`));
  }

  return new Response(toArrayBuffer(bytes), {
    status: 200,
    headers,
  });
});

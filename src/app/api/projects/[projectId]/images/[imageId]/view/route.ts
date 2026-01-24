import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireProjectRole } from "@/server/auth/rbac";
import { s3 } from "@/server/storage/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; imageId: string }> }
) {
  const { projectId, imageId } = await ctx.params;

  await requireProjectRole(projectId, ["OWNER", "QA", "LABELER", "VIEWER"]);

  const image = await prisma.image.findFirst({
    where: { id: imageId, projectId },
    select: { storageKey: true, contentType: true, filename: true },
  });

  if (!image) {
    return NextResponse.json({ ok: false, error: "IMAGE_NOT_FOUND" }, { status: 404 });
  }

  const bucket = process.env.S3_BUCKET!;

  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: image.storageKey,
    ResponseContentType: image.contentType ?? undefined,
    ResponseContentDisposition: `inline; filename="${image.filename}"`,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
  return NextResponse.json({ ok: true, url });
}

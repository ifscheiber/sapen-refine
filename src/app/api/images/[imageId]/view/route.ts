import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3() {
  const endpoint = process.env.S3_ENDPOINT!;
  const accessKeyId = process.env.S3_ACCESS_KEY!;
  const secretAccessKey = process.env.S3_SECRET_KEY!;
  const region = process.env.S3_REGION || "us-east-1";
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || "true") === "true";

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });
}

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> }
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  const img = await prisma.image.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true, storageKey: true, contentType: true, filename: true },
  });
  if (!img) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Access check: user must be member of project
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: img.projectId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const Bucket = process.env.S3_BUCKET!;
  const s3 = getS3();

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket,
      Key: img.storageKey,
      ResponseContentType: img.contentType || undefined,
    }),
    { expiresIn: 60 * 5 }
  );

  return NextResponse.json({ url, filename: img.filename, contentType: img.contentType });
}


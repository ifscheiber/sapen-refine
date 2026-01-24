import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

import { s3 } from "@/server/storage/s3";
import { requireProjectRole } from "@/server/auth/rbac";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> } // <— wichtig
) {
  const { projectId } = await ctx.params; // <— wichtig

  await requireProjectRole(projectId, ["OWNER", "QA", "LABELER"]);

  const body = await req.json().catch(() => null);
  const filename = typeof body?.filename === "string" ? body.filename : "upload.bin";
  const contentType =
    typeof body?.contentType === "string"
      ? body.contentType
      : "application/octet-stream";

  const bucket = process.env.S3_BUCKET!;
  if (!bucket) return NextResponse.json({ ok: false, error: "S3_BUCKET_MISSING" }, { status: 500 });

  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const key = `projects/${projectId}/images/${crypto.randomUUID()}.${ext}`;

 
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
  return NextResponse.json({ ok: true, uploadUrl, key });
}


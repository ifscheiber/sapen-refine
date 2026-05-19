import { NextResponse } from "next/server";
import crypto from "crypto";

import { requireProjectRole } from "@/server/auth/rbac";
import { presignPutObject } from "@/server/storage/s3";
import { uploadErrorPayload, validateUploadSize } from "@/server/uploads/validation";

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

  if (typeof body?.size === "number") {
    const sizeValidation = validateUploadSize(body.size, "image");
    if (!sizeValidation.ok) {
      return NextResponse.json(uploadErrorPayload(sizeValidation), {
        status: sizeValidation.status,
      });
    }
  }

  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const key = `projects/${projectId}/images/${crypto.randomUUID()}.${ext}`;

  const uploadUrl = await presignPutObject(key, contentType, 60 * 5);
  return NextResponse.json({ ok: true, uploadUrl, key });
}

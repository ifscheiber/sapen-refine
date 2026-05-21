import { NextResponse } from "next/server";
import crypto from "crypto";

import { PROJECT_ANNOTATE_ROLES } from "@/server/auth/policies";
import { requireProjectRole } from "@/server/auth/rbac";
import { presignPutObject } from "@/server/storage/s3";
import { assertSupportedImageContentType, integrityErrorPayload } from "@/server/uploads/integrity";
import { uploadErrorPayload, validateUploadSize } from "@/server/uploads/validation";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> } // <— wichtig
) {
  const { projectId } = await ctx.params; // <— wichtig

  await requireProjectRole(projectId, PROJECT_ANNOTATE_ROLES);

  const body = await req.json().catch(() => null);
  let contentType;
  try {
    contentType = assertSupportedImageContentType(
      typeof body?.contentType === "string" ? body.contentType : null,
    );
  } catch (error) {
    const payload = integrityErrorPayload(error);
    if (!payload) throw error;
    return NextResponse.json(payload.body, { status: payload.status });
  }

  if (typeof body?.size === "number") {
    const sizeValidation = validateUploadSize(body.size, "image");
    if (!sizeValidation.ok) {
      return NextResponse.json(uploadErrorPayload(sizeValidation), {
        status: sizeValidation.status,
      });
    }
  }

  const ext = contentType === "image/jpeg" ? "jpg" : "png";
  const key = `projects/${projectId}/images/${crypto.randomUUID()}.${ext}`;

  const uploadUrl = await presignPutObject(key, contentType, 60 * 5);
  return NextResponse.json({ ok: true, uploadUrl, key });
}

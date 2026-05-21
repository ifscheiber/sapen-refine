import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  assistedCorrectionErrorResponse,
  saveCorrectionForTaskForUser,
} from "@/server/domain/assistedCorrection";
import { readDeclaredMaskByteLength } from "@/server/uploads/integrity";
import { readContentLength, uploadErrorPayload, validateUploadSize } from "@/server/uploads/validation";

function readPositiveInteger(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(
  req: Request,
  props: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await props.params;

  const width = readPositiveInteger(req.headers, "x-mask-width");
  if (!width) return NextResponse.json({ ok: false, error: "WIDTH_REQUIRED" }, { status: 400 });

  const height = readPositiveInteger(req.headers, "x-mask-height");
  if (!height) return NextResponse.json({ ok: false, error: "HEIGHT_REQUIRED" }, { status: 400 });

  const contentLength = readContentLength(req.headers);
  if (contentLength !== null) {
    const earlyValidation = validateUploadSize(contentLength, "mask");
    if (!earlyValidation.ok) {
      return NextResponse.json(uploadErrorPayload(earlyValidation), { status: earlyValidation.status });
    }
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  const declaredClientBytes = readDeclaredMaskByteLength(req.headers);

  try {
    const result = await saveCorrectionForTaskForUser({
      taskId,
      userId: user.id,
      bytes,
      width,
      height,
      contentType: req.headers.get("content-type"),
      format: req.headers.get("x-mask-format"),
      expectedChecksum: req.headers.get("x-checksum"),
      declaredClientBytes,
    });
    return NextResponse.json({ ok: true, correction: result });
  } catch (error) {
    const payload = assistedCorrectionErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

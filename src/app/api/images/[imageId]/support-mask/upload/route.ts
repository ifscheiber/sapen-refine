import crypto, { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createSupportMaskVersionForUser,
  loadSliceStateForUser,
  sliceErrorResponse,
} from "@/server/domain/slices";
import { putObject } from "@/server/storage/s3";
import {
  readContentLength,
  uploadErrorPayload,
  validateUploadSize,
} from "@/server/uploads/validation";

function readPositiveInteger(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(
  req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  const width = readPositiveInteger(req.headers, "x-mask-width");
  if (!width) return NextResponse.json({ ok: false, error: "WIDTH_REQUIRED" }, { status: 400 });

  const height = readPositiveInteger(req.headers, "x-mask-height");
  if (!height) return NextResponse.json({ ok: false, error: "HEIGHT_REQUIRED" }, { status: 400 });

  const contentLength = readContentLength(req.headers);
  if (contentLength !== null) {
    const earlyValidation = validateUploadSize(contentLength, "mask");
    if (!earlyValidation.ok) {
      return NextResponse.json(uploadErrorPayload(earlyValidation), {
        status: earlyValidation.status,
      });
    }
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  const sizeValidation = validateUploadSize(bytes.byteLength, "mask");
  if (!sizeValidation.ok) {
    return NextResponse.json(uploadErrorPayload(sizeValidation), {
      status: sizeValidation.status,
    });
  }

  try {
    if (bytes.byteLength !== width * height) {
      return NextResponse.json({ ok: false, error: "MASK_SIZE_MISMATCH" }, { status: 400 });
    }

    const preflight = await loadSliceStateForUser({ imageId, userId: user.id });
    if (!preflight.canEdit) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    if (
      (preflight.image.width && preflight.image.width !== width) ||
      (preflight.image.height && preflight.image.height !== height)
    ) {
      return NextResponse.json({ ok: false, error: "MASK_DIMENSION_MISMATCH" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const storageKey = `projects/${preflight.image.projectId}/support-masks/${imageId}/${randomUUID()}.msk`;
    const checksum = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

    await putObject(storageKey, bytes, contentType);

    const state = await createSupportMaskVersionForUser({
      imageId,
      userId: user.id,
      storageKey,
      contentType,
      size: bytes.byteLength,
      checksum,
      width,
      height,
      format: req.headers.get("x-mask-format") || "u8raw-v1",
    });

    return NextResponse.json({
      ok: true,
      sliceInstance: state.sliceInstance,
      latestSupportMask: state.latestSupportMask,
    });
  } catch (error) {
    const payload = sliceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

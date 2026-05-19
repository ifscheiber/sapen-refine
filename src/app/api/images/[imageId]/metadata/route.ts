import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  loadImageMetadataBundle,
  metadataErrorResponse,
  updateImageMetadataForUser,
} from "@/server/domain/metadata";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ imageId: string }> }
) {
  const user = await requireUser();
  const { imageId } = await ctx.params;

  try {
    const bundle = await loadImageMetadataBundle(imageId, user.id);
    if (!bundle) return NextResponse.json({ ok: false, error: "IMAGE_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, ...bundle });
  } catch (error) {
    const payload = metadataErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ imageId: string }> }
) {
  const user = await requireUser();
  const { imageId } = await ctx.params;
  const body = await req.json().catch(() => null);

  try {
    const bundle = await updateImageMetadataForUser({ imageId, userId: user.id, input: body });
    return NextResponse.json({ ok: true, ...bundle });
  } catch (error) {
    const payload = metadataErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

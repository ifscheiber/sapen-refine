import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { loadSliceStateForUser, sliceErrorResponse } from "@/server/domain/slices";

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const state = await loadSliceStateForUser({ imageId, userId: user.id });
    if (!state.latestSupportMask) {
      return NextResponse.json({ ok: true, exists: false });
    }

    return NextResponse.json({
      ok: true,
      exists: true,
      versionId: state.latestSupportMask.id,
      version: state.latestSupportMask.version,
      size: state.latestSupportMask.size,
      width: state.latestSupportMask.width,
      height: state.latestSupportMask.height,
      format: state.latestSupportMask.format,
      reviewState: state.latestSupportMask.reviewState,
      createdAt: state.latestSupportMask.createdAt,
      createdBy: state.latestSupportMask.createdBy,
      url: `/api/images/${imageId}/mask/versions/${state.latestSupportMask.id}/asset`,
    });
  } catch (error) {
    const payload = sliceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

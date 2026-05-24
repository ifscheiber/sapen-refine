import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { loadSliceStateForUser, sliceErrorResponse } from "@/server/domain/slices";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

function withSupportMaskUrl(imageId: string, state: Awaited<ReturnType<typeof loadSliceStateForUser>>) {
  return {
    ...state,
    latestSupportMask: state.latestSupportMask
      ? {
          ...state.latestSupportMask,
          url: `/api/images/${imageId}/mask/versions/${state.latestSupportMask.id}/asset`,
        }
      : null,
  };
}

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const state = await loadSliceStateForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...withSupportMaskUrl(imageId, state) });
  } catch (error) {
    const payload = sliceErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

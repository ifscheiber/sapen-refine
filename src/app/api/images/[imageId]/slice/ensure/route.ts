import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { ensureDefaultSliceInstanceForUser, sliceErrorResponse } from "@/server/domain/slices";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const POST = withApiErrorHandling(async function POST(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;
  await enforceHighCostRouteLimit({
    family: "save:slice-metadata",
    userId: user.id,
    scope: [imageId],
  });

  try {
    const state = await ensureDefaultSliceInstanceForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

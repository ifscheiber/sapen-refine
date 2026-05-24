import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  ensureCurrentCropsForImageForUser,
  sliceCropErrorResponse,
} from "@/server/domain/sliceCrops";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const body = await req.json().catch(() => null);
    const state = await ensureCurrentCropsForImageForUser({
      imageId,
      userId: user.id,
      sliceInstanceId: typeof body?.sliceInstanceId === "string" ? body.sliceInstanceId : null,
      paddingRequestedPx: body?.paddingRequestedPx,
    });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceCropErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

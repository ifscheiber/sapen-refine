import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  listSliceCropsForImageForUser,
  sliceCropErrorResponse,
} from "@/server/domain/sliceCrops";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const state = await listSliceCropsForImageForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceCropErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

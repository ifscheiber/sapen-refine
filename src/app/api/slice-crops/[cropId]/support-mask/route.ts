import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  cropSupportMaskErrorResponse,
  loadCropSupportMaskStateForUser,
} from "@/server/domain/cropSupportMasks";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ cropId: string }> },
) {
  const user = await requireUser();
  const { cropId } = await props.params;

  try {
    const state = await loadCropSupportMaskStateForUser({ cropId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = cropSupportMaskErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

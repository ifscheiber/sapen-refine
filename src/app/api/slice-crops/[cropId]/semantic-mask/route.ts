import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  cropSemanticMaskErrorResponse,
  loadCropSemanticMaskStateForUser,
} from "@/server/domain/cropSemanticMasks";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ cropId: string }> },
) {
  const user = await requireUser();
  const { cropId } = await props.params;

  try {
    const state = await loadCropSemanticMaskStateForUser({ cropId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = cropSemanticMaskErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

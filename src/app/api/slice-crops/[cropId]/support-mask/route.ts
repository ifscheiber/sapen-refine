import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  cropSupportMaskErrorResponse,
  loadCropSupportMaskStateForUser,
} from "@/server/domain/cropSupportMasks";

export async function GET(
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
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

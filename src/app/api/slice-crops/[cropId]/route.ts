import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  getSliceCropForUser,
  sliceCropErrorResponse,
} from "@/server/domain/sliceCrops";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ cropId: string }> },
) {
  const user = await requireUser();
  const { cropId } = await props.params;

  try {
    const crop = await getSliceCropForUser({ cropId, userId: user.id });
    return NextResponse.json({ ok: true, crop });
  } catch (error) {
    const payload = sliceCropErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

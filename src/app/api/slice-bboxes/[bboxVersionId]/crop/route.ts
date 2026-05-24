import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  generateCropForSliceBBox,
  sliceCropErrorResponse,
} from "@/server/domain/sliceCrops";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ bboxVersionId: string }> },
) {
  const user = await requireUser();
  const { bboxVersionId } = await props.params;
  await enforceHighCostRouteLimit({
    family: "save:crop-artifact",
    userId: user.id,
    scope: [bboxVersionId],
  });

  try {
    const body = await req.json().catch(() => null);
    const crop = await generateCropForSliceBBox({
      bboxVersionId,
      userId: user.id,
      paddingRequestedPx: body?.paddingRequestedPx,
    });
    return NextResponse.json({ ok: true, crop }, { status: 201 });
  } catch (error) {
    const payload = sliceCropErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  confirmImageBBoxSetForUser,
  sliceBoundingBoxErrorResponse,
} from "@/server/domain/sliceBboxes";
import { ensureCurrentCropsForImageForUser } from "@/server/domain/sliceCrops";
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
    const state = await confirmImageBBoxSetForUser({ imageId, userId: user.id });
    await ensureCurrentCropsForImageForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

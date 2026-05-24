import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  deleteSliceBoundingBoxForUser,
  replaceSliceBoundingBoxForUser,
  sliceBoundingBoxErrorResponse,
} from "@/server/domain/sliceBboxes";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const PATCH = withApiErrorHandling(async function PATCH(
  req: Request,
  props: { params: Promise<{ bboxVersionId: string }> },
) {
  const user = await requireUser();
  const { bboxVersionId } = await props.params;
  await enforceHighCostRouteLimit({
    family: "save:slice-metadata",
    userId: user.id,
    scope: [bboxVersionId],
  });

  try {
    const body = await req.json().catch(() => null);
    const box = await replaceSliceBoundingBoxForUser({
      bboxVersionId,
      userId: user.id,
      box: body ?? {},
    });
    return NextResponse.json({ ok: true, box });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

export const DELETE = withApiErrorHandling(async function DELETE(
  _req: Request,
  props: { params: Promise<{ bboxVersionId: string }> },
) {
  const user = await requireUser();
  const { bboxVersionId } = await props.params;
  await enforceHighCostRouteLimit({
    family: "save:slice-metadata",
    userId: user.id,
    scope: [bboxVersionId],
  });

  try {
    const box = await deleteSliceBoundingBoxForUser({ bboxVersionId, userId: user.id });
    return NextResponse.json({ ok: true, box });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

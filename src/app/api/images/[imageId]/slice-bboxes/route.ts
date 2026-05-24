import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createSliceBoundingBoxForUser,
  listSliceBoundingBoxesForUser,
  sliceBoundingBoxErrorResponse,
} from "@/server/domain/sliceBboxes";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const GET = withApiErrorHandling(async function GET(
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
    const state = await listSliceBoundingBoxesForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const body = await req.json().catch(() => null);
    const box = await createSliceBoundingBoxForUser({ imageId, userId: user.id, box: body ?? {} });
    return NextResponse.json({ ok: true, box }, { status: 201 });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

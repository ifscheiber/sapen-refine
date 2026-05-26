import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  loadImageAnnotationReviewForUser,
  transitionImageAnnotationReviewForUser,
} from "@/server/domain/imageAnnotationReview";
import { parseReviewAction, reviewErrorResponse } from "@/server/domain/review";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const state = await loadImageAnnotationReviewForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = reviewErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const state = await transitionImageAnnotationReviewForUser({
      imageId,
      userId: user.id,
      action: parseReviewAction(body?.action),
      comment: body?.comment,
      reason: body?.reason,
    });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = reviewErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

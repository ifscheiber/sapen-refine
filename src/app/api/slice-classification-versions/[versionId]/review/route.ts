import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  parseReviewAction,
  reviewErrorResponse,
  transitionSliceClassificationVersionForUser,
} from "@/server/domain/review";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ versionId: string }> },
) {
  const user = await requireUser();
  const { versionId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const result = await transitionSliceClassificationVersionForUser({
      versionId,
      userId: user.id,
      action: parseReviewAction(body?.action),
      comment: body?.comment,
      reason: body?.reason,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const payload = reviewErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

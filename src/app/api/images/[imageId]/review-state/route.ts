import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { loadImageReviewStateForUser, reviewErrorResponse } from "@/server/domain/review";

export async function GET(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const state = await loadImageReviewStateForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = reviewErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  assistedCorrectionErrorResponse,
  loadCorrectionContextForUser,
} from "@/server/domain/assistedCorrection";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await props.params;

  try {
    const context = await loadCorrectionContextForUser({ taskId, userId: user.id });
    return NextResponse.json({ ok: true, context });
  } catch (error) {
    const payload = assistedCorrectionErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

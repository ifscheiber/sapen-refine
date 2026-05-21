import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  getModelRunForUser,
  predictionProvenanceErrorResponse,
} from "@/server/domain/predictionProvenance";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ modelRunId: string }> },
) {
  const user = await requireUser();
  const { modelRunId } = await props.params;

  try {
    const modelRun = await getModelRunForUser({ modelRunId, userId: user.id });
    return NextResponse.json({ ok: true, modelRun });
  } catch (error) {
    const payload = predictionProvenanceErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

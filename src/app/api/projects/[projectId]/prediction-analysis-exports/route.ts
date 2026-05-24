import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createPredictionAnalysisExportForUser,
  predictionAnalysisExportErrorResponse,
} from "@/server/domain/predictionAnalysisExports";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const exportBatch = await createPredictionAnalysisExportForUser({
      projectId,
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, export: exportBatch });
  } catch (error) {
    const payload = predictionAnalysisExportErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

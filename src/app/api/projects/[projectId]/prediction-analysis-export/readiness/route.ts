import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  predictionAnalysisExportErrorResponse,
  resolveProjectPredictionAnalysisReadiness,
  sanitizePredictionAnalysisReadiness,
} from "@/server/domain/predictionAnalysisExports";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  const url = new URL(req.url);
  const targetTypeParams = url.searchParams.getAll("targetType");

  try {
    const readiness = await resolveProjectPredictionAnalysisReadiness({
      projectId,
      userId: user.id,
      input: {
        predictionRunId: url.searchParams.get("predictionRunId"),
        modelRunId: url.searchParams.get("modelRunId"),
        targetTypes: targetTypeParams.length > 0 ? targetTypeParams : url.searchParams.get("targetTypes"),
        includeHumanReferences: url.searchParams.get("includeHumanReferences"),
      },
    });
    return NextResponse.json({ ok: true, ...sanitizePredictionAnalysisReadiness(readiness) });
  } catch (error) {
    const payload = predictionAnalysisExportErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

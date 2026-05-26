import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  getPredictionAnalysisExportForUser,
  predictionAnalysisExportErrorResponse,
} from "@/server/domain/predictionAnalysisExports";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ exportId: string }> },
) {
  const user = await requireUser();
  const { exportId } = await props.params;

  try {
    const exportBatch = await getPredictionAnalysisExportForUser({ exportId, userId: user.id });
    return NextResponse.json({ ok: true, export: exportBatch });
  } catch (error) {
    const payload = predictionAnalysisExportErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

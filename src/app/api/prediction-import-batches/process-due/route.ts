import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  predictionImportBatchErrorResponse,
  processDuePredictionImportBatchesForUser,
} from "@/server/domain/predictionImportBatches";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const POST = withApiErrorHandling(async function POST(req: Request) {
  const user = await requireUser();
  await enforceHighCostRouteLimit({
    family: "prediction-import:process-or-retry",
    userId: user.id,
    scope: ["process-due"],
  });
  const body = await req.json().catch(() => null);

  try {
    const result = await processDuePredictionImportBatchesForUser({
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

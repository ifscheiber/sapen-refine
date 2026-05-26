import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  getPredictionImportBatchForUser,
  predictionImportBatchErrorResponse,
} from "@/server/domain/predictionImportBatches";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ batchId: string }> },
) {
  const user = await requireUser();
  const { batchId } = await props.params;

  try {
    const batch = await getPredictionImportBatchForUser({ batchId, userId: user.id });
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

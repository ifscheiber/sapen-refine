import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  predictionImportBatchErrorResponse,
  retryPredictionImportBatchForUser,
} from "@/server/domain/predictionImportBatches";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ batchId: string }> },
) {
  const user = await requireUser();
  const { batchId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const result = await retryPredictionImportBatchForUser({
      batchId,
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

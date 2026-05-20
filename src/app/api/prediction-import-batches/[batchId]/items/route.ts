import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  listPredictionImportBatchItemsForUser,
  predictionImportBatchErrorResponse,
} from "@/server/domain/predictionImportBatches";

export async function GET(
  _req: Request,
  props: { params: Promise<{ batchId: string }> },
) {
  const user = await requireUser();
  const { batchId } = await props.params;

  try {
    const items = await listPredictionImportBatchItemsForUser({ batchId, userId: user.id });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

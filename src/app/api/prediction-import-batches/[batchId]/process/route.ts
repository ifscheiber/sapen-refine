import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  predictionImportBatchErrorResponse,
  processPredictionImportBatchForUser,
} from "@/server/domain/predictionImportBatches";

export async function POST(
  req: Request,
  props: { params: Promise<{ batchId: string }> },
) {
  const user = await requireUser();
  const { batchId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const result = await processPredictionImportBatchForUser({
      batchId,
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

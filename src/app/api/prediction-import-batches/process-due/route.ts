import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  predictionImportBatchErrorResponse,
  processDuePredictionImportBatchesForUser,
} from "@/server/domain/predictionImportBatches";

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json().catch(() => null);

  try {
    const result = await processDuePredictionImportBatchesForUser({
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

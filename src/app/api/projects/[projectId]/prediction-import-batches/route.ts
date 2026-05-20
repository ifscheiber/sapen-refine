import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  listProjectPredictionImportBatchesForUser,
  predictionImportBatchErrorResponse,
} from "@/server/domain/predictionImportBatches";

export async function GET(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  const searchParams = new URL(req.url).searchParams;

  try {
    const batches = await listProjectPredictionImportBatchesForUser({
      projectId,
      userId: user.id,
      limit: searchParams.get("limit"),
    });
    return NextResponse.json({ ok: true, batches });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

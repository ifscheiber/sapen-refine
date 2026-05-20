import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  getPredictionRunForUser,
  predictionProvenanceErrorResponse,
} from "@/server/domain/predictionProvenance";

export async function GET(
  _req: Request,
  props: { params: Promise<{ predictionRunId: string }> },
) {
  const user = await requireUser();
  const { predictionRunId } = await props.params;

  try {
    const predictionRun = await getPredictionRunForUser({ predictionRunId, userId: user.id });
    return NextResponse.json({ ok: true, predictionRun });
  } catch (error) {
    const payload = predictionProvenanceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

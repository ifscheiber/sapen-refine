import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createPredictionRunForUser,
  listProjectPredictionRunsForUser,
  predictionProvenanceErrorResponse,
} from "@/server/domain/predictionProvenance";

export async function GET(
  _req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;

  try {
    const predictionRuns = await listProjectPredictionRunsForUser({ projectId, userId: user.id });
    return NextResponse.json({ ok: true, predictionRuns });
  } catch (error) {
    const payload = predictionProvenanceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const predictionRun = await createPredictionRunForUser({
      projectId,
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, predictionRun });
  } catch (error) {
    const payload = predictionProvenanceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

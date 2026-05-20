import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  correctionTaskErrorResponse,
  createCorrectionTasksForPredictionRunForUser,
} from "@/server/domain/correctionTasks";

export async function POST(
  req: Request,
  props: { params: Promise<{ predictionRunId: string }> },
) {
  const user = await requireUser();
  const { predictionRunId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const result = await createCorrectionTasksForPredictionRunForUser({
      predictionRunId,
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const payload = correctionTaskErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

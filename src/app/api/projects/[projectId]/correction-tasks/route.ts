import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  correctionTaskErrorResponse,
  listProjectCorrectionTasksForUser,
} from "@/server/domain/correctionTasks";

export async function GET(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  const searchParams = new URL(req.url).searchParams;

  try {
    const result = await listProjectCorrectionTasksForUser({
      projectId,
      userId: user.id,
      scope: searchParams.get("scope"),
      status: searchParams.get("status"),
      targetType: searchParams.get("targetType"),
      reason: searchParams.get("reason"),
      predictionRunId: searchParams.get("predictionRunId"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const payload = correctionTaskErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

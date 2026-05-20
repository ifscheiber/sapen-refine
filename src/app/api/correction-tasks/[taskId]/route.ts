import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  correctionTaskErrorResponse,
  getCorrectionTaskForUser,
  updateCorrectionTaskForUser,
} from "@/server/domain/correctionTasks";

export async function GET(
  _req: Request,
  props: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await props.params;

  try {
    const task = await getCorrectionTaskForUser({ taskId, userId: user.id });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    const payload = correctionTaskErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const task = await updateCorrectionTaskForUser({ taskId, userId: user.id, input: body });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    const payload = correctionTaskErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

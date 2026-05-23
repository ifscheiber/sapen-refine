import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  loadSliceClassificationStateForUser,
  setSliceInstanceClassificationForUser,
  sliceClassificationErrorResponse,
} from "@/server/domain/sliceClassifications";

export async function GET(
  _req: Request,
  props: { params: Promise<{ sliceInstanceId: string }> },
) {
  const user = await requireUser();
  const { sliceInstanceId } = await props.params;

  try {
    const state = await loadSliceClassificationStateForUser({
      sliceInstanceId,
      userId: user.id,
    });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceClassificationErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ sliceInstanceId: string }> },
) {
  const user = await requireUser();
  const { sliceInstanceId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const state = await setSliceInstanceClassificationForUser({
      sliceInstanceId,
      userId: user.id,
      class: body?.class,
    });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceClassificationErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

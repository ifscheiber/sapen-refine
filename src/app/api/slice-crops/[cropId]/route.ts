import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  getSliceCropForUser,
  sliceCropErrorResponse,
} from "@/server/domain/sliceCrops";

export async function GET(
  _req: Request,
  props: { params: Promise<{ cropId: string }> },
) {
  const user = await requireUser();
  const { cropId } = await props.params;

  try {
    const crop = await getSliceCropForUser({ cropId, userId: user.id });
    return NextResponse.json({ ok: true, crop });
  } catch (error) {
    const payload = sliceCropErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

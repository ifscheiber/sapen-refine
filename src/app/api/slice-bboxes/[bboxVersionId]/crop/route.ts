import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  generateCropForSliceBBox,
  sliceCropErrorResponse,
} from "@/server/domain/sliceCrops";

export async function POST(
  req: Request,
  props: { params: Promise<{ bboxVersionId: string }> },
) {
  const user = await requireUser();
  const { bboxVersionId } = await props.params;

  try {
    const body = await req.json().catch(() => null);
    const crop = await generateCropForSliceBBox({
      bboxVersionId,
      userId: user.id,
      paddingRequestedPx: body?.paddingRequestedPx,
    });
    return NextResponse.json({ ok: true, crop }, { status: 201 });
  } catch (error) {
    const payload = sliceCropErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

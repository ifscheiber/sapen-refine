import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  deleteSliceBoundingBoxForUser,
  replaceSliceBoundingBoxForUser,
  sliceBoundingBoxErrorResponse,
} from "@/server/domain/sliceBboxes";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ bboxVersionId: string }> },
) {
  const user = await requireUser();
  const { bboxVersionId } = await props.params;

  try {
    const body = await req.json().catch(() => null);
    const box = await replaceSliceBoundingBoxForUser({
      bboxVersionId,
      userId: user.id,
      box: body ?? {},
    });
    return NextResponse.json({ ok: true, box });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ bboxVersionId: string }> },
) {
  const user = await requireUser();
  const { bboxVersionId } = await props.params;

  try {
    const box = await deleteSliceBoundingBoxForUser({ bboxVersionId, userId: user.id });
    return NextResponse.json({ ok: true, box });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

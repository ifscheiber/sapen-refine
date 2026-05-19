import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { setSliceClassificationForUser, sliceErrorResponse } from "@/server/domain/slices";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const state = await setSliceClassificationForUser({
      imageId,
      userId: user.id,
      class: body?.class,
    });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

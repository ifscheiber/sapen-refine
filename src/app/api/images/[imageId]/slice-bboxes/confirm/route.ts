import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  confirmImageBBoxSetForUser,
  sliceBoundingBoxErrorResponse,
} from "@/server/domain/sliceBboxes";

export async function POST(
  _req: Request,
  props: { params: Promise<{ imageId: string }> },
) {
  const user = await requireUser();
  const { imageId } = await props.params;

  try {
    const state = await confirmImageBBoxSetForUser({ imageId, userId: user.id });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const payload = sliceBoundingBoxErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

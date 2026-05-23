import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  cropReadinessErrorResponse,
  resolveCropWorkflowReadinessForUser,
  sanitizeCropWorkflowReadiness,
} from "@/server/domain/cropReadiness";

export async function GET(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  const url = new URL(req.url);
  const imageId = url.searchParams.get("imageId") || undefined;
  const sliceInstanceId = url.searchParams.get("sliceInstanceId") || undefined;

  try {
    const readiness = await resolveCropWorkflowReadinessForUser({
      projectId,
      userId: user.id,
      imageId,
      sliceInstanceId,
    });
    return NextResponse.json({ ok: true, ...sanitizeCropWorkflowReadiness(readiness) });
  } catch (error) {
    const payload = cropReadinessErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

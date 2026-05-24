import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  cropReadinessErrorResponse,
  resolveCropWorkflowReadinessForUser,
  sanitizeCropWorkflowReadiness,
} from "@/server/domain/cropReadiness";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
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
    return apiErrorFromPayload(payload);
  }
});

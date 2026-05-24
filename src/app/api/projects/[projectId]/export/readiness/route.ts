import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  exportErrorResponse,
  resolveProjectExportReadiness,
  sanitizeReadiness,
} from "@/server/domain/exports";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;

  try {
    const readiness = await resolveProjectExportReadiness({ projectId, userId: user.id });
    return NextResponse.json({ ok: true, ...sanitizeReadiness(readiness) });
  } catch (error) {
    const payload = exportErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

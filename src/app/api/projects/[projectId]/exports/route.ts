import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createTrainingExportForUser,
  exportErrorResponse,
  parseExportTargets,
} from "@/server/domain/exports";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  await enforceHighCostRouteLimit({
    family: "export:create",
    userId: user.id,
    scope: [projectId],
  });
  const body = await req.json().catch(() => null);

  try {
    const exportBatch = await createTrainingExportForUser({
      projectId,
      userId: user.id,
      targets: parseExportTargets(body?.targets),
    });
    return NextResponse.json({ ok: true, export: exportBatch }, { status: 202 });
  } catch (error) {
    const payload = exportErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

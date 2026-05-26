import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { exportJobErrorResponse, processDueExportJobsForUser } from "@/server/domain/exportJobs";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const POST = withApiErrorHandling(async function POST(req: Request) {
  const user = await requireUser();
  await enforceHighCostRouteLimit({
    family: "operations:cleanup-or-admin",
    userId: user.id,
    scope: ["export-jobs", "process-due"],
  });
  const body = await req.json().catch(() => null);

  try {
    const result = await processDueExportJobsForUser({
      userId: user.id,
      input: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiErrorFromPayload(exportJobErrorResponse(error));
  }
});

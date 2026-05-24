import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  runStorageCleanup,
  storageCleanupErrorResponse,
} from "@/server/domain/storageCleanup";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { enforceHighCostRouteLimit } from "@/server/http/highCostRateLimit";

export const POST = withApiErrorHandling(async function POST(req: Request) {
  try {
    const user = await requireUser();
    await enforceHighCostRouteLimit({
      family: "operations:cleanup-or-admin",
      userId: user.id,
      scope: ["storage-cleanup"],
    });
    const body = await req.json().catch(() => null);
    const cleanup = await runStorageCleanup({ actorId: user.id, input: body });
    return NextResponse.json({ ok: true, cleanup });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") throw error;
    const payload = storageCleanupErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

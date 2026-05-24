import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  runStorageCleanup,
  storageCleanupErrorResponse,
} from "@/server/domain/storageCleanup";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const cleanup = await runStorageCleanup({ actorId: user.id, input: body });
    return NextResponse.json({ ok: true, cleanup });
  } catch (error) {
    const payload = storageCleanupErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

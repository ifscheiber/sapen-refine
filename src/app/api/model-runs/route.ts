import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createModelRunForUser,
  predictionProvenanceErrorResponse,
} from "@/server/domain/predictionProvenance";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const POST = withApiErrorHandling(async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json().catch(() => null);

  try {
    const modelRun = await createModelRunForUser({ userId: user.id, input: body });
    return NextResponse.json({ ok: true, modelRun });
  } catch (error) {
    const payload = predictionProvenanceErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

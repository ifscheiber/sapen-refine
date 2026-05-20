import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createModelRunForUser,
  predictionProvenanceErrorResponse,
} from "@/server/domain/predictionProvenance";

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json().catch(() => null);

  try {
    const modelRun = await createModelRunForUser({ userId: user.id, input: body });
    return NextResponse.json({ ok: true, modelRun });
  } catch (error) {
    const payload = predictionProvenanceErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

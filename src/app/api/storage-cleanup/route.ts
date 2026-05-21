import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  runStorageCleanup,
  storageCleanupErrorResponse,
} from "@/server/domain/storageCleanup";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const cleanup = await runStorageCleanup({ actorId: user.id, input: body });
    return NextResponse.json({ ok: true, cleanup });
  } catch (error) {
    const payload = storageCleanupErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createTrainingExportForUser,
  exportErrorResponse,
  parseExportTargets,
} from "@/server/domain/exports";

export async function POST(
  req: Request,
  props: { params: Promise<{ projectId: string }> },
) {
  const user = await requireUser();
  const { projectId } = await props.params;
  const body = await req.json().catch(() => null);

  try {
    const exportBatch = await createTrainingExportForUser({
      projectId,
      userId: user.id,
      targets: parseExportTargets(body?.targets),
    });
    return NextResponse.json({ ok: true, export: exportBatch });
  } catch (error) {
    const payload = exportErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { exportErrorResponse, getTrainingExportForUser } from "@/server/domain/exports";

export async function GET(
  _req: Request,
  props: { params: Promise<{ exportId: string }> },
) {
  const user = await requireUser();
  const { exportId } = await props.params;

  try {
    const exportBatch = await getTrainingExportForUser({ exportId, userId: user.id });
    return NextResponse.json({ ok: true, export: exportBatch });
  } catch (error) {
    const payload = exportErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

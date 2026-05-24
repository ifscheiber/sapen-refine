import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { exportErrorResponse, getTrainingExportForUser } from "@/server/domain/exports";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
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
    return apiErrorFromPayload(payload);
  }
});

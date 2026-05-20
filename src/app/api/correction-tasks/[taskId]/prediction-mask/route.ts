import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import {
  assistedCorrectionErrorResponse,
  readPredictionMaskForCorrectionTask,
} from "@/server/domain/assistedCorrection";

export async function GET(
  _req: Request,
  props: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await props.params;

  try {
    const prediction = await readPredictionMaskForCorrectionTask({ taskId, userId: user.id });
    return new Response(toArrayBuffer(prediction.bytes), {
      status: 200,
      headers: {
        "content-type": prediction.contentType,
        "cache-control": "private, no-store",
        "x-mask-format": prediction.format,
        ...(prediction.checksum ? { "x-checksum": prediction.checksum } : {}),
      },
    });
  } catch (error) {
    const payload = assistedCorrectionErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

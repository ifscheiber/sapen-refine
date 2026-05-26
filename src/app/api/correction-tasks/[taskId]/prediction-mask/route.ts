import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import {
  assistedCorrectionErrorResponse,
  readPredictionMaskForCorrectionTask,
} from "@/server/domain/assistedCorrection";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";

export const GET = withApiErrorHandling(async function GET(
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
    return apiErrorFromPayload(payload);
  }
});

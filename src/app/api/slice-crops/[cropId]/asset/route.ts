import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import {
  readSliceCropAssetForUser,
  sliceCropErrorResponse,
} from "@/server/domain/sliceCrops";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { inlineContentDisposition } from "@/server/http/contentDisposition";

export const GET = withApiErrorHandling(async function GET(
  _req: Request,
  props: { params: Promise<{ cropId: string }> },
) {
  const user = await requireUser();
  const { cropId } = await props.params;

  try {
    const { crop, bytes, contentType } = await readSliceCropAssetForUser({ cropId, userId: user.id });
    return new Response(toArrayBuffer(bytes), {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "private, no-store",
        "content-disposition": inlineContentDisposition(`slice-crop-${crop.id}.png`, `slice-crop-${crop.id}`),
      },
    });
  } catch (error) {
    return apiErrorFromPayload(sliceCropErrorResponse(error));
  }
});

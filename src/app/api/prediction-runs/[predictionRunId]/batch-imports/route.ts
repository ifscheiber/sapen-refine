import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  createPredictionImportBatchFromZipForUser,
  predictionImportBatchErrorResponse,
} from "@/server/domain/predictionImportBatches";

function payloadInvalid() {
  return NextResponse.json(
    { ok: false, error: "PREDICTION_IMPORT_BATCH_PAYLOAD_INVALID" },
    { status: 400 },
  );
}

export async function POST(
  req: Request,
  props: { params: Promise<{ predictionRunId: string }> },
) {
  const user = await requireUser();
  const { predictionRunId } = await props.params;

  const form = await req.formData().catch(() => null);
  if (!form) return payloadInvalid();

  const file = form.get("file");
  if (!(file instanceof File)) return payloadInvalid();

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const batch = await createPredictionImportBatchFromZipForUser({
      predictionRunId,
      userId: user.id,
      zipBytes: bytes,
      sourceFilename: file.name,
      contentType: file.type,
    });
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    const payload = predictionImportBatchErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

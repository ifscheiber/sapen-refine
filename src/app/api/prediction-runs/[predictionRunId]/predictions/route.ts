import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  importPredictionMaskForUser,
  predictionImportErrorResponse,
} from "@/server/domain/predictionImport";

function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
}

function positiveIntegerFromForm(form: FormData, name: string) {
  const value = formText(form, name);
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function jsonFromForm(form: FormData, name: string) {
  const value = formText(form, name);
  if (!value) return undefined;
  return JSON.parse(value);
}

function payloadInvalid() {
  return NextResponse.json(
    { ok: false, error: "PREDICTION_IMPORT_PAYLOAD_INVALID" },
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

  const imageId = formText(form, "imageId");
  const targetType = formText(form, "targetType");
  const width = positiveIntegerFromForm(form, "width");
  const height = positiveIntegerFromForm(form, "height");
  if (!imageId || !targetType || !width || !height) return payloadInvalid();

  let perClassScores;
  let outputStats;
  try {
    perClassScores = jsonFromForm(form, "perClassScoresJson");
    outputStats = jsonFromForm(form, "outputStatsJson");
  } catch {
    return payloadInvalid();
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const prediction = await importPredictionMaskForUser({
      predictionRunId,
      userId: user.id,
      imageId,
      targetType,
      bytes,
      width,
      height,
      contentType: file.type || formText(form, "contentType"),
      format: formText(form, "format"),
      coordinateSpace: formText(form, "coordinateSpace"),
      expectedChecksum: formText(form, "checksum"),
      confidenceScore: formText(form, "confidenceScore"),
      uncertaintyScore: formText(form, "uncertaintyScore"),
      perClassScores,
      outputStats,
    });

    return NextResponse.json({ ok: true, prediction });
  } catch (error) {
    const payload = predictionImportErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import {
  predictionAnalysisExportErrorResponse,
  readPredictionAnalysisExportFileForUser,
} from "@/server/domain/predictionAnalysisExports";
import { attachmentContentDisposition } from "@/server/http/contentDisposition";

function parseFile(value: string | null): "manifest" | "package" {
  return value === "manifest" ? "manifest" : "package";
}

export async function GET(
  req: Request,
  props: { params: Promise<{ exportId: string }> },
) {
  const user = await requireUser();
  const { exportId } = await props.params;
  const url = new URL(req.url);

  try {
    const file = await readPredictionAnalysisExportFileForUser({
      exportId,
      userId: user.id,
      file: parseFile(url.searchParams.get("file")),
    });
    return new Response(toArrayBuffer(file.bytes), {
      status: 200,
      headers: {
        "content-type": file.contentType,
        "content-disposition": attachmentContentDisposition(file.filename, "sapen-prediction-analysis-export.bin"),
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const payload = predictionAnalysisExportErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

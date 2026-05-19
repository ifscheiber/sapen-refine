import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import { toArrayBuffer } from "@/server/bytes";
import { exportErrorResponse, readTrainingExportFileForUser } from "@/server/domain/exports";

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
    const file = await readTrainingExportFileForUser({
      exportId,
      userId: user.id,
      file: parseFile(url.searchParams.get("file")),
    });
    return new Response(toArrayBuffer(file.bytes), {
      status: 200,
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename="${file.filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const payload = exportErrorResponse(error);
    return NextResponse.json({ ok: false, error: payload.error }, { status: payload.status });
  }
}

import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/rbac";
import {
  assistedCorrectionErrorResponse,
  loadCorrectionContextForUser,
  saveCorrectionForTaskForUser,
} from "@/server/domain/assistedCorrection";
import { recordAuditEvent } from "@/server/domain/audit";
import { apiErrorFromPayload, withApiErrorHandling } from "@/server/http/apiErrors";
import { integrityErrorPayload } from "@/server/uploads/integrity";
import { maskUploadDiagnosticsFromError, readMaskUploadRequest } from "@/server/uploads/maskRequest";

export const POST = withApiErrorHandling(async function POST(
  req: Request,
  props: { params: Promise<{ taskId: string }> },
) {
  const user = await requireUser();
  const { taskId } = await props.params;

  let context;
  try {
    context = await loadCorrectionContextForUser({ taskId, userId: user.id });
  } catch (error) {
    const payload = assistedCorrectionErrorResponse(error);
    return apiErrorFromPayload(payload);
  }

  let upload;
  try {
    upload = await readMaskUploadRequest(req);
  } catch (error) {
    const payload = integrityErrorPayload(error);
    if (!payload) throw error;
    await recordAuditEvent({
      action: "ARTIFACT_VALIDATION_FAILED",
      entity: "AnnotationTask",
      entityId: taskId,
      actorId: user.id,
      details: {
        projectId: context.task.projectId,
        imageId: context.task.imageId,
        taskId,
        artifactKind: context.humanArtifactKind,
        route: "assisted-correction-upload",
        error: payload.body.error,
        ...(maskUploadDiagnosticsFromError(error) ?? {}),
      },
    });
    return NextResponse.json(payload.body, { status: payload.status });
  }

  try {
    const result = await saveCorrectionForTaskForUser({
      taskId,
      userId: user.id,
      bytes: upload.bytes,
      width: upload.width,
      height: upload.height,
      contentType: req.headers.get("content-type"),
      format: upload.format,
      expectedChecksum: req.headers.get("x-checksum"),
      declaredClientBytes: upload.declaredClientBytes,
    });
    return NextResponse.json({ ok: true, correction: result });
  } catch (error) {
    const payload = assistedCorrectionErrorResponse(error);
    return apiErrorFromPayload(payload);
  }
});

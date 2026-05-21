import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  error: string;
  status: number;
};

export function apiError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export function apiErrorFromPayload(payload: ApiErrorPayload) {
  if (payload.error === "UNAUTHORIZED") return apiError("UNAUTHENTICATED", 401);
  return apiError(payload.error, payload.status);
}

export function apiErrorPayloadFromUnknown(
  error: unknown,
  fallback: ApiErrorPayload = { error: "INTERNAL_ERROR", status: 500 },
): ApiErrorPayload {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return { error: "UNAUTHENTICATED", status: 401 };
    if (error.message === "FORBIDDEN") return { error: "FORBIDDEN", status: 403 };
    if (error.message === "PROJECT_ID_MISSING") {
      return { error: "PROJECT_ID_MISSING", status: 400 };
    }
  }

  return fallback;
}

export function apiErrorFromUnknown(
  error: unknown,
  fallback: ApiErrorPayload = { error: "INTERNAL_ERROR", status: 500 },
) {
  return apiErrorFromPayload(apiErrorPayloadFromUnknown(error, fallback));
}

export function withApiErrorHandling<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Response | Promise<Response>,
  fallback?: ApiErrorPayload,
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiErrorFromUnknown(error, fallback);
    }
  };
}

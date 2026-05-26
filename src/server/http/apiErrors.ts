import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  error: string;
  status: number;
  message?: string;
  retryAfterSeconds?: number;
};

function apiErrorBody(payload: ApiErrorPayload) {
  return {
    ok: false,
    error: payload.error,
    ...(payload.message ? { message: payload.message } : {}),
    ...(typeof payload.retryAfterSeconds === "number"
      ? { retryAfterSeconds: payload.retryAfterSeconds }
      : {}),
  };
}

export function apiError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export function apiErrorFromPayload(payload: ApiErrorPayload) {
  if (payload.error === "UNAUTHORIZED") return apiError("UNAUTHENTICATED", 401);
  const headers = new Headers();
  if (typeof payload.retryAfterSeconds === "number") {
    headers.set("Retry-After", String(payload.retryAfterSeconds));
  }
  return NextResponse.json(apiErrorBody(payload), {
    status: payload.status,
    headers,
  });
}

function rateLimitPayload(error: Error): ApiErrorPayload | null {
  if (error.message !== "RATE_LIMITED") return null;
  const retryAfterSeconds =
    "retryAfterSeconds" in error && typeof error.retryAfterSeconds === "number"
      ? Math.max(1, Math.ceil(error.retryAfterSeconds))
      : 60;
  return {
    error: "RATE_LIMITED",
    status: 429,
    message: "Too many high-cost requests. Try again later.",
    retryAfterSeconds,
  };
}

export function apiErrorPayloadFromUnknown(
  error: unknown,
  fallback: ApiErrorPayload = { error: "INTERNAL_ERROR", status: 500 },
): ApiErrorPayload {
  if (error instanceof Error) {
    const limited = rateLimitPayload(error);
    if (limited) return limited;
    if (error.message === "UNAUTHORIZED") return { error: "UNAUTHENTICATED", status: 401 };
    if (error.message === "FORBIDDEN") return { error: "FORBIDDEN", status: 403 };
    if (error.message === "VERSION_ALLOCATION_CONFLICT") {
      return { error: "VERSION_ALLOCATION_CONFLICT", status: 409 };
    }
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

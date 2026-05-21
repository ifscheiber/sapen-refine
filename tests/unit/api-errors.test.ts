import { describe, expect, it } from "vitest";

import {
  apiErrorPayloadFromUnknown,
  apiErrorFromPayload,
  withApiErrorHandling,
} from "@/server/http/apiErrors";

describe("api error helpers", () => {
  it("maps auth and rbac exceptions to stable api codes", () => {
    expect(apiErrorPayloadFromUnknown(new Error("UNAUTHORIZED"))).toEqual({
      error: "UNAUTHENTICATED",
      status: 401,
    });
    expect(apiErrorPayloadFromUnknown(new Error("FORBIDDEN"))).toEqual({
      error: "FORBIDDEN",
      status: 403,
    });
  });

  it("sanitizes unknown errors", () => {
    expect(apiErrorPayloadFromUnknown(new Error("database exploded"))).toEqual({
      error: "INTERNAL_ERROR",
      status: 500,
    });
  });

  it("normalizes legacy unauthorized payloads", async () => {
    const response = apiErrorFromPayload({ error: "UNAUTHORIZED", status: 401 });
    await expect(response.json()).resolves.toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(response.status).toBe(401);
  });

  it("wraps route handlers with sanitized json errors", async () => {
    const handler = withApiErrorHandling(async () => {
      throw new Error("FORBIDDEN");
    });

    const response = await handler();
    await expect(response.json()).resolves.toEqual({ ok: false, error: "FORBIDDEN" });
    expect(response.status).toBe(403);
  });
});


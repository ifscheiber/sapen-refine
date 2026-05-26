import { describe, expect, it } from "vitest";

import { getHealthStatus } from "@/server/runtime/health";
import { checkReadiness } from "@/server/runtime/readiness";

describe("health status", () => {
  it("returns a stable liveness payload without dependency checks", () => {
    expect(getHealthStatus(new Date("2026-05-19T10:00:00.000Z"))).toEqual({
      status: "ok",
      service: "sapen-annotate",
      timestamp: "2026-05-19T10:00:00.000Z",
    });
  });
});

describe("readiness status", () => {
  it("reports ok when database and storage checks pass", async () => {
    const readiness = await checkReadiness({
      now: () => new Date("2026-05-19T10:01:00.000Z"),
      checkDatabase: async () => undefined,
      checkStorage: async () => undefined,
    });

    expect(readiness).toEqual({
      status: "ok",
      service: "sapen-annotate",
      timestamp: "2026-05-19T10:01:00.000Z",
      checks: {
        database: { status: "ok" },
        storage: { status: "ok" },
      },
    });
  });

  it("reports error without leaking secrets when a check fails", async () => {
    const readiness = await checkReadiness({
      now: () => new Date("2026-05-19T10:02:00.000Z"),
      checkDatabase: async () => undefined,
      checkStorage: async () => {
        throw new Error("storage unavailable");
      },
    });

    expect(readiness.status).toBe("error");
    expect(readiness.checks.database).toEqual({ status: "ok" });
    expect(readiness.checks.storage).toEqual({
      status: "error",
      message: "storage unavailable",
    });
  });
});

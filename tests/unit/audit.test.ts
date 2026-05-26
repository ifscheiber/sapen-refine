import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  prisma: { auditLog: { create: vi.fn() } },
}));

import {
  AUDIT_ACTOR_LABELS,
  auditActorContext,
  recordAuditEvent,
  withAuditActorContext,
} from "@/server/domain/audit";

describe("audit actor context", () => {
  it("keeps ordinary human audit rows compatible", async () => {
    const create = vi.fn().mockResolvedValue({});

    await recordAuditEvent(
      {
        action: "PROJECT_CREATED",
        entity: "AnnotationProject",
        entityId: "project-1",
        actorId: "user-1",
        details: { projectId: "project-1" },
      },
      { auditLog: { create } } as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: "user-1",
        action: "PROJECT_CREATED",
        entity: "AnnotationProject",
        entityId: "project-1",
        details: { projectId: "project-1" },
      },
    });
  });

  it("represents a user-triggered worker action", () => {
    expect(withAuditActorContext(
      { processorId: "worker-a", processorRunId: "run-1" },
      {
        triggeredBy: { type: "USER", userId: "user-1" },
        performedBy: {
          type: "WORKER",
          label: AUDIT_ACTOR_LABELS.exportWorker,
          processorId: "worker-a",
          processorRunId: "run-1",
        },
      },
    )).toEqual({
      processorId: "worker-a",
      processorRunId: "run-1",
      actorContext: {
        triggeredBy: { type: "USER", userId: "user-1" },
        performedBy: {
          type: "WORKER",
          label: "export-worker",
          processorId: "worker-a",
          processorRunId: "run-1",
        },
      },
    });
  });

  it("represents an operator-triggered cleanup action without secrets", () => {
    expect(auditActorContext({
      triggeredBy: { type: "OPERATOR", userId: "admin-1" },
      performedBy: { type: "OPERATOR", label: AUDIT_ACTOR_LABELS.storageCleanup },
    })).toEqual({
      triggeredBy: { type: "OPERATOR", userId: "admin-1" },
      performedBy: { type: "OPERATOR", label: "storage-cleanup" },
    });
  });

  it("rejects malformed actor contexts", () => {
    expect(() => auditActorContext({
      triggeredBy: { type: "USER" },
      performedBy: { type: "WORKER", label: AUDIT_ACTOR_LABELS.exportWorker },
    })).toThrow("USER_ID_REQUIRED");

    expect(() => auditActorContext({
      triggeredBy: { type: "USER", userId: "user-1" },
      performedBy: { type: "WORKER", label: "password=not-recorded" },
    })).toThrow("SECRET_LIKE");

    expect(() => auditActorContext({
      triggeredBy: { type: "NOT_A_TYPE" as never, userId: "user-1" },
      performedBy: { type: "WORKER", label: AUDIT_ACTOR_LABELS.exportWorker },
    })).toThrow("TYPE_INVALID");
  });
});

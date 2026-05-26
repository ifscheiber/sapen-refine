import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

type OperatorActorContextModule = {
  resolveOperatorActorContext: (params: Record<string, unknown>) => Record<string, unknown>;
  withAuditActorContext: (
    details: Record<string, unknown>,
    actorContext: Record<string, unknown>,
  ) => Record<string, unknown>;
};

type TrialBootstrapLibModule = {
  ensureTrialBootstrap: (
    prisma: Record<string, unknown>,
    options: { actorContext?: Record<string, unknown> },
  ) => Promise<Record<string, unknown>>;
};

let operatorActorContext: OperatorActorContextModule;
let trialBootstrapLib: TrialBootstrapLibModule;

beforeAll(async () => {
  operatorActorContext = await import(
    pathToFileURL(path.join(process.cwd(), "scripts/operator-actor-context.mjs")).href
  );
  trialBootstrapLib = await import(
    pathToFileURL(path.join(process.cwd(), "scripts/trial-bootstrap-lib.mjs")).href
  );
});

function mockBootstrapPrisma() {
  return {
    role: {
      upsert: vi.fn(({ where }: { where: { name: string } }) =>
        Promise.resolve({ id: `role-${where.name}`, name: where.name }),
      ),
    },
    userGlobalRole: {
      upsert: vi.fn(),
    },
    labelSchemaVersion: {
      upsert: vi.fn(() =>
        Promise.resolve({
          id: "schema-1",
          name: "sapen-annotate-default",
          version: "1.0.0",
        }),
      ),
      updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    labelDefinition: {
      upsert: vi.fn(() => Promise.resolve({})),
    },
    auditLog: {
      create: vi.fn(() => Promise.resolve({})),
    },
  };
}

describe("trial bootstrap operator attribution", () => {
  it("builds an operator-triggered script actor context", () => {
    expect(operatorActorContext.resolveOperatorActorContext({
      cliOperatorEmail: "Owner@Example.com ",
      scriptLabel: "trial-bootstrap",
      env: {},
    })).toEqual({
      triggeredBy: { type: "OPERATOR", label: "Owner@Example.com" },
      performedBy: { type: "SYSTEM", label: "trial-bootstrap" },
    });
  });

  it("requires explicit operator identity unless local system fallback is allowed", () => {
    expect(() => operatorActorContext.resolveOperatorActorContext({
      scriptLabel: "trial-bootstrap",
      env: {},
    })).toThrow("Operator attribution is required");

    expect(operatorActorContext.resolveOperatorActorContext({
      scriptLabel: "trial-bootstrap",
      allowLocalSystemActor: true,
      env: {},
    })).toEqual({
      triggeredBy: { type: "SYSTEM", label: "system:local-bootstrap" },
      performedBy: { type: "SYSTEM", label: "trial-bootstrap" },
    });

    expect(() => operatorActorContext.resolveOperatorActorContext({
      scriptLabel: "trial-bootstrap",
      allowLocalSystemActor: true,
      env: { NODE_ENV: "production" },
    })).toThrow("Operator attribution is required");
  });

  it("rejects secret-looking actor context values", () => {
    expect(() => operatorActorContext.resolveOperatorActorContext({
      cliOperatorEmail: "password=not-recorded",
      scriptLabel: "create-trial-user",
      env: {},
    })).toThrow("SECRET_LIKE");
  });

  it("writes TRIAL_BOOTSTRAP audit details with actorContext", async () => {
    const prisma = mockBootstrapPrisma();
    const actorContext = operatorActorContext.resolveOperatorActorContext({
      cliOperatorEmail: "owner@example.com",
      scriptLabel: "trial-bootstrap",
      env: {},
    });

    await trialBootstrapLib.ensureTrialBootstrap(prisma, { actorContext });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        action: "TRIAL_BOOTSTRAP",
        entity: "System",
        details: expect.objectContaining({
          actorContext,
          roles: ["ADMIN", "USER"],
          labelSchema: {
            id: "schema-1",
            name: "sapen-annotate-default",
            version: "1.0.0",
          },
        }),
      }),
    });
  });

  it("wraps TRIAL_USER_UPSERT details with non-secret actorContext", () => {
    const actorContext = operatorActorContext.resolveOperatorActorContext({
      cliOperatorEmail: "owner@example.com",
      scriptLabel: "create-trial-user",
      env: {},
    });

    expect(operatorActorContext.withAuditActorContext({
      actorKind: "TRIAL_USER_CLI",
      email: "tester@example.com",
      globalRoles: ["USER"],
      projectId: null,
      projectRole: null,
    }, actorContext)).toEqual({
      actorKind: "TRIAL_USER_CLI",
      email: "tester@example.com",
      globalRoles: ["USER"],
      projectId: null,
      projectRole: null,
      actorContext,
    });
  });

  it("documents operator attribution in script help output", () => {
    const commands = [
      ["node", ["scripts/trial-bootstrap.mjs", "--help"]],
      ["node", ["scripts/create-trial-user.mjs", "--help"]],
    ] as const;

    for (const [command, args] of commands) {
      const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8" });
      expect(result.status, `${command} ${args.join(" ")} stderr: ${result.stderr}`).toBe(0);
      expect(result.stdout).toContain("--operator-email");
      expect(result.stdout).toContain("SAPEN_OPERATOR_EMAIL");
      expect(result.stdout).toContain("--allow-local-system-actor");
    }
  });
});

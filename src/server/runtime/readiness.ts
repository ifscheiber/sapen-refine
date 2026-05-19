type ReadyCheck = {
  status: "ok" | "error";
  message?: string;
};

export type ReadinessStatus = {
  status: "ok" | "error";
  service: "sapen-annotate";
  timestamp: string;
  checks: {
    database: ReadyCheck;
    storage: ReadyCheck;
  };
};

type ReadinessDependencies = {
  now?: () => Date;
  checkDatabase?: () => Promise<void>;
  checkStorage?: () => Promise<void>;
};

async function defaultDatabaseCheck() {
  const { prisma } = await import("@/server/db");
  await prisma.$queryRaw`SELECT 1`;
}

async function defaultStorageCheck() {
  const { checkStorageReady } = await import("@/server/storage/s3");
  await checkStorageReady();
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Readiness check failed";
}

async function runCheck(fn: () => Promise<void>): Promise<ReadyCheck> {
  try {
    await fn();
    return { status: "ok" };
  } catch (error) {
    return { status: "error", message: sanitizeError(error) };
  }
}

export async function checkReadiness(
  deps: ReadinessDependencies = {}
): Promise<ReadinessStatus> {
  const database = await runCheck(deps.checkDatabase ?? defaultDatabaseCheck);
  const storage = await runCheck(deps.checkStorage ?? defaultStorageCheck);
  const status = database.status === "ok" && storage.status === "ok" ? "ok" : "error";

  return {
    status,
    service: "sapen-annotate",
    timestamp: (deps.now ?? (() => new Date()))().toISOString(),
    checks: {
      database,
      storage,
    },
  };
}

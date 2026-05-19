import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var __prisma: PrismaClient | undefined;
  var __pgPool: Pool | undefined;
  var __prismaConnectionString: string | undefined;
  var __pgPoolConnectionString: string | undefined;
}

/**
 * Singleton Pool (wichtig für Next dev HMR).
 * In Production wird das Modul typischerweise einmal geladen, aber in Dev
 * kann Next mehrfach reloaden -> ohne global Singleton: zu viele DB Connections.
 */
function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return connectionString;
}

function getPool(connectionString: string): Pool {
  if (!globalThis.__pgPool || globalThis.__pgPoolConnectionString !== connectionString) {
    if (globalThis.__pgPool) {
      void globalThis.__pgPool.end().catch((error: unknown) => {
        console.warn("Failed to close stale PostgreSQL pool", error);
      });
    }
    globalThis.__pgPool = new Pool({ connectionString });
    globalThis.__pgPoolConnectionString = connectionString;
  }
  return globalThis.__pgPool;
}

function createPrismaClient(connectionString: string): PrismaClient {
  const pool = getPool(connectionString);
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    // optional: mehr Logging in dev
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });
}

const connectionString = getConnectionString();

if (globalThis.__prisma && globalThis.__prismaConnectionString !== connectionString) {
  void globalThis.__prisma.$disconnect().catch((error: unknown) => {
    console.warn("Failed to disconnect stale Prisma client", error);
  });
  globalThis.__prisma = undefined;
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
  globalThis.__prismaConnectionString = connectionString;
}

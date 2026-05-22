import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { ensureTrialBootstrap } from "./trial-bootstrap-lib.mjs";

const { Pool } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  try {
    const result = await ensureTrialBootstrap(prisma);
    console.log("Trial bootstrap complete");
    console.log(`Roles: ${result.roles.map((role) => role.name).sort().join(", ")}`);
    console.log(`Label schema: ${result.labelSchema.name}@${result.labelSchema.version}`);
    console.log("No demo users or demo projects were created.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

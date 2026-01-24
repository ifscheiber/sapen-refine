import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";

// Prisma soll deine Next-Env laden
loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
migrations: {
  path: "prisma/migrations",
  seed: "node prisma/seed.mjs",
},

  datasource: {
    url: process.env["DATABASE_URL"],
  },
});


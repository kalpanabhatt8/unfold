import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js keeps secrets in .env.local; the Prisma CLI only auto-loads .env.
loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Empty fallback keeps URL-less commands (e.g. `prisma generate`) working
    // before a database is provisioned; migrate/db commands need the real URL.
    url: process.env.DATABASE_URL ?? "",
  },
});

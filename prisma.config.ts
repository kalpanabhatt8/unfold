import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js keeps secrets in .env.local; the Prisma CLI only auto-loads .env.
// override so a shell-exported DATABASE_URL cannot shadow .env.local.
loadEnv({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Empty fallback keeps URL-less commands (e.g. `prisma generate`) working
    // before a database is provisioned; migrate/db commands need the real URL.
    // Prefer the direct (non-pooler) URL for DDL — PgBouncer transaction mode
    // cannot run migrations reliably.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "",
  },
});

/**
 * Prisma client singleton — survives Next.js hot reloads and warm serverless
 * invocations. Server-only: never import from client components.
 *
 * Runtime uses Neon's pooled endpoint (`-pooler` host via DATABASE_URL).
 * Migrations use DATABASE_URL_UNPOOLED / DIRECT_URL (see prisma.config.ts).
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const createPool = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "",
    // Neon pooler multiplexes; keep the process-local pool modest.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  // Kick a connection open so the first user request pays less cold-start cost.
  void pool.query("SELECT 1").catch(() => {
    /* ignore — first real query will surface connection errors */
  });
  return pool;
};

const createClient = () => {
  const pool = globalForPrisma.pgPool ?? createPool();
  globalForPrisma.pgPool = pool;
  return new PrismaClient({
    adapter: new PrismaPg(pool),
  });
};

/**
 * Recreate the singleton when a long-lived Next process still holds a client
 * generated before a new model (e.g. Feedback) existed — otherwise
 * `db.feedback` stays undefined across HMR.
 */
const getClient = (): PrismaClient => {
  const cached = globalForPrisma.prisma;
  if (cached && typeof (cached as { feedback?: unknown }).feedback === "undefined") {
    void cached.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  return (globalForPrisma.prisma ??= createClient());
};

export const db = getClient();

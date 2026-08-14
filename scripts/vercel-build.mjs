import { spawnSync } from "node:child_process";

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const isProduction = process.env.VERCEL_ENV === "production";
const unpooled =
  process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || "";

if (isProduction) {
  if (!unpooled) {
    console.error(
      "DATABASE_URL_UNPOOLED is required for production prisma migrate deploy.",
    );
    process.exit(1);
  }
  // Direct URL only — PgBouncer session advisory locks leak and block later migrates.
  run("npx", ["prisma", "migrate", "deploy"], {
    DATABASE_URL: unpooled,
    DATABASE_URL_UNPOOLED: unpooled,
    DIRECT_URL: unpooled,
  });
} else {
  console.log("Skipping prisma migrate deploy on non-production Vercel builds.");
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);

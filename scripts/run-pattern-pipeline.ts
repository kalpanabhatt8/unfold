/**
 * Run server pattern generation for an account (same path as seal sync).
 * Run: npx tsx --tsconfig tsconfig.json scripts/run-pattern-pipeline.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClerkClient } from "@clerk/backend";
import { runFullPatternGeneration } from "../src/lib/server/pattern-pipeline";
import { db } from "../src/lib/server/db";

const email = process.env.PATTERN_CHECK_EMAIL ?? "kalpanabhatt818@gmail.com";
const force = process.argv.includes("--force");

async function main() {
  const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const { data } = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  const user = data[0];
  if (!user) {
    console.error("No Clerk user for", email);
    process.exit(1);
  }

  console.log("Running pattern pipeline for", email, user.id, force ? "(force)" : "");
  const ok = await runFullPatternGeneration(user.id, {
    bypassGate: force,
  });
  console.log(ok ? "Pipeline finished." : "Pipeline skipped (gate not met).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

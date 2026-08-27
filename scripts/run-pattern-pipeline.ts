/**
 * Run server pattern generation for an account (same path as seal sync).
 * Run: npx tsx --tsconfig tsconfig.json scripts/run-pattern-pipeline.ts
 *      npx tsx --tsconfig tsconfig.json scripts/run-pattern-pipeline.ts --force
 *      npx tsx --tsconfig tsconfig.json scripts/run-pattern-pipeline.ts --regen-questions
 *      npx tsx --tsconfig tsconfig.json scripts/run-pattern-pipeline.ts --regen-loops
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createRequire } from "node:module";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import type { PatternPassage } from "../src/lib/patterns/passage-types";

// tsx is not Next.js — stub server-only so pipeline modules can load.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

const email = process.env.PATTERN_CHECK_EMAIL ?? "kalpanabhatt818@gmail.com";
const userIdArg = process.argv.find((arg) => arg.startsWith("--user-id="));
const userIdOverride = userIdArg?.slice("--user-id=".length) ?? process.env.PATTERN_CHECK_USER_ID;
const force = process.argv.includes("--force");
const regenQuestions = process.argv.includes("--regen-questions");
const regenLoops = process.argv.includes("--regen-loops");

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const questionOf = (passage: PatternPassage): string | null => {
  for (const slot of passage.slots) {
    if (slot.kind === "close" && slot.endingKind === "question") {
      return slot.text;
    }
  }
  return null;
};

const mechanismOf = (passage: PatternPassage): string | null => {
  for (const slot of passage.slots) {
    if (slot.kind === "line" && slot.text) return slot.text;
  }
  return null;
};

const loadPassages = async (userId: string): Promise<PatternPassage[]> => {
  const rows = await db.patternPassage.findMany({ where: { userId } });
  return rows.map((row) => row.passage as PatternPassage);
};

const clearVoiceSlots = async (
  userId: string,
  mode: "questions" | "loops",
): Promise<Map<string, { loop: string | null; question: string | null }>> => {
  const previous = new Map<
    string,
    { loop: string | null; question: string | null }
  >();
  const rows = await db.patternPassage.findMany({ where: { userId } });
  for (const row of rows) {
    const passage = row.passage as PatternPassage;
    previous.set(passage.name, {
      loop: mechanismOf(passage),
      question: questionOf(passage),
    });
    const next: PatternPassage = {
      ...passage,
      slots: passage.slots.map((slot) => {
        if (mode === "questions") {
          return slot.kind === "close" && slot.endingKind === "question"
            ? { ...slot, text: null }
            : slot;
        }
        if (slot.kind === "line") return { ...slot, text: null };
        if (slot.kind === "close" && slot.endingKind === "question") {
          return { ...slot, text: null };
        }
        return slot;
      }),
    };
    await db.patternPassage.update({
      where: { userId_patternName: { userId, patternName: row.patternName } },
      data: { passage: next },
    });
  }
  return previous;
};

async function regenVoiceForUser(
  userId: string,
  mode: "questions" | "loops",
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const previous = await clearVoiceSlots(userId, mode);
  const label =
    mode === "loops"
      ? "Loop + reflection (Loop regen clears both)"
      : "reflection question";
  console.log(`Cleared ${previous.size} ${label}(s). Regenerating…`);

  const { generateUserPatternArtifacts } = await import(
    "../src/lib/server/generate-user-patterns"
  );
  await generateUserPatternArtifacts(userId, apiKey);

  const after = await loadPassages(userId);
  console.log("\n=== Regenerated voice ===");
  for (const passage of after) {
    const prior = previous.get(passage.name);
    console.log(`\n${passage.name}`);
    console.log("  Loop WAS:", prior?.loop ?? "(none)");
    console.log("  Loop NOW:", mechanismOf(passage) ?? "(empty — check logs)");
    console.log("  Q WAS:", prior?.question ?? "(none)");
    console.log("  Q NOW:", questionOf(passage) ?? "(empty — check logs)");
  }
}

async function main() {
  let userId = userIdOverride?.trim() ?? "";
  if (!userId) {
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
    userId = user.id;
  }

  if (regenQuestions) {
    console.log("Regenerating reflection questions for", userId);
    await regenVoiceForUser(userId, "questions");
    return;
  }

  if (regenLoops) {
    console.log("Regenerating Loops for", userId);
    await regenVoiceForUser(userId, "loops");
    return;
  }

  console.log(
    "Running pattern pipeline for",
    userId,
    force ? "(force)" : "",
  );
  const { runFullPatternGeneration } = await import(
    "../src/lib/server/pattern-pipeline"
  );
  const ok = await runFullPatternGeneration(userId, {
    bypassGate: force,
  });
  console.log(ok.ok ? "Pipeline finished." : `Pipeline finished: ${ok.reason}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

/**
 * Inspect pattern pipeline state (shared Neon DB = local + production).
 * Run: npx tsx --tsconfig tsconfig.json scripts/check-pattern-pipeline-status.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  PATTERN_GENERATION_MIN_SEALED_ENTRIES,
  PATTERN_GENERATION_MIN_TOTAL_WORDS,
} from "../src/lib/patterns/generation-gate-public";
import { countWords } from "../src/lib/patterns/entry-text";
import { isCompleteVoicePassage } from "../src/lib/patterns/passage-fill";
import {
  passageNeedsGeneration,
  type PassageSlot,
  type PatternPassage,
} from "../src/lib/patterns/passage-types";

const isVoiceSlot = (
  slot: PassageSlot,
): slot is Extract<PassageSlot, { kind: "line" } | { kind: "close" }> =>
  slot.kind === "line" ||
  (slot.kind === "close" && slot.endingKind !== "quote");

const email = process.env.PATTERN_CHECK_EMAIL ?? "kalpanabhatt818@gmail.com";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const resolveText = (row: { searchText: string; content: unknown }): string => {
  const fromSearch = row.searchText?.trim();
  if (fromSearch) return fromSearch;
  if (row.content && typeof row.content === "object" && row.content !== null) {
    const c = row.content as { textColumns?: Array<Array<{ text?: string }>> };
    if (Array.isArray(c.textColumns)) {
      return c.textColumns
        .flat()
        .map((b) => b.text?.trim() ?? "")
        .filter(Boolean)
        .join("\n");
    }
  }
  return "";
};

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

  const userId = user.id;
  console.log("\n=== Pattern pipeline status ===");
  console.log("Email:", email);
  console.log("UserId:", userId);

  const [sealedEntries, analysisCount, displayCount, passageCount, userRow] =
    await Promise.all([
      db.journalEntry.findMany({
        where: { userId, deletedAt: null, sealedAt: { not: null } },
        select: { id: true, title: true, searchText: true, content: true, sealedAt: true },
        orderBy: { sealedAt: "asc" },
      }),
      db.entryAnalysis.count({ where: { userId } }),
      db.patternDisplay.count({ where: { userId } }),
      db.patternPassage.count({ where: { userId } }),
      db.user.findUnique({
        where: { id: userId },
        select: { patternsGeneratedAt: true },
      }),
    ]);

  let totalWords = 0;
  for (const e of sealedEntries) {
    totalWords += countWords(resolveText(e));
  }

  const latestSealAt = sealedEntries.at(-1)?.sealedAt ?? null;
  const patternsGeneratedAt = userRow?.patternsGeneratedAt ?? null;

  let needsGeneration = false;
  let skipReason: string | null = null;
  if (sealedEntries.length < PATTERN_GENERATION_MIN_SEALED_ENTRIES) {
    skipReason = "insufficient_entries";
  } else if (totalWords < PATTERN_GENERATION_MIN_TOTAL_WORDS) {
    skipReason = "insufficient_words";
  } else if (
    patternsGeneratedAt &&
    latestSealAt &&
    patternsGeneratedAt.getTime() >= latestSealAt.getTime()
  ) {
    skipReason = "patterns_current";
  } else {
    needsGeneration = true;
  }

  console.log("\n--- Entries ---");
  console.log("Sealed entries:", sealedEntries.length);
  console.log("Total words (sealed):", totalWords);
  console.log("Latest seal:", latestSealAt?.toISOString() ?? "(none)");

  console.log("\n--- Gate ---");
  console.log("needsGeneration:", needsGeneration);
  console.log("skipReason:", skipReason);
  console.log("patternsGeneratedAt:", patternsGeneratedAt?.toISOString() ?? "(never)");

  console.log("\n--- Server artifacts ---");
  console.log("Entry analyses:", analysisCount, "/", sealedEntries.length);
  console.log("Pattern displays:", displayCount);
  console.log("Pattern passages:", passageCount);

  if (displayCount > 0) {
    const [displays, passageRows] = await Promise.all([
      db.patternDisplay.findMany({
        where: { userId },
        select: { patternName: true, displayTitle: true },
      }),
      db.patternPassage.findMany({ where: { userId } }),
    ]);
    console.log("\n--- Pattern titles on server ---");
    for (const d of displays) {
      console.log(`  ${d.patternName}: ${d.displayTitle}`);
    }

    console.log("\n--- Voice readiness (what UI can show) ---");
    for (const row of passageRows) {
      const p = row.passage as PatternPassage;
      const voiceSlots = p.slots.filter(isVoiceSlot);
      const filled = voiceSlots.filter((s) => s.text?.trim()).length;
      const uiStatus = isCompleteVoicePassage(p)
        ? "SHOWS in UI"
        : "HIDDEN in UI";
      console.log(
        `  ${p.name}: ${uiStatus} (${filled}/${voiceSlots.length} voice slots)`,
      );
      if (passageNeedsGeneration(p)) {
        for (const s of voiceSlots) {
          if (s.text?.trim()) continue;
          const label =
            s.kind === "close" ? `close (${s.endingKind})` : s.kind;
          console.log(`    missing: ${label}`);
        }
      }
    }
  }

  console.log("");
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

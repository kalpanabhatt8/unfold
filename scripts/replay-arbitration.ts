/**
 * Offline regression harness for pairwise pattern arbitration.
 *
 *   npx tsx scripts/replay-arbitration.ts
 *
 * Zero Claude API calls — reads stored `entry_analyses` straight from the DB,
 * replays `reconcilePatterns` (src/lib/patterns/arbitration.ts), and reports:
 *   - every analysis whose PRIMARY pattern changes or whose set shrinks
 *   - before/after agreement vs the provisional oracle labels
 *
 * Use after editing ARBITRATION_RULES to confirm the change still recovers the
 * known historical mismatches without regressing previously-correct labels.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  reconcilePatterns,
  type ArbitrationAction,
} from "../src/lib/patterns/arbitration";
import { isPatternName, type PatternName } from "../src/lib/patterns/vocabulary";
import type { PatternMatch } from "../src/lib/patterns/types";

/**
 * Provisional oracle — mirrors scripts/audit-extraction-labels.ts LABELS.
 * Inlined so this harness never imports that script (which fires a live
 * extraction on load). Update both together if the ground truth is revised.
 */
const ORACLE: Record<string, PatternName> = {
  "entry-mrxh7kzob6ig": "self_doubt", // They Chose Wrong
  "entry-mrxh9gwl8i6r": "self_doubt", // Polite or Real
  "entry-mrxh9ox0w8rd": "self_doubt", // Decided Before Evidence
  "entry-mrxh9vyp06cf": "self_doubt", // Doubt Showed Up Anyway
  "entry-mrxha21p5wfm": "perfectionism", // Can't Just Say Thank You (ambiguous)
  "entry-mrxha8u5oajk": "self_criticism", // Again
  "entry-mrxhag3863t6": "self_criticism", // Fumbled One Answer
  "entry-mrxhamavinft": "self_criticism", // Forgot the Email
  "entry-mrxhasqe2dfl": "self_criticism", // One Typo Everything Else
  "entry-mrxhazg3ytyc": "self_criticism", // One Day Breaks It
};

const asMatches = (patterns: unknown): PatternMatch[] => {
  if (!Array.isArray(patterns)) return [];
  const out: PatternMatch[] = [];
  for (const p of patterns) {
    if (p && typeof p === "object") {
      const rec = p as Record<string, unknown>;
      if (!isPatternName(rec.name)) continue;
      out.push({
        name: rec.name,
        confidence: typeof rec.confidence === "number" ? rec.confidence : 0,
        evidence: Array.isArray(rec.evidence)
          ? rec.evidence.filter((q): q is string => typeof q === "string")
          : [],
      });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
};

const fmt = (patterns: PatternMatch[]): string =>
  patterns.map((p) => `${p.name}@${p.confidence.toFixed(2)}`).join(" + ") ||
  "(none)";

const actionStr = (a: ArbitrationAction): string =>
  a.kind === "drop"
    ? `drop ${a.dropped} (→ ${a.winner})`
    : `demote ${a.loser} below ${a.winner}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [analyses, entries] = await Promise.all([
      db.entryAnalysis.findMany({ select: { entryId: true, patterns: true } }),
      db.journalEntry.findMany({ select: { id: true, title: true } }),
    ]);
    const titleById = new Map(entries.map((e) => [e.id, e.title || "(untitled)"]));

    const rule = "─".repeat(78);
    const primaryFlips: string[] = [];
    const setOnlyChanges: string[] = [];
    let totalChanged = 0;

    for (const a of analyses) {
      const before = asMatches(a.patterns);
      if (before.length === 0) continue;
      const { patterns: after, actions } = reconcilePatterns(before);
      if (actions.length === 0) continue;
      totalChanged += 1;

      const title = titleById.get(a.entryId) ?? "(untitled)";
      const beforePrimary = before[0]?.name ?? "(none)";
      const afterPrimary = after[0]?.name ?? "(none)";
      const line =
        `  ${title.padEnd(26)} ${a.entryId}\n` +
        `    before: ${fmt(before)}\n` +
        `    after:  ${fmt(after)}\n` +
        `    rule:   ${actions.map(actionStr).join("; ")}`;

      if (beforePrimary !== afterPrimary) primaryFlips.push(line);
      else setOnlyChanges.push(line);
    }

    console.log("\n" + rule);
    console.log(
      `ARBITRATION REPLAY — ${analyses.length} stored analyses, zero API calls`,
    );
    console.log(rule);
    console.log(`analyses touched by a rule: ${totalChanged}`);
    console.log(`  primary-pattern flips:    ${primaryFlips.length}`);
    console.log(`  set-only changes (drops): ${setOnlyChanges.length}`);

    console.log(`\nPRIMARY FLIPS\n${rule}`);
    console.log(primaryFlips.join("\n\n") || "  (none)");

    console.log(
      `\nSET-ONLY CHANGES (secondary dropped, primary unchanged)\n${rule}`,
    );
    console.log(setOnlyChanges.join("\n\n") || "  (none)");

    // Oracle agreement.
    const byId = new Map(analyses.map((a) => [a.entryId, a]));
    let beforeCorrect = 0;
    let afterCorrect = 0;
    const oracleLines: string[] = [];
    const oracleIds = Object.keys(ORACLE);

    for (const id of oracleIds) {
      const row = byId.get(id);
      const expected = ORACLE[id]!;
      if (!row) {
        oracleLines.push(`  ${id.padEnd(22)} MISSING from DB`);
        continue;
      }
      const before = asMatches(row.patterns);
      const after = reconcilePatterns(before).patterns;
      const beforePrimary = before[0]?.name ?? "(none)";
      const afterPrimary = after[0]?.name ?? "(none)";
      const beforeOk = beforePrimary === expected;
      const afterOk = afterPrimary === expected;
      if (beforeOk) beforeCorrect += 1;
      if (afterOk) afterCorrect += 1;
      const mark = (ok: boolean) => (ok ? "✓" : "✗");
      const title = titleById.get(id) ?? "(untitled)";
      oracleLines.push(
        `  ${title.padEnd(26)} want=${expected.padEnd(14)} ` +
          `before=${beforePrimary.padEnd(16)}${mark(beforeOk)}  ` +
          `after=${afterPrimary.padEnd(16)}${mark(afterOk)}`,
      );
    }

    const n = oracleIds.length;
    const pct = (x: number) => `${Math.round((x / n) * 100)}%`;
    console.log(`\nORACLE AGREEMENT (n=${n} labeled entries)\n${rule}`);
    console.log(oracleLines.join("\n"));
    console.log(rule);
    console.log(
      `before: ${beforeCorrect}/${n} (${pct(beforeCorrect)})   ` +
        `after: ${afterCorrect}/${n} (${pct(afterCorrect)})   ` +
        `net: ${afterCorrect - beforeCorrect >= 0 ? "+" : ""}${
          afterCorrect - beforeCorrect
        }`,
    );
    console.log(rule + "\n");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Terminal review of pattern closing-beat thumbs feedback.
 *
 * Votes: `pattern_votes` (up/down per user × pattern).
 * Reasons: `feedback` rows tagged `[pattern closing] …` (optional; best-effort).
 *
 *   npx tsx scripts/review-feedback.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PATTERN_LABELS, type PatternName } from "../src/lib/patterns/vocabulary";

const PATTERN_CLOSING_PREFIX = "[pattern closing]";

/** Canonical downvote chips from ClosingVote (normalize curly apostrophe). */
const KNOWN_REASONS = [
  "Doesn't resonate",
  "Too vague",
  "Missed what I meant",
  "Not useful right now",
  "Other",
] as const;

const normalizeApostrophe = (s: string) => s.replace(/\u2019/g, "'");

const labelFor = (patternName: string): string =>
  PATTERN_LABELS[patternName as PatternName] ?? patternName;

/**
 * Parse reason (+ optional pattern) from feedback text.
 * Formats:
 *   [pattern closing] Too vague
 *   [pattern closing] people_pleasing | Too vague
 */
const parseClosingReason = (
  text: string,
): { patternName: string | null; reason: string } | null => {
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().startsWith(PATTERN_CLOSING_PREFIX)) return null;
  const rest = trimmed.slice(PATTERN_CLOSING_PREFIX.length).trim();
  if (!rest) return null;

  const pipe = rest.indexOf("|");
  if (pipe >= 0) {
    const patternName = rest.slice(0, pipe).trim();
    const reason = normalizeApostrophe(rest.slice(pipe + 1).trim());
    if (!patternName || !reason) return null;
    return { patternName, reason };
  }

  return { patternName: null, reason: normalizeApostrophe(rest) };
};

type PatternStats = {
  patternName: string;
  total: number;
  up: number;
  down: number;
  downRate: number;
  reasons: Map<string, number>;
};

const pct = (n: number, d: number): string =>
  d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;

const pad = (s: string, width: number, align: "left" | "right" = "left"): string => {
  if (s.length >= width) return s;
  const space = " ".repeat(width - s.length);
  return align === "right" ? space + s : s + space;
};

const formatReasons = (reasons: Map<string, number>): string => {
  if (reasons.size === 0) return "—";
  const parts = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => `${reason}×${count}`);
  return parts.join(", ");
};

const bump = (map: Map<string, number>, key: string, n = 1) => {
  map.set(key, (map.get(key) ?? 0) + n);
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [votes, feedbackRows] = await Promise.all([
      db.patternVote.findMany({
        select: { patternName: true, vote: true },
      }),
      db.feedback.findMany({
        where: { text: { startsWith: PATTERN_CLOSING_PREFIX } },
        select: { text: true },
      }),
    ]);

    const byPattern = new Map<string, PatternStats>();
    for (const row of votes) {
      let stats = byPattern.get(row.patternName);
      if (!stats) {
        stats = {
          patternName: row.patternName,
          total: 0,
          up: 0,
          down: 0,
          downRate: 0,
          reasons: new Map(),
        };
        byPattern.set(row.patternName, stats);
      }
      stats.total += 1;
      if (row.vote === "down") stats.down += 1;
      else stats.up += 1;
    }

    const overallReasons = new Map<string, number>();
    let attributedReasons = 0;
    let unattributedReasons = 0;

    for (const row of feedbackRows) {
      const parsed = parseClosingReason(row.text);
      if (!parsed) continue;
      bump(overallReasons, parsed.reason);
      if (parsed.patternName) {
        attributedReasons += 1;
        let stats = byPattern.get(parsed.patternName);
        if (!stats) {
          // Reason without a matching vote row — still surface the pattern.
          stats = {
            patternName: parsed.patternName,
            total: 0,
            up: 0,
            down: 0,
            downRate: 0,
            reasons: new Map(),
          };
          byPattern.set(parsed.patternName, stats);
        }
        bump(stats.reasons, parsed.reason);
      } else {
        unattributedReasons += 1;
      }
    }

    for (const stats of byPattern.values()) {
      stats.downRate = stats.total === 0 ? 0 : stats.down / stats.total;
    }

    const rows = [...byPattern.values()].sort((a, b) => {
      if (b.downRate !== a.downRate) return b.downRate - a.downRate;
      if (b.down !== a.down) return b.down - a.down;
      return a.patternName.localeCompare(b.patternName);
    });

    const totalVotes = votes.length;
    const totalUp = votes.filter((v) => v.vote === "up").length;
    const totalDown = votes.filter((v) => v.vote === "down").length;

    const rule = "─".repeat(78);

    console.log("\nPattern closing feedback\n" + rule);
    console.log("\nOverall");
    console.log(`  Total votes:  ${totalVotes}`);
    console.log(
      `  Thumbs up:    ${totalUp}  (${pct(totalUp, totalVotes)})`,
    );
    console.log(
      `  Thumbs down:  ${totalDown}  (${pct(totalDown, totalVotes)})`,
    );
    if (totalVotes > 0) {
      console.log(
        `  Like/dislike: ${totalUp}:${totalDown}  (${pct(totalUp, totalVotes)} up)`,
      );
    }

    console.log("\nThumbs-down reasons (from feedback table)");
    if (overallReasons.size === 0) {
      console.log("  (none yet)");
    } else {
      const ordered = [
        ...KNOWN_REASONS.map((r) => normalizeApostrophe(r)),
        ...[...overallReasons.keys()].filter(
          (r) =>
            !KNOWN_REASONS.map((k) => normalizeApostrophe(k)).includes(r),
        ),
      ];
      const seen = new Set<string>();
      for (const reason of ordered) {
        if (seen.has(reason)) continue;
        seen.add(reason);
        const count = overallReasons.get(reason) ?? 0;
        if (count === 0 && !KNOWN_REASONS.map((k) => normalizeApostrophe(k)).includes(reason)) {
          continue;
        }
        if (count === 0) continue;
        console.log(`  ${pad(reason, 28)} ${count}`);
      }
      if (unattributedReasons > 0 || attributedReasons > 0) {
        console.log(
          `  (${attributedReasons} attributed to a pattern, ${unattributedReasons} unattributed)`,
        );
      }
    }

    console.log(`\nBy pattern (highest 👎 rate first)\n${rule}`);
    if (rows.length === 0) {
      console.log("(no pattern votes yet)\n");
      return;
    }

    const colPattern = 22;
    const colNum = 6;
    console.log(
      pad("Pattern", colPattern) +
        pad("Total", colNum, "right") +
        pad("Up", colNum, "right") +
        pad("Down", colNum, "right") +
        pad("Rate", colNum, "right") +
        "  Down reasons",
    );
    console.log(rule);

    for (const stats of rows) {
      const name = labelFor(stats.patternName);
      console.log(
        pad(name.slice(0, colPattern), colPattern) +
          pad(String(stats.total), colNum, "right") +
          pad(String(stats.up), colNum, "right") +
          pad(String(stats.down), colNum, "right") +
          pad(pct(stats.down, stats.total), colNum, "right") +
          "  " +
          formatReasons(stats.reasons),
      );
    }

    console.log(rule + "\n");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

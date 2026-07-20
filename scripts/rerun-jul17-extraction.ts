/**
 * Re-run extraction on the Jul 17 test-batch fixtures (5 mistagged + 5 peers).
 * Clears nothing in the browser — this is an API-level fresh classification check.
 *
 *   npx tsx scripts/rerun-jul17-extraction.ts
 */

import { readFileSync } from "node:fs";
import { extractPatterns } from "../src/lib/ai/pattern-extraction/generate";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

/** Reconstructed from the live Jul 17 test batch (mistags + peers). */
const BATCH: Array<{
  id: string;
  expectedPrimary: string;
  wasTagged: string;
  text: string;
}> = [
  {
    id: "mromu8kq2va8",
    expectedPrimary: "avoidance",
    wasTagged: "overthinking",
    text: `Sat down to fix the bug. Reread the same file three times instead of changing anything. Still not started.`,
  },
  {
    id: "fuqnsr5",
    expectedPrimary: "comparison",
    wasTagged: "overthinking",
    text: `Saw two people from college post about their promotions today. Felt weird about it. Remembered I'm building my own thing so it's not really comparable but still checked their LinkedIn anyway.`,
  },
  {
    id: "dwwymoa2d",
    expectedPrimary: "catastrophizing",
    wasTagged: "overthinking",
    text: `Client hasn't replied to the invoice email in 3 days. Thought maybe they're unhappy with the work — or just busy. Started planning how I'd redo the whole project for free if they asked.`,
  },
  {
    id: "x486yazq",
    expectedPrimary: "perfectionism",
    wasTagged: "overthinking",
    text: `Fixed the bug. Tested it once, then five more times. Started reading the surrounding code "to be sure" nothing else was broken. Two hours later realized I never actually shipped it.`,
  },
  {
    id: "tmzndn4",
    expectedPrimary: "fear_of_judgment",
    wasTagged: "overthinking",
    text: `Posted the Unfold screenshot on Twitter. Immediately regretted the caption — thought it sounded try-hard. Refreshed three times in ten minutes. No replies yet so now thinking it looks bad.`,
  },
  {
    id: "mromxaz89kr8",
    expectedPrimary: "catastrophizing|self_doubt",
    wasTagged: "?",
    text: `don't feel confident about the demo tomorrow. keep thinking i'll blank on something obvious. going to bed`,
  },
  {
    id: "xh4j2rki",
    expectedPrimary: "people_pleasing|avoidance",
    wasTagged: "?",
    text: `didn't want to tell riya the design feedback was actually bad. said "it's good, just maybe tweak spacing" instead. he seemed happy. i still think it needs a full redo`,
  },
  {
    id: "nqit3k5",
    expectedPrimary: "all_or_nothing|self_criticism",
    wasTagged: "?",
    text: `spent all day on one bug fix. feels like the whole day amounted to nothing since i didn't touch the other three things on my list`,
  },
  {
    id: "z6j4npn",
    expectedPrimary: "(none or light)",
    wasTagged: "?",
    text: `good productive day. shipped the latency fix, tested it, works clean. had filter coffee in the evening. called mom.`,
  },
  {
    id: "mrka1j7aktygi",
    expectedPrimary: "avoidance",
    wasTagged: "?",
    text: `Opened Figma to write about myself. Kept telling myself I'd make the portfolio instead of it — always easier than deciding what I want to say.`,
  },
];

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

type Match = { name: string; confidence: number; evidence: string[] };

async function main() {
  const results: Array<{
    id: string;
    expectedPrimary: string;
    wasTagged: string;
    patterns: Match[];
  }> = [];

  for (const entry of BATCH) {
    const out = await extractPatterns(apiKey!, entry.text);
    const patterns = (out.analysis?.patterns ?? []) as Match[];
    results.push({
      id: entry.id,
      expectedPrimary: entry.expectedPrimary,
      wasTagged: entry.wasTagged,
      patterns,
    });
    const names =
      patterns.map((p) => `${p.name}(${p.confidence})`).join(", ") || "(none)";
    console.log(
      `\n=== ${entry.id} [expect ${entry.expectedPrimary}; was ${entry.wasTagged}] ===`,
    );
    console.log(names);
    for (const p of patterns) {
      for (const q of p.evidence) console.log(`  [${p.name}] ${q}`);
    }
  }

  const mistagged = results.filter((r) => r.wasTagged === "overthinking");
  console.log("\n\n======== MISTAGGED FIVE — PRIMARY NOW ========");
  for (const r of mistagged) {
    const primary = r.patterns[0]?.name ?? "(none)";
    const hasOverthinking = r.patterns.some((p) => p.name === "overthinking");
    console.log(
      `${r.id}: primary=${primary} overthinking=${hasOverthinking} expected=${r.expectedPrimary}`,
    );
  }

  const overthinkingEntryIds = results
    .filter((r) => r.patterns.some((p) => p.name === "overthinking"))
    .map((r) => r.id);
  console.log(
    "\noverthinking count among batch:",
    overthinkingEntryIds.length,
    overthinkingEntryIds,
  );

  const byPattern = new Map<string, string[]>();
  for (const r of results) {
    for (const p of r.patterns) {
      const list = byPattern.get(p.name) ?? [];
      list.push(r.id);
      byPattern.set(p.name, list);
    }
  }
  console.log("\n======== SURFACING PREVIEW (need ≥3) ========");
  for (const [name, ids] of [...byPattern.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`${name}: ${ids.length} — ${ids.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

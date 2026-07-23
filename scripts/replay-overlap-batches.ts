/**
 * Replay overlap-suppression against the two manual test batches that
 * previously surfaced as duplicate cards.
 *
 * Uses structural fixtures (entry IDs + multi-tags) matching reported counts
 * and overlap. Optional live data:
 *   scripts/fixtures/overlap-live-export.json
 *   { "analyses": { ... }, "entries": { ... } } from browser localStorage
 *
 * Run: npx tsx scripts/replay-overlap-batches.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { aggregateFromInputs } from "../src/lib/patterns/aggregate";
import { entryOverlapRatio } from "../src/lib/patterns/overlap-policy";
import type { EntryAnalysis } from "../src/lib/patterns/types";
import type { JournalEntry } from "../src/lib/journal-entries";
import type { PatternName } from "../src/lib/patterns/vocabulary";
import { PATTERN_LABELS } from "../src/lib/patterns/vocabulary";

const formatPatternLabelList = (labels: string[]): string => {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
};

const foldedLine = (labels: string[]): string | null =>
  labels.length > 0
    ? `This often shows up as ${formatPatternLabelList(labels)} too.`
    : null;

const entry = (id: string, day: number): JournalEntry => ({
  id,
  title: `Entry ${id}`,
  createdAt: day,
  updatedAt: day,
  sealedAt: day,
});

const analysis = (
  entryId: string,
  patterns: Array<{ name: PatternName; confidence?: number }>,
): EntryAnalysis => ({
  entryId,
  topics: ["test"],
  patterns: patterns.map((p) => ({
    name: p.name,
    confidence: p.confidence ?? 0.85,
    evidence: [`quote from ${entryId} for ${p.name}`],
  })),
});

/** 12-entry overthinking thread + 5-entry secondary with full subset overlap. */
const buildOverthinkingBatch = () => {
  const primaryIds = Array.from({ length: 12 }, (_, i) => `ot-${i + 1}`);
  const secondaryIds = primaryIds.slice(7, 12); // 5 entries, all in primary

  const entries = primaryIds.map((id, i) => entry(id, 1_700_000_000_000 + i));
  const analyses = primaryIds.map((id, i) => {
    const patterns: Array<{ name: PatternName; confidence?: number }> = [
      { name: "overthinking", confidence: 0.88 },
    ];
    if (i >= 7) patterns.push({ name: "fear_of_judgment", confidence: 0.82 });
    return analysis(id, patterns);
  });

  return {
    label: "Overthinking batch (Courtroom / Conversation Won't Close)",
    displayTitles: {
      overthinking: "The Courtroom That Won't Adjourn",
      fear_of_judgment: "The Conversation Won't Close",
    },
    entries,
    analyses,
    expectedPrimaryCount: 12,
    expectedSecondaryPattern: "fear_of_judgment" as PatternName,
  };
};

/** Catastrophizing thread + overlapping secondary card. */
const buildCatastrophizingBatch = () => {
  const primaryIds = Array.from({ length: 10 }, (_, i) => `cat-${i + 1}`);
  const secondaryIds = primaryIds.slice(5, 10); // 5 entries, all in primary

  const entries = primaryIds.map((id, i) => entry(id, 1_700_100_000_000 + i));
  const byEntry = new Map<string, EntryAnalysis>();

  for (const id of primaryIds) {
    byEntry.set(id, analysis(id, [{ name: "catastrophizing", confidence: 0.9 }]));
  }
  for (const id of secondaryIds) {
    const row = byEntry.get(id)!;
    row.patterns.push({
      name: "overthinking",
      confidence: 0.84,
      evidence: [`quote from ${id} for overthinking`],
    });
  }

  return {
    label: "Catastrophizing batch (Story That Started / What They'd Already Decided)",
    displayTitles: {
      catastrophizing: "Story That Started Without Me",
      overthinking: "What They'd Already Decided",
    },
    entries,
    analyses: [...byEntry.values()],
    expectedPrimaryCount: 10,
    expectedSecondaryPattern: "overthinking" as PatternName,
  };
};

type Batch = ReturnType<typeof buildOverthinkingBatch>;

const summarize = (
  batch: Batch,
  applySuppression: boolean,
): ReturnType<typeof aggregateFromInputs> =>
  aggregateFromInputs(batch.analyses, batch.entries, {
    applyOverlapSuppression: applySuppression,
  });

const printBatch = (batch: Batch) => {
  console.log(`\n${"═".repeat(72)}`);
  console.log(batch.label);
  console.log("═".repeat(72));

  const before = summarize(batch, false);
  console.log("\nBEFORE overlap suppression:");
  for (const pattern of before.surfaced) {
    const title = batch.displayTitles[pattern.name] ?? PATTERN_LABELS[pattern.name];
    console.log(
      `  • ${pattern.name} (${title}) — ${pattern.entryCount} entries`,
    );
  }
  if (before.surfaced.length >= 2) {
    const [a, b] = before.surfaced;
    console.log(
      `  overlap(${a!.name}, ${b!.name}) = ${entryOverlapRatio(a!, b!).toFixed(3)}`,
    );
  }

  const after = summarize(batch, true);
  console.log("\nAFTER overlap suppression:");
  if (after.surfaced.length === 0) {
    console.log("  (no surfaced patterns)");
    return;
  }

  for (const pattern of after.surfaced) {
    const title = batch.displayTitles[pattern.name] ?? PATTERN_LABELS[pattern.name];
    console.log(`  • survivor: ${pattern.name} (${title})`);
    console.log(`    entryCount: ${pattern.entryCount}`);
    console.log(`    entryIds: ${pattern.evidence.map((e) => e.entryId).join(", ")}`);
    console.log(`    foldedLabels: ${JSON.stringify(pattern.foldedLabels)}`);
    console.log(`    suppressedPatterns: ${JSON.stringify(pattern.suppressedPatterns)}`);
    console.log(`    coPatterns: ${JSON.stringify(pattern.coPatterns)}`);
    console.log(`    UI folded line: ${foldedLine(pattern.foldedLabels) ?? "(none)"}`);
  }

  const survivor = after.surfaced[0]!;
  const okCount = survivor.entryCount === batch.expectedPrimaryCount;
  const okCards = after.surfaced.length === 1;
  const okFolded =
    survivor.suppressedPatterns.includes(batch.expectedSecondaryPattern) &&
    survivor.foldedLabels.includes(PATTERN_LABELS[batch.expectedSecondaryPattern]);

  console.log("\nChecks:");
  console.log(`  ${okCards ? "✓" : "✗"} one surfaced card`);
  console.log(
    `  ${okCount ? "✓" : "✗"} entry count = ${batch.expectedPrimaryCount} (got ${survivor.entryCount})`,
  );
  console.log(`  ${okFolded ? "✓" : "✗"} secondary folded into foldedLabels`);
};

const formatPatternLine = (pattern: {
  name: PatternName;
  entryCount: number;
  foldedLabels: string[];
  suppressedPatterns: PatternName[];
  coPatterns: string[];
  evidence: Array<{ entryId: string }>;
}): string => {
  const parts = [
    `${pattern.name} — ${pattern.entryCount} entries`,
    `ids=[${pattern.evidence.map((e) => e.entryId).join(", ")}]`,
  ];
  if (pattern.foldedLabels.length > 0) {
    parts.push(`folded=${JSON.stringify(pattern.foldedLabels)}`);
    parts.push(`foldedLine=${JSON.stringify(foldedLine(pattern.foldedLabels))}`);
  }
  if (pattern.suppressedPatterns.length > 0) {
    parts.push(`suppressed=${JSON.stringify(pattern.suppressedPatterns)}`);
  }
  if (pattern.coPatterns.length > 0) {
    parts.push(`coPatterns=${JSON.stringify(pattern.coPatterns)}`);
  }
  return `  • ${parts.join(" | ")}`;
};

const printLiveExport = (
  analyses: EntryAnalysis[],
  entries: JournalEntry[],
) => {
  const before = aggregateFromInputs(analyses, entries, {
    applyOverlapSuppression: false,
  });
  const after = aggregateFromInputs(analyses, entries, {
    applyOverlapSuppression: true,
  });

  console.log(`\n${"═".repeat(72)}`);
  console.log("LIVE EXPORT — all surfaced patterns");
  console.log("═".repeat(72));
  console.log(
    `\nAnalyses: ${analyses.length} | Entries in export: ${entries.length}`,
  );

  console.log(`\nBEFORE overlap suppression (${before.surfaced.length} cards):`);
  if (before.surfaced.length === 0) {
    console.log("  (none)");
  } else {
    for (const pattern of before.surfaced) {
      console.log(formatPatternLine(pattern));
    }
  }

  console.log(`\nAFTER overlap suppression (${after.surfaced.length} cards):`);
  if (after.surfaced.length === 0) {
    console.log("  (none)");
  } else {
    for (const pattern of after.surfaced) {
      console.log(formatPatternLine(pattern));
    }
  }

  const beforeNames = new Set(before.surfaced.map((p) => p.name));
  const afterNames = new Set(after.surfaced.map((p) => p.name));
  const removed = before.surfaced.filter((p) => !afterNames.has(p.name));
  const added = after.surfaced.filter((p) => !beforeNames.has(p.name));
  const survivors = after.surfaced.filter((p) => beforeNames.has(p.name));

  console.log("\nDELTA:");
  console.log(
    `  cards: ${before.surfaced.length} → ${after.surfaced.length} (${before.surfaced.length - after.surfaced.length} removed)`,
  );
  if (removed.length > 0) {
    console.log("  removed as standalone cards (folded into a survivor):");
    for (const pattern of removed) {
      const host = after.surfaced.find((p) =>
        p.suppressedPatterns.includes(pattern.name),
      );
      console.log(
        `    - ${pattern.name} (${pattern.entryCount} entries) → folded into ${host?.name ?? "?"}`,
      );
    }
  }
  if (survivors.some((p) => p.foldedLabels.length > 0)) {
    console.log("  survivors with folded metadata:");
    for (const pattern of survivors.filter((p) => p.foldedLabels.length > 0)) {
      console.log(
        `    - ${pattern.name}: foldedLabels=${JSON.stringify(pattern.foldedLabels)}`,
      );
    }
  }
  const unchanged = survivors.filter((p) => p.foldedLabels.length === 0);
  if (unchanged.length > 0) {
    console.log("  unchanged singletons (no overlap collapse):");
    for (const pattern of unchanged) {
      console.log(`    - ${pattern.name} (${pattern.entryCount} entries)`);
    }
  }
  if (added.length > 0) {
    console.log("  unexpected new cards (should not happen):");
    for (const pattern of added) {
      console.log(`    - ${pattern.name}`);
    }
  }

  if (before.surfaced.length >= 2) {
    console.log("\nPairwise overlap matrix (before, ≥0.65 would cluster):");
    for (let i = 0; i < before.surfaced.length; i += 1) {
      for (let j = i + 1; j < before.surfaced.length; j += 1) {
        const a = before.surfaced[i]!;
        const b = before.surfaced[j]!;
        const ratio = entryOverlapRatio(a, b);
        if (ratio >= 0.5) {
          console.log(
            `  ${a.name} ↔ ${b.name}: ${ratio.toFixed(3)}${ratio >= 0.65 ? " ✓ clusters" : ""}`,
          );
        }
      }
    }
  }
};

const LIVE_EXPORT = join(
  process.cwd(),
  "scripts/fixtures/overlap-live-export.json",
);

let ranLive = false;
if (existsSync(LIVE_EXPORT)) {
  console.log(`Loading live export: ${LIVE_EXPORT}`);
  const raw = JSON.parse(readFileSync(LIVE_EXPORT, "utf8")) as {
    analyses: Record<string, EntryAnalysis> | EntryAnalysis[];
    entries: Record<string, JournalEntry> | JournalEntry[];
  };
  const analyses = Array.isArray(raw.analyses)
    ? raw.analyses
    : Object.values(raw.analyses);
  const entries = Array.isArray(raw.entries)
    ? raw.entries
    : Object.values(raw.entries);
  printLiveExport(analyses, entries);
  ranLive = true;
} else {
  console.log(
    "No scripts/fixtures/overlap-live-export.json — skipping live export.\n" +
      "Save DevTools export there, then re-run.",
  );
}

if (!ranLive) {
  console.log("\nStructural fixtures (synthetic):");
  printBatch(buildOverthinkingBatch());
  printBatch(buildCatastrophizingBatch());
}

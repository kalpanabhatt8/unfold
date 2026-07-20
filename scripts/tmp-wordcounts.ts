/**
 * Word counts for Conversation Keeps Playing vs Story I Keep Rehearsing batches.
 * Prints counts only — no entry bodies.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function words(s: string) {
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Mirror of flattenRawSnapshot in entry-text.ts */
function plain(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const raw = content as {
    textColumns?: unknown[];
    imageBlocks?: unknown[];
  };
  const lines: string[] = [];
  if (Array.isArray(raw.textColumns)) {
    for (const col of raw.textColumns) {
      if (!Array.isArray(col)) continue;
      for (const block of col) {
        if (
          block &&
          typeof block === "object" &&
          typeof (block as { text?: unknown }).text === "string"
        ) {
          const t = (block as { text: string }).text.trim();
          if (t) lines.push(t);
        }
      }
    }
  }
  if (Array.isArray(raw.imageBlocks)) {
    for (const image of raw.imageBlocks) {
      if (
        image &&
        typeof image === "object" &&
        typeof (image as { caption?: unknown }).caption === "string"
      ) {
        const t = (image as { caption: string }).caption.trim();
        if (t) lines.push(t);
      }
    }
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

async function main() {
  const { db } = await import("../src/lib/server/db");
  const newIds = [
    "entry-mrpppzcnrlac",
    "entry-mrppq6o28k81",
    "entry-mrppqpistfyu",
    "entry-mrppqvczrvh9",
  ];
  const prevIds = [
    "entry-mrou16l2qz1a",
    "entry-mrou1y640ozz",
    "entry-mrou36ws81gz",
  ];
  const ids = [...newIds, ...prevIds];
  try {
    const rows = await db.journalEntry.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Debug content shape for entries with empty searchText
    for (const id of [
      "entry-mrppqpistfyu",
      "entry-mrou16l2qz1a",
      "entry-mrou1y640ozz",
      "entry-mrou36ws81gz",
    ]) {
      const r = byId.get(id);
      if (!r) continue;
      const c = r.content;
      console.log(
        `\n=== content JSON for ${id} (truncated) ===\n`,
        JSON.stringify(c)?.slice(0, 400),
      );
    }

    for (const [label, list] of [
      ["NEW (Conversation Keeps Playing)", newIds],
      ["PREV (Story I Keep Rehearsing)", prevIds],
    ] as const) {
      console.log(`\n=== ${label} ===`);
      for (const id of list) {
        const r = byId.get(id);
        if (!r) {
          console.log(`${id}: MISSING`);
          continue;
        }
        const body =
          (r.searchText && r.searchText.trim()) ||
          plain((r as { content?: unknown }).content);
        console.log(
          `${id} | ${JSON.stringify(r.title)} | words=${words(body)} chars=${body.length}`,
        );
      }
    }

    // Fallback: estimate from stored evidence quotes on analyses
    console.log("\n=== evidence-quote word estimates (when body empty) ===");
    const analyses = await db.entryAnalysis.findMany({
      where: { entryId: { in: ids } },
      select: { entryId: true, patterns: true },
    });
    for (const a of analyses) {
      const patterns = a.patterns as Array<{ evidence?: string[] }>;
      const quotes = patterns.flatMap((p) => p.evidence ?? []);
      const joined = [...new Set(quotes)].join(" ");
      console.log(
        `${a.entryId} | evidenceQuotes=${quotes.length} uniqueWords≈${words(joined)}`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

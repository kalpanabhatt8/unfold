/**
 * Dump raw entry-analysis tags for "The Conversation Keeps Playing".
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type PatternMatch = {
  name?: string;
  confidence?: number;
  evidence?: string[];
};

async function main() {
  const { db } = await import("../src/lib/server/db");

  try {
    const displays = await db.patternDisplay.findMany({
      where: {
        displayTitle: {
          contains: "Conversation Keeps Playing",
          mode: "insensitive",
        },
      },
    });

    console.log("=== pattern_displays matching title ===");
    console.log(JSON.stringify(displays, null, 2));

    if (displays.length === 0) {
      console.log("\n=== all recent pattern_displays ===");
      console.log(
        JSON.stringify(
          await db.patternDisplay.findMany({
            select: {
              patternName: true,
              displayTitle: true,
              evidenceKey: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 40,
          }),
          null,
          2,
        ),
      );
    }

    const needle =
      /mute|embarrass|portfolio|senior|code.?review|bluff|landlord|conversation|replay|playing/i;

    const entries = await db.journalEntry.findMany({
      select: {
        id: true,
        title: true,
        searchText: true,
        createdAt: true,
        analysis: {
          select: {
            entryId: true,
            topics: true,
            patterns: true,
            sourceContentHash: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const matched = entries.filter((e) =>
      needle.test(`${e.title ?? ""}\n${e.searchText ?? ""}`),
    );

    console.log("\n=== candidate entries (keyword filter) ===");
    for (const e of matched) {
      console.log(
        JSON.stringify(
          {
            entryId: e.id,
            title: e.title,
            createdAt: e.createdAt,
            snippet: (e.searchText ?? "").slice(0, 280),
            analysis: e.analysis,
          },
          null,
          2,
        ),
      );
    }

    for (const d of displays) {
      const analyses = await db.entryAnalysis.findMany({
        where: { userId: d.userId },
        include: {
          entry: { select: { id: true, title: true, searchText: true } },
        },
      });

      const forPattern = analyses.filter((a) => {
        const patterns = a.patterns as PatternMatch[];
        return (
          Array.isArray(patterns) &&
          patterns.some((p) => p?.name === d.patternName)
        );
      });

      console.log(
        `\n=== RAW analyses tagged name="${d.patternName}" for display "${d.displayTitle}" ===`,
      );
      for (const a of forPattern) {
        console.log(
          JSON.stringify(
            {
              entryId: a.entryId,
              title: a.entry.title,
              snippet: (a.entry.searchText ?? "").slice(0, 320),
              topics: a.topics,
              patterns: a.patterns,
            },
            null,
            2,
          ),
        );
      }

      console.log(
        `\n=== label summary for ${d.patternName} (${forPattern.length} entries) ===`,
      );
      for (const a of forPattern) {
        const patterns = a.patterns as PatternMatch[];
        const labels = patterns.map(
          (p) => `${p.name} (conf=${p.confidence ?? "?"})`,
        );
        console.log(`- ${a.entryId}: ${labels.join(", ") || "(no patterns)"}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

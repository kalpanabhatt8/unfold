/**
 * Fresh extraction audit on labeled test entries.
 *
 *   npx tsx scripts/audit-extraction-labels.ts
 *
 * Labels in LABELS are PROVISIONAL until Kalpana confirms.
 * Reads texts from scripts/fixtures/_extraction-audit-tmp.json (gitignored).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { extractPatterns } from "../src/lib/ai/pattern-extraction/generate";
import type { PatternName } from "../src/lib/patterns/vocabulary";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

type Intended = "self_doubt" | "self_criticism" | "perfectionism";

/** Provisional — confirm before treating matrix as ground truth. */
const LABELS: Record<string, Intended> = {
  "entry-mrxh7kzob6ig": "self_doubt", // They Chose Wrong
  "entry-mrxh9gwl8i6r": "self_doubt", // Polite or Real
  "entry-mrxh9ox0w8rd": "self_doubt", // Decided Before Evidence
  "entry-mrxh9vyp06cf": "self_doubt", // Doubt Showed Up Anyway
  "entry-mrxha21p5wfm": "perfectionism", // Can't Just Say Thank You — ambiguous; was only soft perfectionism hit
  "entry-mrxha8u5oajk": "self_criticism", // Again
  "entry-mrxhag3863t6": "self_criticism", // Fumbled One Answer
  "entry-mrxhamavinft": "self_criticism", // Forgot the Email
  "entry-mrxhasqe2dfl": "self_criticism", // One Typo Everything Else
  "entry-mrxhazg3ytyc": "self_criticism", // One Day Breaks It
};

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const dump = JSON.parse(
  readFileSync("scripts/fixtures/_extraction-audit-tmp.json", "utf8"),
) as {
  entries: Record<
    string,
    { id: string; title: string; text: string; textLen: number }
  >;
};

type Row = {
  id: string;
  title: string;
  intended: Intended;
  primary: string | null;
  primaryConf: number | null;
  patterns: Array<{ name: string; confidence: number; evidence: string[] }>;
  hitIntended: boolean;
  hitAsPrimary: boolean;
};

async function main() {
  const rows: Row[] = [];

  for (const [id, intended] of Object.entries(LABELS)) {
    const entry = dump.entries[id];
    if (!entry?.text) {
      console.error("missing entry", id);
      continue;
    }
    process.stdout.write(`extracting ${entry.title}… `);
    const out = await extractPatterns(apiKey!, entry.text);
    const patterns = (out.analysis?.patterns ?? []) as Row["patterns"];
    const primary = patterns[0]?.name ?? null;
    const primaryConf = patterns[0]?.confidence ?? null;
    const hitIntended = patterns.some((p) => p.name === intended);
    const hitAsPrimary = primary === intended;
    console.log(
      patterns.map((p) => `${p.name}@${p.confidence}`).join(", ") || "(none)",
    );
    rows.push({
      id,
      title: entry.title,
      intended,
      primary,
      primaryConf,
      patterns,
      hitIntended,
      hitAsPrimary,
    });
  }

  writeFileSync(
    "scripts/fixtures/_extraction-audit-results.json",
    JSON.stringify({ provisionalLabels: true, rows }, null, 2),
  );

  console.log("\n======== PER-ENTRY ========");
  for (const r of rows) {
    const actual = r.patterns
      .map((p) => `${p.name}(${p.confidence.toFixed(2)})`)
      .join(" + ");
    const mark = r.hitAsPrimary ? "PRIMARY OK" : r.hitIntended ? "SECONDARY" : "MISS";
    console.log(
      `${mark} | intended=${r.intended.padEnd(15)} | primary=${String(r.primary).padEnd(16)} | ${r.title}`,
    );
    console.log(`         actual: ${actual || "(none)"}`);
    for (const p of r.patterns) {
      for (const e of p.evidence) console.log(`           [${p.name}] ${e}`);
    }
  }

  // Confusion: intended → primary
  const intendeds: Intended[] = [
    "self_doubt",
    "self_criticism",
    "perfectionism",
  ];
  const primaryCounts = new Map<string, Map<string, number>>();
  const anyCounts = new Map<string, Map<string, number>>();
  for (const i of intendeds) {
    primaryCounts.set(i, new Map());
    anyCounts.set(i, new Map());
  }
  for (const r of rows) {
    const pMap = primaryCounts.get(r.intended)!;
    const key = r.primary ?? "(none)";
    pMap.set(key, (pMap.get(key) ?? 0) + 1);
    const aMap = anyCounts.get(r.intended)!;
    const names = new Set(r.patterns.map((p) => p.name));
    if (names.size === 0) aMap.set("(none)", (aMap.get("(none)") ?? 0) + 1);
    for (const n of names) aMap.set(n, (aMap.get(n) ?? 0) + 1);
  }

  console.log("\n======== CONFUSION: intended → PRIMARY ========");
  for (const i of intendeds) {
    const m = primaryCounts.get(i)!;
    const parts = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`);
    console.log(`${i} (n=${rows.filter((r) => r.intended === i).length}): ${parts.join(", ") || "(empty)"}`);
  }

  console.log("\n======== CONFUSION: intended → ANY TAG (multi-label) ========");
  for (const i of intendeds) {
    const m = anyCounts.get(i)!;
    const parts = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`);
    console.log(`${i}: ${parts.join(", ") || "(empty)"}`);
  }

  // Focus pairs from the question
  const focus: PatternName[] = [
    "perfectionism",
    "self_criticism",
    "catastrophizing",
    "all_or_nothing",
    "self_doubt",
  ];
  console.log("\n======== CROSS-PAIR RATES (among intended class) ========");
  for (const i of intendeds) {
    const subset = rows.filter((r) => r.intended === i);
    if (subset.length === 0) continue;
    for (const f of focus) {
      if (f === i) continue;
      const asPrimary = subset.filter((r) => r.primary === f).length;
      const asAny = subset.filter((r) =>
        r.patterns.some((p) => p.name === f),
      ).length;
      if (asPrimary || asAny) {
        console.log(
          `${i} → ${f}: primary ${asPrimary}/${subset.length}, any-tag ${asAny}/${subset.length}`,
        );
      }
    }
  }

  const primaryHit = rows.filter((r) => r.hitAsPrimary).length;
  const anyHit = rows.filter((r) => r.hitIntended).length;
  console.log(
    `\nPRIMARY hit-rate: ${primaryHit}/${rows.length} | ANY-tag hit-rate: ${anyHit}/${rows.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

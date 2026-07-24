/**
 * Consistency check for PATTERN_CATALOG — hard structural fails + soft review checklist.
 *
 *   npm run check:pattern-vocab
 *   npm run check:pattern-vocab -- --strict   # soft checklist items also fail the process
 *
 * Hard fails: missing fields, empty definition/disambiguation, no examples,
 * evidence not found in entry, catalog/name drift.
 *
 * Soft: prints a manual side-by-side review block so definition ↔ disambiguation
 * drift (the perfectionism class of bug) is routine to catch before commit.
 */

import {
  EXTRACTION_SHARED_EXAMPLES,
  EXTRACTION_SOLO_EXAMPLE_ORDER,
  PATTERN_CATALOG,
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
  PATTERN_NAMES,
  type PatternName,
} from "../src/lib/patterns/vocabulary";

const strict = process.argv.includes("--strict");

type Issue = { level: "fail" | "warn"; pattern?: PatternName; message: string };

const issues: Issue[] = [];

function fail(message: string, pattern?: PatternName) {
  issues.push({ level: "fail", pattern, message });
}

function warn(message: string, pattern?: PatternName) {
  issues.push({ level: "warn", pattern, message });
}

/** Content words (≥4 chars) for a crude overlap heuristic. */
function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Mirrors pattern-display/validation.ts echo predicates so a fallbackHook can
 * never become a definition/label echo (the display pipeline would reject it).
 */
function hookEchoesDefinition(hook: string, definition: string): boolean {
  const defWords = definition
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ""))
    .filter((w) => w.length > 6);
  const lower = hook.toLowerCase();
  return defWords.filter((w) => lower.includes(w)).length >= 2;
}

function hookEchoesLabel(hook: string, label: string): boolean {
  const phrase = label.toLowerCase().replace(/-/g, " ").trim();
  if (phrase.length < 4) return false;
  return hook.toLowerCase().includes(phrase);
}

// --- Hard: catalog completeness & derived export sync ---

for (const name of PATTERN_NAMES) {
  const spec = PATTERN_CATALOG[name];
  if (!spec) {
    fail(`missing PATTERN_CATALOG entry`, name);
    continue;
  }
  if (spec.name !== name) {
    fail(`spec.name "${spec.name}" !== key "${name}"`, name);
  }
  if (!spec.label?.trim()) fail(`empty label`, name);
  if (!spec.definition?.trim()) fail(`empty definition`, name);
  if (!spec.disambiguation?.trim()) fail(`empty disambiguation`, name);
  if (!spec.fallbackHook?.trim()) {
    fail(`empty fallbackHook`, name);
  } else {
    if (hookEchoesDefinition(spec.fallbackHook, spec.definition)) {
      fail(`fallbackHook echoes definition: ${JSON.stringify(spec.fallbackHook)}`, name);
    }
    if (hookEchoesLabel(spec.fallbackHook, spec.label)) {
      fail(`fallbackHook echoes label: ${JSON.stringify(spec.fallbackHook)}`, name);
    }
  }
  if (!Array.isArray(spec.examples) || spec.examples.length < 1) {
    fail(`needs ≥1 example`, name);
  }

  if (PATTERN_LABELS[name] !== spec.label) {
    fail(`PATTERN_LABELS drift vs catalog.label`, name);
  }
  if (PATTERN_DEFINITIONS[name] !== spec.definition) {
    fail(`PATTERN_DEFINITIONS drift vs catalog.definition`, name);
  }

  for (const [i, ex] of (spec.examples ?? []).entries()) {
    if (!ex.entry?.trim()) fail(`examples[${i}] empty entry`, name);
    if (!ex.rationale?.trim()) fail(`examples[${i}] empty rationale`, name);
    if (!Array.isArray(ex.topics)) fail(`examples[${i}] topics must be array`, name);

    // Residual / no-pattern placeholder (overthinking): allow empty evidence.
    const residual = ex.confidence <= 0 && ex.evidence.length === 0;
    if (!residual) {
      if (!ex.evidence?.length) {
        fail(`examples[${i}] needs ≥1 evidence quote`, name);
      }
      for (const quote of ex.evidence ?? []) {
        if (!quote.trim()) {
          fail(`examples[${i}] empty evidence quote`, name);
          continue;
        }
        if (!ex.entry.includes(quote)) {
          fail(
            `examples[${i}] evidence not found in entry: ${JSON.stringify(quote)}`,
            name,
          );
        }
      }
    }
  }
}

for (const name of Object.keys(PATTERN_CATALOG) as PatternName[]) {
  if (!PATTERN_NAMES.includes(name)) {
    fail(`PATTERN_CATALOG has extra key not in PATTERN_NAMES: ${name}`);
  }
}

for (const name of EXTRACTION_SOLO_EXAMPLE_ORDER) {
  if (!PATTERN_NAMES.includes(name)) {
    fail(`EXTRACTION_SOLO_EXAMPLE_ORDER unknown pattern: ${name}`);
  }
  const ex = PATTERN_CATALOG[name]?.examples[0];
  if (!ex || ex.confidence <= 0 || ex.evidence.length === 0) {
    fail(
      `solo example order entry needs a real example (confidence>0, evidence)`,
      name,
    );
  }
}

for (const shared of EXTRACTION_SHARED_EXAMPLES) {
  if (!shared.entry?.trim()) fail(`shared example empty entry`);
  if (shared.kind === "multi") {
    for (const p of shared.patterns) {
      if (!PATTERN_NAMES.includes(p.name)) {
        fail(`shared multi example unknown pattern: ${p.name}`);
      }
      for (const q of p.evidence) {
        if (!shared.entry.includes(q)) {
          fail(
            `shared multi evidence not in entry (${p.name}): ${JSON.stringify(q)}`,
          );
        }
      }
    }
  }
}

// --- Soft: definition ↔ disambiguation ↔ example rationale checklist ---

console.log("\n======== MANUAL REVIEW CHECKLIST ========\n");
console.log(
  "For each pattern: do definition, disambiguation, and example rationale",
);
console.log(
  "describe the SAME behavioral test (not broader/narrower)? Nearest-neighbor boundary clear?\n",
);

for (const name of PATTERN_NAMES) {
  const spec = PATTERN_CATALOG[name];
  if (!spec) continue;
  const defWords = contentWords(spec.definition);
  const disWords = contentWords(spec.disambiguation);
  const overlap = jaccard(defWords, disWords);
  const onlyDef = [...defWords].filter((w) => !disWords.has(w));
  const onlyDis = [...disWords].filter((w) => !defWords.has(w));

  // Heuristic warn: very low lexical overlap can mean drift (not always wrong).
  if (overlap < 0.15 && name !== "overthinking") {
    warn(
      `low definition↔disambiguation word overlap (${overlap.toFixed(2)}) — review for drift`,
      name,
    );
  }

  // Flag definition-only content words that look like scope expansions.
  const RISK = new Set([
    "worth",
    "worthy",
    "worthless",
    "enough",
    "identity",
    "character",
  ]);
  const risky = onlyDef.filter((w) => RISK.has(w));
  if (risky.length) {
    warn(
      `definition has scope words absent from disambiguation: ${risky.join(", ")}`,
      name,
    );
  }

  console.log(`## ${name}`);
  console.log(`definition:     ${spec.definition}`);
  console.log(`disambiguation: ${spec.disambiguation}`);
  console.log(
    `example[0]:     ${spec.examples[0]?.rationale ?? "(none)"}`,
  );
  if (onlyDef.length) {
    console.log(`  words only in definition: ${onlyDef.slice(0, 12).join(", ")}`);
  }
  if (onlyDis.length) {
    console.log(
      `  words only in disambiguation: ${onlyDis.slice(0, 12).join(", ")}`,
    );
  }
  console.log(`  [ ] Same behavioral test?`);
  console.log(`  [ ] Boundary with nearest neighbor clear?`);
  console.log("");
}

// --- Report ---

const fails = issues.filter((i) => i.level === "fail");
const warns = issues.filter((i) => i.level === "warn");

if (fails.length) {
  console.log("======== HARD FAILS ========");
  for (const i of fails) {
    console.log(`FAIL${i.pattern ? ` [${i.pattern}]` : ""}: ${i.message}`);
  }
}
if (warns.length) {
  console.log("======== WARNINGS ========");
  for (const i of warns) {
    console.log(`WARN${i.pattern ? ` [${i.pattern}]` : ""}: ${i.message}`);
  }
}

if (fails.length === 0 && warns.length === 0) {
  console.log("OK — catalog structural checks passed; review checklist above.");
}

if (fails.length > 0) process.exit(1);
if (strict && warns.length > 0) process.exit(1);
process.exit(0);

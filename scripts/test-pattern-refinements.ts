/**
 * Smoke-check cache-key evidence parse, citation stripping, corrective bans.
 * Run: npx tsx scripts/test-pattern-refinements.ts
 */

import {
  hasCitationBrackets,
  stripCitationBrackets,
} from "../src/lib/ai/pattern-slots/citations";
import { validateSlotFills } from "../src/lib/ai/pattern-slots/validation";
import { splitMechanismSteps } from "../src/lib/patterns/mechanism-steps";
import {
  buildPassageCacheKey,
  PASSAGE_CACHE_VERSION,
  passageCacheVersionIsCurrent,
  passageEvidenceKeyFromCacheKey,
} from "../src/lib/patterns/passage-types";
import { discoveryContinueLabel } from "../src/lib/patterns/discovery-arc";
import type { DiscoveryArc } from "../src/lib/patterns/discovery-arc";

let passed = 0;
let failed = 0;

const assert = (label: string, condition: boolean, detail?: string) => {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

console.log("cache key evidence parse");
{
  assert("cache version is v6", PASSAGE_CACHE_VERSION === "v6");
  const evidenceKey =
    "entry-a:0.8:quote one|entry-b:0.7:quote two|entry-c:0.9:quote three";
  const key = buildPassageCacheKey(
    evidenceKey,
    "strengthening",
    "moments,line,close:question|recognition|question",
  );
  assert("current version key is current", passageCacheVersionIsCurrent(key));
  assert(
    "legacy v4 key is not current",
    !passageCacheVersionIsCurrent(
      `v4|${evidenceKey}|strengthening|moments,line,close:question|recognition|question`,
    ),
  );
  assert(
    "v5 round-trips multi-entry evidenceKey",
    passageEvidenceKeyFromCacheKey(key) === evidenceKey,
    passageEvidenceKeyFromCacheKey(key),
  );

  const legacy = `v4|${evidenceKey}|strengthening|moments,line,close:question|recognition|question`;
  assert(
    "legacy v4 multi-entry evidenceKey parses fully",
    passageEvidenceKeyFromCacheKey(legacy) === evidenceKey,
    passageEvidenceKeyFromCacheKey(legacy),
  );

  const brokenOld = legacy.split("|")[1];
  assert(
    "naive split('|')[1] is wrong for multi-entry (documents the bug)",
    brokenOld !== evidenceKey && brokenOld === "entry-a:0.8:quote one",
  );
}

console.log("citation stripping");
{
  const raw =
    "Opening and checking repeated across hours [1,2,3,4,5,6]. Something smaller filled the gaps.";
  assert("detects citation brackets", hasCitationBrackets(raw));
  const clean = stripCitationBrackets(raw);
  assert("strips citation brackets", !hasCitationBrackets(clean));
  assert(
    "keeps sentence body",
    clean.includes("Opening and checking repeated across hours"),
  );
  const steps = splitMechanismSteps(raw);
  assert(
    "mechanism steps never show brackets",
    steps.every((s) => !hasCitationBrackets(s)),
  );
}

console.log("corrective framing rejected");
{
  const quotes = [
    "I called myself stupid again.",
    "I fixed three bugs before lunch.",
    "I opened the draft and closed it.",
  ];
  const rejectMech = validateSlotFills(
    [
      {
        index: 0,
        text: "The gap between 'stupid' and 'fixed three bugs' stays unexamined. Checking filled the gaps.",
      },
    ],
    [
      {
        index: 0,
        kind: "line",
        endingKind: "line",
        role: "mechanism",
        precedingQuotes: quotes,
      },
    ],
    quotes,
    "Replaying a situation with more detail than needed.",
    "overthinking",
  );
  assert(
    "mechanism corrective voice rejected",
    rejectMech.rejected.some((r) => r.reason === "corrective_voice"),
    JSON.stringify(rejectMech.rejected),
  );

  const rejectQ = validateSlotFills(
    [
      {
        index: 1,
        text: "What would it feel like to leave it unopened for an hour?",
      },
    ],
    [
      {
        index: 1,
        kind: "close",
        endingKind: "question",
        role: "reflection",
        precedingQuotes: quotes,
      },
    ],
    quotes,
    "Replaying a situation with more detail than needed.",
    "overthinking",
  );
  assert(
    "reflection corrective question rejected",
    rejectQ.rejected.some((r) => r.reason === "corrective_voice"),
    JSON.stringify(rejectQ.rejected),
  );

  const rejectWorst = validateSlotFills(
    [
      {
        index: 1,
        text: "How quickly does the worst version arrive once the first doubt appears?",
      },
    ],
    [
      {
        index: 1,
        kind: "close",
        endingKind: "question",
        role: "reflection",
        precedingQuotes: quotes,
      },
    ],
    quotes,
    "Replaying a situation with more detail than needed.",
    "overthinking",
  );
  assert(
    "worst-version presumption rejected",
    rejectWorst.rejected.some((r) => r.reason === "corrective_voice"),
    JSON.stringify(rejectWorst.rejected),
  );
}

console.log("voice preserve only when evidence matches");
{
  const evidenceA =
    "entry-a:0.8:quote one|entry-b:0.7:quote two";
  const evidenceB =
    "entry-c:0.9:quote three|entry-d:0.6:quote four";
  const keyA = buildPassageCacheKey(
    evidenceA,
    "strengthening",
    "moments,line,close:question|discovery|question",
  );
  const keyAReplan = buildPassageCacheKey(
    evidenceA,
    "strong",
    "moments,line,line,close:question|discovery|question",
  );
  const keyB = buildPassageCacheKey(
    evidenceB,
    "strengthening",
    "moments,line,close:question|discovery|question",
  );

  // Same evidence, different lifecycle/signature → preserve voice.
  assert(
    "same-evidence re-plan keeps evidence fingerprint",
    passageEvidenceKeyFromCacheKey(keyA) ===
      passageEvidenceKeyFromCacheKey(keyAReplan),
  );
  assert(
    "same-evidence re-plan would preserve voice",
    passageEvidenceKeyFromCacheKey(keyA) === evidenceA,
  );

  // Different evidence → must NOT preserve voice.
  assert(
    "different evidence fingerprints diverge",
    passageEvidenceKeyFromCacheKey(keyA) !==
      passageEvidenceKeyFromCacheKey(keyB),
  );
  assert(
    "different evidence would not preserve voice",
    passageEvidenceKeyFromCacheKey(keyA) !== evidenceB,
  );
}

console.log("closing label stays Done");
{
  const arc = {
    phases: ["headline", "evidence", "mechanism", "reflection"],
  } as DiscoveryArc;
  assert(
    "final CTA is Done",
    discoveryContinueLabel(arc, 3) === "Done",
  );
  assert(
    "leaving quotes for AI uses Show the pattern",
    discoveryContinueLabel(arc, 1) === "Show the pattern",
  );
  assert(
    "mechanism → reflection stays Continue",
    discoveryContinueLabel(arc, 2) === "Continue",
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

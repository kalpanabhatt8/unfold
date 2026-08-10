/**
 * Smoke-check cache-key evidence parse, citation stripping, corrective bans.
 * Run: npx tsx scripts/test-pattern-refinements.ts
 */

import {
  hasCitationBrackets,
  stripCitationBrackets,
} from "../src/lib/ai/pattern-slots/citations";
import { validateSlotFills } from "../src/lib/ai/pattern-slots/validation";
import { PATTERN_DEFINITIONS } from "../src/lib/patterns/vocabulary";
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
    console.error(`  ✗ ${label}${detail ? ` - ${detail}` : ""}`);
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
    "leaving quotes for AI uses What's the pattern here?",
    discoveryContinueLabel(arc, 1) === "What's the pattern here?",
  );
  assert(
    "mechanism → reflection stays Continue",
    discoveryContinueLabel(arc, 2) === "Continue",
  );
}

console.log("incident stitch rejected");
{
  const comparisonQuotes = [
    "Someone posted their salary on LinkedIn and I did the math on years of experience.",
    "A feature I'd been sketching shipped on Product Hunt before I started.",
    "A week away from my goal somehow became a year's measure of being behind.",
  ];
  const badLoop =
    "Saw someone's number posted. Saw a feature shipped. Saw a week away become a year's measure.";
  const rejectStitch = validateSlotFills(
    [{ index: 0, text: badLoop }],
    [
      {
        index: 0,
        kind: "line",
        endingKind: "line",
        role: "mechanism",
        precedingQuotes: comparisonQuotes,
      },
    ],
    comparisonQuotes,
    PATTERN_DEFINITIONS.comparison,
    "comparison",
  );
  assert(
    "bad montage loop rejected as incident_stitch",
    rejectStitch.rejected.some((r) => r.reason === "incident_stitch"),
    JSON.stringify(rejectStitch.rejected),
  );

  const goodLoop =
    "Someone else's milestone showed up. The bar moved before my own work started. Everything else waited.";
  const acceptGeneric = validateSlotFills(
    [{ index: 0, text: goodLoop }],
    [
      {
        index: 0,
        kind: "line",
        endingKind: "line",
        role: "mechanism",
        precedingQuotes: comparisonQuotes,
      },
    ],
    comparisonQuotes,
    PATTERN_DEFINITIONS.comparison,
    "comparison",
  );
  assert(
    "generic loop shape accepted",
    acceptGeneric.ok && acceptGeneric.fills.length === 1,
    JSON.stringify(acceptGeneric.rejected),
  );

  const traitLoop =
    "You compare yourself to other people's progress. The measuring never quite stops.";
  const rejectTrait = validateSlotFills(
    [{ index: 0, text: traitLoop }],
    [
      {
        index: 0,
        kind: "line",
        endingKind: "line",
        role: "mechanism",
        precedingQuotes: comparisonQuotes,
      },
    ],
    comparisonQuotes,
    PATTERN_DEFINITIONS.comparison,
    "Comparison",
  );
  assert(
    "declarative trait loop rejected",
    rejectTrait.rejected.some(
      (r) => r.reason === "trait_voice" || r.reason === "you_opener",
    ),
    JSON.stringify(rejectTrait.rejected),
  );
}

console.log("reflection question grounding");
{
  const quotes = [
    "Everyone my age is already leading teams and I'm still here.",
    "I keep wondering why I'm so far behind.",
  ];
  const mech =
    "When another person's progress shows up in the writing, attention turns toward where you are. The next thought is already about the gap.";
  const slots = [
    {
      index: 0,
      kind: "line" as const,
      endingKind: "line" as const,
      role: "mechanism" as const,
      precedingQuotes: quotes,
    },
    {
      index: 1,
      kind: "close" as const,
      endingKind: "question" as const,
      role: "reflection" as const,
      precedingQuotes: quotes,
    },
  ];

  const badLabel = validateSlotFills(
    [
      { index: 0, text: mech },
      {
        index: 1,
        text: "How does the comparison shift when you see their success?",
      },
    ],
    slots,
    quotes,
    PATTERN_DEFINITIONS.comparison,
    "Comparison",
    [{ index: 0, role: "mechanism", text: mech }],
  );
  assert(
    "pattern-label question rejected",
    badLabel.rejected.some((r) => r.reason === "label_echo"),
    JSON.stringify(badLabel.rejected),
  );

  const badUngrounded = validateSlotFills(
    [
      {
        index: 1,
        text: "Where does the pull to check show up most sharply?",
      },
    ],
    [slots[1]!],
    quotes,
    PATTERN_DEFINITIONS.comparison,
    "Comparison",
    [{ index: 0, role: "mechanism", text: mech }],
  );
  assert(
    "ungrounded question rejected",
    badUngrounded.rejected.some((r) => r.reason === "not_grounded"),
    JSON.stringify(badUngrounded.rejected),
  );

  const badEcho = validateSlotFills(
    [
      {
        index: 1,
        text: "When progress shows up in the writing, what comes next?",
      },
    ],
    [slots[1]!],
    quotes,
    PATTERN_DEFINITIONS.comparison,
    "Comparison",
    [{ index: 0, role: "mechanism", text: mech }],
  );
  assert(
    "mechanism-echo question rejected",
    badEcho.rejected.some((r) => r.reason === "slot_echo"),
    JSON.stringify(badEcho.rejected),
  );

  const goodQ = validateSlotFills(
    [
      {
        index: 1,
        text: "You wondered why you're still here. What was that bringing up?",
      },
    ],
    [slots[1]!],
    quotes,
    PATTERN_DEFINITIONS.comparison,
    "Comparison",
    [{ index: 0, role: "mechanism", text: mech }],
  );
  assert(
    "evidence-grounded question accepted",
    goodQ.ok && goodQ.fills.length === 1,
    JSON.stringify(goodQ.rejected),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

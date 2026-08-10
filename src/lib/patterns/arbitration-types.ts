/**
 * Client-safe arbitration types (no rule table / prompt lines).
 * The rule implementations live in arbitration.ts (server-only).
 */

import type { PatternName } from "@/lib/patterns/vocabulary-public";

export type ArbitrationAction =
  | { ruleId: string; kind: "drop"; dropped: PatternName; winner: PatternName }
  | { ruleId: string; kind: "demote"; loser: PatternName; winner: PatternName };

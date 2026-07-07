import {
  PATTERN_DEFINITIONS,
  PATTERN_LABELS,
  type PatternName,
} from "@/lib/patterns/vocabulary";
import type { PatternInsight } from "@/lib/patterns/types";

const toSecondPerson = (definition: string): string => {
  const trimmed = definition.replace(/\.$/, "");
  if (trimmed.startsWith("measuring themselves"))
    return "You measure yourself against others' progress, status, or ability";
  if (trimmed.startsWith("questioning their"))
    return "You question your own ability, competence, or worth";
  if (trimmed.startsWith("looping on"))
    return "You loop on the same thought or decision without resolution";
  if (trimmed.startsWith("holding standards"))
    return "You hold standards so high that nothing feels good enough";
  if (trimmed.startsWith("putting off"))
    return "You put off, escape, or distract from things that matter";
  if (trimmed.startsWith("jumping to"))
    return "You jump to or escalate toward the worst-case outcome";
  if (trimmed.startsWith("prioritizing others"))
    return "You prioritize others' approval over your own needs";
  if (trimmed.startsWith("worrying about how"))
    return "You worry about how others perceive or evaluate you";
  if (trimmed.startsWith("harsh self-talk"))
    return "You turn harsh judgment inward";
  if (trimmed.startsWith("black-and-white"))
    return "You see things in black and white, with no middle ground";
  return `You tend toward ${trimmed.replace(/^they /, "")}`;
};

/**
 * Reflection fallback strategy: generic definition rewrite when generation fails.
 * Prefer showing evidence-only UI in the future; this keeps the page from breaking.
 */
export function fallbackReflection(name: PatternName): PatternInsight {
  return {
    observation: toSecondPerson(PATTERN_DEFINITIONS[name]),
    commonThread: `Each one shows the same thread of ${PATTERN_LABELS[name].toLowerCase()}`,
  };
}

/** When reflection fails entirely, callers may omit insight and show quotes only. */
export const REFLECTION_UNAVAILABLE: PatternInsight | null = null;

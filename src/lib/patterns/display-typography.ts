import type { CSSProperties } from "react";

/** Average characters per line at the discovery question measure (~21ch). */
const CHARS_PER_LINE = 26;

/** Hermite smoothstep — gradual transition, no abrupt jumps at band edges. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Rough line count from character length (no layout needed). */
export function estimateLineCount(
  text: string,
  charsPerLine = CHARS_PER_LINE,
): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.length / charsPerLine;
}

/**
 * 0 = large display (short, 2–4 lines); 1 = reading size (long, 5+ lines).
 * Ramps smoothly between ~4.5 and ~8 estimated lines.
 */
export function displayTypographyScale(text: string): number {
  return smoothstep(4.5, 8, estimateLineCount(text));
}

/** CSS custom properties for `.discovery-question` length-responsive type. */
export function discoveryQuestionTypographyStyle(text: string): CSSProperties {
  const scale = displayTypographyScale(text);
  return {
    "--q-scale": scale,
  } as CSSProperties;
}

export function discoveryQuestionIsReading(text: string): boolean {
  return displayTypographyScale(text) >= 0.45;
}

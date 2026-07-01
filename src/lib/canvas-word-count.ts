import type { CanvasSnapshot, JournalTextBlock } from "@/components/canvas/canvas-board";

const stripBlockPrefix = (text: string, blockKind: string): string => {
  if (blockKind === "bullet" || blockKind === "checklist") {
    return text.replace(/^[\s•\-–—*]+\s*/, "");
  }
  return text;
};

/** All writing blocks from a snapshot (book pages or legacy columns). */
export const snapshotWritingBlocks = (
  snapshot: CanvasSnapshot
): JournalTextBlock[] => {
  if (Array.isArray(snapshot.pages) && snapshot.pages.length > 0) {
    return snapshot.pages.flat();
  }
  return snapshot.textColumns?.flat() ?? [];
};

/** Count whitespace-separated words across all writing blocks + signature. */
export const countWordsFromSnapshot = (snapshot: CanvasSnapshot): number => {
  const parts: string[] = [];

  for (const block of snapshotWritingBlocks(snapshot)) {
    const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
    if (stripped) parts.push(stripped);
  }

  const sig = snapshot.signature?.trim();
  if (sig) parts.push(sig);

  const joined = parts.join(" ").trim();
  if (!joined) return 0;

  return joined.split(/\s+/).filter(Boolean).length;
};

/** Ordered word tokens from all writing blocks + signature (same basis as {@link countWordsFromSnapshot}). */
export const collectJournalWordTokens = (
  snapshot: CanvasSnapshot
): string[] => {
  const parts: string[] = [];

  for (const block of snapshotWritingBlocks(snapshot)) {
    const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
    if (stripped) parts.push(stripped);
  }

  const sig = snapshot.signature?.trim();
  if (sig) parts.push(sig);

  const joined = parts.join(" ").trim();
  if (!joined) return [];

  return joined.split(/\s+/).filter(Boolean);
};

/** Merge live signature value into a snapshot. */
export function mergeSignatureOverride(
  snapshot: CanvasSnapshot,
  signature: string
): CanvasSnapshot {
  return { ...snapshot, signature };
}

export const extractJournalPlainText = (snapshot: CanvasSnapshot): string => {
  const lines: string[] = [];

  for (const block of snapshotWritingBlocks(snapshot)) {
    const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
    if (stripped) lines.push(stripped);
  }

  const sig = snapshot.signature?.trim();
  if (sig) lines.push(sig);

  return lines.join("\n");
};

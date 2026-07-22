import type { CanvasSnapshot } from "@/components/canvas/canvas-board";

const stripBlockPrefix = (text: string, blockKind: string): string => {
  if (blockKind === "bullet" || blockKind === "checklist") {
    return text.replace(/^[\s•\-–—*]+\s*/, "");
  }
  return text;
};

/** Count whitespace-separated words across all writing blocks. */
export const countWordsFromSnapshot = (snapshot: CanvasSnapshot): number => {
  const parts: string[] = [];

  for (const col of snapshot.textColumns) {
    for (const block of col) {
      const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
      if (stripped) parts.push(stripped);
    }
  }

  const joined = parts.join(" ").trim();
  if (!joined) return 0;

  return joined.split(/\s+/).filter(Boolean).length;
};

/** Ordered word tokens from all writing blocks (same basis as {@link countWordsFromSnapshot}). */
export const collectJournalWordTokens = (
  snapshot: CanvasSnapshot
): string[] => {
  const parts: string[] = [];

  for (const col of snapshot.textColumns) {
    for (const block of col) {
      const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
      if (stripped) parts.push(stripped);
    }
  }

  const joined = parts.join(" ").trim();
  if (!joined) return [];

  return joined.split(/\s+/).filter(Boolean);
};

export const extractJournalPlainText = (snapshot: CanvasSnapshot): string => {
  const lines: string[] = [];

  for (const col of snapshot.textColumns) {
    for (const block of col) {
      const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
      if (stripped) lines.push(stripped);
    }
  }

  return lines.join("\n");
};

/** Whether the snapshot has any non-whitespace writing content. */
export const snapshotHasContent = (snapshot: CanvasSnapshot): boolean =>
  extractJournalPlainText(snapshot).trim().length > 0;

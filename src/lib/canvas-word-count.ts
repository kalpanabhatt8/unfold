import type { CanvasSnapshot } from "@/components/canvas/canvas-board";

const stripBlockPrefix = (text: string, blockKind: string): string => {
  if (blockKind === "bullet" || blockKind === "checklist") {
    return text.replace(/^[\s•\-–—*]+\s*/, "");
  }
  return text;
};

/** Count whitespace-separated words across all writing blocks + signature. */
export const countWordsFromSnapshot = (snapshot: CanvasSnapshot): number => {
  const parts: string[] = [];

  for (const col of snapshot.textColumns) {
    for (const block of col) {
      const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
      if (stripped) parts.push(stripped);
    }
  }

  const sig = snapshot.signature?.trim();
  if (sig) parts.push(sig);

  const joined = parts.join(" ").trim();
  if (!joined) return 0;

  return joined.split(/\s+/).filter(Boolean).length;
};

export const extractJournalPlainText = (snapshot: CanvasSnapshot): string => {
  const lines: string[] = [];

  for (const col of snapshot.textColumns) {
    for (const block of col) {
      const stripped = stripBlockPrefix(block.text, block.blockKind).trim();
      if (stripped) lines.push(stripped);
    }
  }

  const sig = snapshot.signature?.trim();
  if (sig) lines.push(sig);

  return lines.join("\n");
};

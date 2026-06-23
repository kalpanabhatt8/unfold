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

/** Ordered word tokens from all writing blocks + signature (same basis as {@link countWordsFromSnapshot}). */
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

/** Prefer live textarea DOM values over React state (state can lag one frame). */
export function mergeLiveTextareaSnapshot(
  snapshot: CanvasSnapshot,
  textRefs: Record<string, HTMLTextAreaElement | null | undefined>
): CanvasSnapshot {
  return {
    ...snapshot,
    textColumns: snapshot.textColumns.map((col) =>
      col.map((block) => {
        const el = textRefs[block.id];
        if (el) return { ...block, text: el.value };
        return block;
      })
    ),
  };
}

/** Apply in-flight textarea text before the next React render. */
export function mergeBlockTextOverride(
  snapshot: CanvasSnapshot,
  blockId: string,
  text: string
): CanvasSnapshot {
  return {
    ...snapshot,
    textColumns: snapshot.textColumns.map((col) =>
      col.map((block) => (block.id === blockId ? { ...block, text } : block))
    ),
  };
}

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

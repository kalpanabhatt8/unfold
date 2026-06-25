import type {
  JournalTextBlock,
  TextBlockKind,
} from "@/components/canvas/canvas-board";

export const MAX_WRITING_BLOCKS = 7;

export const newBlockId = () =>
  `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const emptyParagraph = (): JournalTextBlock => ({
  id: newBlockId(),
  blockKind: "paragraph",
  text: "",
});

export const createWritingSlots = (): JournalTextBlock[] => [emptyParagraph()];

/** Toolbar: change block kind, including multi-line selection → multiple list rows. */
export const applyBlockKind = (
  blocks: JournalTextBlock[],
  id: string,
  kind: TextBlockKind,
  opts?: {
    selectedText?: string;
    selectionStart?: number;
    selectionEnd?: number;
    blockText?: string;
  }
): { blocks: JournalTextBlock[]; focusBlockId: string | null } => {
  const i = blocks.findIndex((b) => b.id === id);
  if (i === -1) return { blocks, focusBlockId: null };

  const block = blocks[i];
  const v = opts?.blockText ?? block.text;
  const s0 = opts?.selectionStart ?? 0;
  const s1 = opts?.selectionEnd ?? 0;
  const lo = Math.min(s0, s1);
  const hi = Math.max(s0, s1);
  const selected = opts?.selectedText ?? v.slice(lo, hi);
  const hasRange = lo !== hi;

  if (
    hasRange &&
    (kind === "bullet" || kind === "checklist") &&
    selected.includes("\n")
  ) {
    const before = v.slice(0, lo);
    const after = v.slice(hi);
    let lines = selected.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") {
      lines = lines.slice(0, -1);
    }

    const inserts: JournalTextBlock[] = [];
    if (before.length > 0) {
      inserts.push({
        ...block,
        id,
        blockKind: "paragraph",
        text: before,
        checked: undefined,
      });
    }
    lines.forEach((lineText, idx) => {
      inserts.push({
        id: before.length === 0 && idx === 0 ? id : newBlockId(),
        blockKind: kind,
        text: lineText,
        checked: kind === "checklist" ? false : undefined,
      });
    });
    if (after.length > 0) {
      inserts.push({ ...emptyParagraph(), text: after });
    }
    if (inserts.length === 0) {
      inserts.push({
        ...block,
        id,
        blockKind: kind,
        text: "",
        checked: kind === "checklist" ? false : undefined,
      });
    }
    const firstList = inserts.find((b) => b.blockKind === kind);
    const next = [...blocks.slice(0, i), ...inserts, ...blocks.slice(i + 1)];
    return {
      blocks: next,
      focusBlockId: firstList?.id ?? null,
    };
  }

  const next = blocks.map((b) => {
    if (b.id !== id) return b;
    if (kind === "checklist") {
      return {
        ...b,
        blockKind: "checklist" as const,
        checked: b.checked ?? false,
      };
    }
    return { ...b, blockKind: kind, checked: undefined };
  });

  return { blocks: next, focusBlockId: null };
};

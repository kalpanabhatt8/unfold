import type { JSONContent } from "@tiptap/core";
import type {
  JournalInlineMark,
  JournalTextBlock,
  JournalTextSpan,
  TextBlockKind,
} from "@/components/canvas/canvas-board";
import {
  emptyParagraph,
  newBlockId,
} from "@/lib/journal-blocks";

const fromTipTapMark = (mark: JSONContent): JournalInlineMark | null => {
  if (mark.type === "bold") return "bold";
  if (mark.type !== "highlight") return null;
  const color = mark.attrs?.color;
  if (color === "green") return "highlight-green";
  if (color === "sage") return "highlight-sage";
  return "highlight";
};

const toTipTapMark = (mark: JournalInlineMark): JSONContent => {
  if (mark === "bold") return { type: "bold" };
  if (mark === "highlight-green") {
    return { type: "highlight", attrs: { color: "green" } };
  }
  if (mark === "highlight-sage") {
    return { type: "highlight", attrs: { color: "sage" } };
  }
  return { type: "highlight", attrs: { color: "pink" } };
};

const marksKey = (marks: JournalInlineMark[] | undefined): string =>
  (marks ?? []).slice().sort().join(",");

const pushTextWithBreaks = (
  content: JSONContent[],
  text: string,
  marks?: JournalInlineMark[],
) => {
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    if (line.length > 0) {
      const node: JSONContent = { type: "text", text: line };
      if (marks && marks.length > 0) {
        node.marks = marks.map(toTipTapMark);
      }
      content.push(node);
    }
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });
};

/** Inline content with hardBreak nodes for each newline. */
export const textToInlineContent = (
  text: string,
  spans?: JournalTextSpan[],
): JSONContent[] | undefined => {
  if (spans && spans.length > 0) {
    const content: JSONContent[] = [];
    for (const span of spans) {
      if (span.text.length === 0) continue;
      pushTextWithBreaks(content, span.text, span.marks);
    }
    return content.length > 0 ? content : undefined;
  }

  if (text.length === 0) return undefined;

  const content: JSONContent[] = [];
  pushTextWithBreaks(content, text);
  return content.length > 0 ? content : undefined;
};

const inlineFromNode = (
  node: JSONContent,
): { text: string; spans?: JournalTextSpan[] } => {
  let text = "";
  const spans: JournalTextSpan[] = [];
  let hasMarks = false;

  const append = (chunk: string, marks?: JournalInlineMark[]) => {
    if (chunk.length === 0) return;
    text += chunk;
    if (marks && marks.length > 0) hasMarks = true;
    const last = spans[spans.length - 1];
    if (last && marksKey(last.marks) === marksKey(marks)) {
      last.text += chunk;
      return;
    }
    spans.push(marks && marks.length > 0 ? { text: chunk, marks } : { text: chunk });
  };

  for (const child of node.content ?? []) {
    if (child.type === "hardBreak") {
      append("\n", spans[spans.length - 1]?.marks);
      continue;
    }
    if (child.type !== "text") continue;
    const marks = (child.marks ?? [])
      .map(fromTipTapMark)
      .filter((mark): mark is JournalInlineMark => mark !== null);
    append(child.text ?? "", marks.length > 0 ? marks : undefined);
  }

  return hasMarks ? { text, spans } : { text };
};

export const blockToNode = (block: JournalTextBlock): JSONContent => ({
  type: "journalBlock",
  attrs: {
    blockId: block.id,
    blockKind: block.blockKind,
    checked: block.checked ?? false,
  },
  content: textToInlineContent(block.text, block.spans),
});

export const blocksToDoc = (blocks: JournalTextBlock[]): JSONContent => {
  let lastWithText = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].text.length > 0) lastWithText = i;
  }
  const end = Math.min(
    blocks.length - 1,
    Math.max(lastWithText + 1, 0)
  );
  const visible =
    blocks.length > 0 ? blocks.slice(0, end + 1) : [emptyParagraph()];

  return {
    type: "doc",
    content: visible.map(blockToNode),
  };
};

export const nodeToBlock = (node: JSONContent): JournalTextBlock => {
  const blockKind = (node.attrs?.blockKind ?? "paragraph") as TextBlockKind;
  const id = (node.attrs?.blockId as string | null) ?? newBlockId();
  const { text, spans } = inlineFromNode(node);
  const checked = Boolean(node.attrs?.checked);

  return {
    id,
    blockKind,
    text,
    spans,
    checked: blockKind === "checklist" ? checked : undefined,
  };
};

export const docToBlocks = (doc: JSONContent): JournalTextBlock[] => {
  const blocks: JournalTextBlock[] = [];
  for (const node of doc.content ?? []) {
    if (node.type !== "journalBlock") continue;
    blocks.push(nodeToBlock(node));
  }
  if (blocks.length === 0) {
    return [emptyParagraph()];
  }
  return blocks;
};

import type { JSONContent } from "@tiptap/core";
import type {
  JournalTextBlock,
  TextBlockKind,
} from "@/components/canvas/canvas-board";
import {
  emptyParagraph,
  newBlockId,
} from "@/lib/journal-blocks";

/** Inline content with hardBreak nodes for each newline. */
export const textToInlineContent = (text: string): JSONContent[] | undefined => {
  if (text.length === 0) return undefined;

  const lines = text.split("\n");
  const content: JSONContent[] = [];

  lines.forEach((line, index) => {
    if (line.length > 0) {
      content.push({ type: "text", text: line });
    }
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

  return content.length > 0 ? content : undefined;
};

const inlineTextFromNode = (node: JSONContent): string => {
  let text = "";
  for (const child of node.content ?? []) {
    if (child.type === "text") text += child.text ?? "";
    else if (child.type === "hardBreak") text += "\n";
  }
  return text;
};

export const blockToNode = (block: JournalTextBlock): JSONContent => ({
  type: "journalBlock",
  attrs: {
    blockId: block.id,
    blockKind: block.blockKind,
    checked: block.checked ?? false,
  },
  content: textToInlineContent(block.text),
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
  const text = inlineTextFromNode(node);
  const checked = Boolean(node.attrs?.checked);

  return {
    id,
    blockKind,
    text,
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

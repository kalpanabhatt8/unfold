import type { JournalTextBlock } from "@/components/canvas/canvas-board";
import { emptyParagraph, newBlockId } from "@/lib/journal-blocks";
import { blocksToDoc } from "@/lib/journal-blocks-bridge";

function inlineText(node: {
  content?: Array<{ type?: string; text?: string }>;
}): string {
  let text = "";
  for (const child of node.content ?? []) {
    if (child.type === "text") text += child.text ?? "";
    else if (child.type === "hardBreak") text += "\n";
  }
  return text;
}

/** Match the measure mirror width to the live page body before measuring. */
export function prepareMeasureRoot(
  measureRoot: HTMLElement,
  contentWidth: number
): HTMLElement {
  measureRoot.style.width = `${contentWidth}px`;
  return measureRoot;
}

function createMeasureSurface(measureRoot: HTMLElement) {
  measureRoot.innerHTML = "";
  const prose = document.createElement("div");
  prose.className = "journal-tiptap journal-tiptap--book-page";
  const pm = document.createElement("div");
  pm.className = "ProseMirror";
  prose.appendChild(pm);
  measureRoot.appendChild(prose);

  const renderBlocks = (subset: JournalTextBlock[]) => {
    const subsetDoc = blocksToDoc(subset);
    pm.innerHTML = "";
    for (const node of subsetDoc.content ?? []) {
      if (node.type !== "journalBlock") continue;
      const p = document.createElement("p");
      const kind = (node.attrs?.blockKind as string) ?? "paragraph";
      p.className = `journal-block is-${kind}`;
      if (node.attrs?.checked) p.classList.add("is-checked");
      p.style.whiteSpace = "pre-wrap";
      p.textContent = inlineText(node);
      pm.appendChild(p);
    }
    return pm.scrollHeight;
  };

  return {
    renderBlocks,
    cleanup: () => {
      measureRoot.innerHTML = "";
    },
  };
}

/** Render blocks in the measure mirror and return total content height (px). */
export function measureBlocksHeight(
  blocks: JournalTextBlock[],
  measureRoot: HTMLElement
): number {
  const { renderBlocks, cleanup } = createMeasureSurface(measureRoot);
  const height = renderBlocks(blocks);
  cleanup();
  return height;
}

/**
 * Split blocks so `kept` fits within maxHeight and overflow moves to the next page.
 */
export function splitBlocksForHeight(
  blocks: JournalTextBlock[],
  measureRoot: HTMLElement,
  maxHeight: number
): { kept: JournalTextBlock[]; overflow: JournalTextBlock[] } {
  if (maxHeight <= 0 || blocks.length === 0) {
    return { kept: blocks, overflow: [] };
  }

  const { renderBlocks, cleanup } = createMeasureSurface(measureRoot);

  if (renderBlocks(blocks) <= maxHeight) {
    cleanup();
    return { kept: blocks, overflow: [] };
  }

  const overflowFromEnd: JournalTextBlock[] = [];
  let working = [...blocks];

  while (working.length > 0) {
    if (renderBlocks(working) <= maxHeight) break;

    const last = working[working.length - 1];
    if (working.length > 1) {
      overflowFromEnd.unshift(working.pop()!);
      continue;
    }

    const split = splitBlockText(last, maxHeight, (subset) =>
      renderBlocks(subset)
    );
    if (split) {
      working = split.kept.length > 0 ? split.kept : [emptyParagraph()];
      if (split.overflow.text.trim().length > 0) {
        overflowFromEnd.unshift(split.overflow);
      }
      break;
    }

    overflowFromEnd.unshift(working.pop()!);
  }

  if (working.length === 0) {
    working = [emptyParagraph()];
  }

  cleanup();
  return { kept: working, overflow: overflowFromEnd };
}

function splitBlockText(
  block: JournalTextBlock,
  maxHeight: number,
  measure: (blocks: JournalTextBlock[]) => number
): { kept: JournalTextBlock[]; overflow: JournalTextBlock } | null {
  const text = block.text;
  if (!text) return null;

  let lo = 0;
  let hi = text.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const keptText = text.slice(0, mid);
    const keptBlock = { ...block, text: keptText };
    const height = measure([keptBlock]);
    if (height <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
    if (mid === 0 && height > maxHeight) break;
  }

  if (best <= 0) return null;

  return {
    kept: [{ ...block, text: text.slice(0, best) }],
    overflow: {
      ...block,
      id: newBlockId(),
      text: text.slice(best),
    },
  };
}

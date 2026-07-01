import type { JournalTextBlock } from "@/components/canvas/canvas-board";
import {
  measureBlocksHeight,
  prepareMeasureRoot,
  splitBlocksForHeight,
} from "@/lib/journal-page-overflow";

export type PageFitResult = {
  /** Blocks that fit on this page — only these may be stored or shown. */
  kept: JournalTextBlock[];
  /** Blocks that belong on the next page in the spread. */
  overflow: JournalTextBlock[];
};

/** Split blocks against a fixed writable area (width + height). */
export function fitBlocksToPage(
  blocks: JournalTextBlock[],
  measureRoot: HTMLElement,
  contentWidth: number,
  maxHeight: number
): PageFitResult {
  if (maxHeight <= 0 || contentWidth <= 0) {
    // Bounds not ready — never treat entire doc as overflow.
    return { kept: blocks, overflow: [] };
  }

  prepareMeasureRoot(measureRoot, contentWidth);

  if (measureBlocksHeight(blocks, measureRoot) <= maxHeight) {
    return { kept: blocks, overflow: [] };
  }

  return splitBlocksForHeight(blocks, measureRoot, maxHeight);
}

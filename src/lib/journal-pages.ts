import type { JournalTextBlock } from "@/components/canvas/canvas-board";
import { createWritingSlots, emptyParagraph } from "@/lib/journal-blocks";

/** Left/right page indices for a spread (spread 0 → pages 0,1; spread 1 → pages 2,3). */
export const spreadPageIndices = (spreadIndex: number) => ({
  left: spreadIndex * 2,
  right: spreadIndex * 2 + 1,
});

export const pageHasContent = (blocks: JournalTextBlock[] | undefined): boolean => {
  if (!blocks || blocks.length === 0) return false;
  return blocks.some((b) => b.text.trim().length > 0);
};

/** Last page index that has written content (0 if the book is blank). */
export const lastContentPageIndex = (
  pages: JournalTextBlock[][]
): number => {
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pageHasContent(pages[i])) return i;
  }
  return 0;
};

/** Last spread that contains written content. */
export const lastContentSpreadIndex = (pages: JournalTextBlock[][]): number =>
  Math.floor(lastContentPageIndex(pages) / 2);

export const ensurePageAt = (
  pages: JournalTextBlock[][],
  pageIndex: number
): JournalTextBlock[][] => {
  if (pageIndex < pages.length) return pages;
  const next = [...pages];
  while (next.length <= pageIndex) {
    next.push(createWritingSlots());
  }
  return next;
};

export const flattenPages = (pages: JournalTextBlock[][]): JournalTextBlock[] =>
  pages.flat();

/** Merge overflow blocks onto the start of a target page. */
export const prependBlocks = (
  existing: JournalTextBlock[] | undefined,
  incoming: JournalTextBlock[]
): JournalTextBlock[] => {
  const base = existing && existing.length > 0 ? existing : createWritingSlots();
  if (incoming.length === 0) return base;
  return [...incoming, ...base];
};

/** Append blocks to the end of a page. */
export const appendBlocks = (
  existing: JournalTextBlock[] | undefined,
  incoming: JournalTextBlock[]
): JournalTextBlock[] => {
  if (incoming.length === 0) {
    return existing && existing.length > 0 ? existing : createWritingSlots();
  }

  const base = existing && existing.length > 0 ? existing : [];
  const baseHasContent = base.some((b) => b.text.trim().length > 0);

  // Empty target page — use overflow directly (no leading empty paragraph).
  if (!baseHasContent) {
    return incoming;
  }

  const trimmed = base.filter(
    (b, i) => b.text.trim().length > 0 || i === base.length - 1
  );
  return [...trimmed, ...incoming];
};

/** Migrate legacy flat columns into paginated pages. */
export const columnsToPages = (
  columns: JournalTextBlock[][]
): JournalTextBlock[][] => {
  const flat = columns.flat();
  if (flat.length === 0) return [createWritingSlots()];
  return [flat];
};

export const emptyPages = (): JournalTextBlock[][] => [createWritingSlots()];

/** First page of the entry — heading only appears here. */
export const isEntryFirstPage = (pageIndex: number) => pageIndex === 0;

/** Whether this page is the right page of the current spread. */
export const isRightPageOfSpread = (pageIndex: number, spreadIndex: number) =>
  pageIndex === spreadIndex * 2 + 1;

/** Whether this page is the left page of the current spread. */
export const isLeftPageOfSpread = (pageIndex: number, spreadIndex: number) =>
  pageIndex === spreadIndex * 2;

/**
 * Infer spread / writing cursor from saved pages when reopening a draft.
 * Lands on the last page that has content (or page 0 for a blank book).
 */
export const inferBookWritingState = (
  pages: JournalTextBlock[][],
  savedSpreadIndex: number,
  isSealed: boolean
): {
  spreadIndex: number;
  writingPageIndex: number;
  spreadFull: boolean;
} => {
  if (isSealed) {
    return {
      spreadIndex: Math.max(0, savedSpreadIndex),
      writingPageIndex: -1,
      spreadFull: false,
    };
  }

  let lastContentPage = 0;
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pageHasContent(pages[i])) {
      lastContentPage = i;
      break;
    }
  }

  const spreadIndex = Math.max(savedSpreadIndex, Math.floor(lastContentPage / 2));
  const { left, right } = spreadPageIndices(spreadIndex);

  if (lastContentPage === right) {
    return { spreadIndex, writingPageIndex: right, spreadFull: false };
  }

  if (lastContentPage === left) {
    return { spreadIndex, writingPageIndex: left, spreadFull: false };
  }

  return { spreadIndex, writingPageIndex: left, spreadFull: false };
};

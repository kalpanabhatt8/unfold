"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import type { JournalTextBlock } from "@/components/canvas/canvas-board";
import {
  JournalTiptapEditor,
  type JournalTiptapEditorHandle,
} from "@/components/canvas/journal-tiptap-editor";
import type { PageBounds } from "@/components/canvas/extensions/journal-page-capacity";
import { isEntryFirstPage } from "@/lib/journal-pages";
import { fitBlocksToPage } from "@/lib/journal-page-fit";
import { measureBlocksHeight, prepareMeasureRoot } from "@/lib/journal-page-overflow";
import { formatJournalEntryDate, formatJournalSealedStamp } from "@/lib/journal-date";
import { bookDebug } from "@/lib/journal-book-debug";
import { BOOK_TITLE_PLACEHOLDER, clampBookTitle, commitBookTitle, MAX_BOOK_TITLE_CHARS } from "@/lib/book-title";
import { UNTITLED_ENTRY } from "@/lib/journal-title";
import {
  computeStampAnchorOnPage,
  JournalPageStamp,
  STAMP_EDGE_INSET_PX,
  type StampImprintAnchor,
  type StampPlacement,
} from "@/components/canvas/journal-stamp";

export type JournalPageEditorHandle = {
  focus: (position?: "start" | "end") => void;
  lock: () => void;
  getEditorHandle: () => JournalTiptapEditorHandle | null;
  getPageBounds: () => PageBounds | null;
  fitPageBlocks: (blocks: JournalTextBlock[]) => ReturnType<typeof fitBlocksToPage>;
  getStampImprintAnchor: () => StampImprintAnchor | null;
};

type JournalPageEditorProps = {
  pageIndex: number;
  blocks: JournalTextBlock[];
  isActive: boolean;
  isEditable: boolean;
  isSealed: boolean;
  isSealing?: boolean;
  title?: string;
  onTitleChange?: (title: string) => void;
  sealedAt?: number | null;
  sessionEditedAt?: number;
  onBlocksChange: (blocks: JournalTextBlock[]) => void;
  /** Atomic split — parent updates source + destination pages in one commit. */
  onPaginate: (kept: JournalTextBlock[], overflow: JournalTextBlock[]) => void;
  onActiveBlockChange: (blockId: string | null) => void;
  onSelectionActivity?: () => void;
  onFocus?: () => void;
  onWritingActivity?: () => void;
  /** When false, only the body/editor is rendered (right page inside flip leaf). */
  showChrome?: boolean;
  /** Click an inactive page in the spread to resume editing there. */
  onRequestActivate?: () => void;
  /** Right page shrank below capacity — clear spread-full state. */
  onPageFits?: () => void;
  /** Right page has no remaining writable space. */
  onSpreadFull?: () => void;
  /** Block overflow/pagination while parent handles a flip or cascade. */
  paginationFrozen?: boolean;
  /** Persisted signature imprint for sealed entries. */
  stampPlacement?: StampPlacement | null;
};

function getReadonlyContentEndRect(clip: HTMLElement | null): DOMRect | null {
  if (!clip) return null;

  const blocks = clip.querySelectorAll<HTMLElement>(".journal-block");
  for (let i = blocks.length - 1; i >= 0; i--) {
    const el = blocks[i];
    if (!el.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const rect = range.getBoundingClientRect();
    if (rect.height > 0) return rect;
  }

  const prose = clip.querySelector<HTMLElement>(".ProseMirror");
  if (!prose) return null;
  const rect = prose.getBoundingClientRect();
  return new DOMRect(rect.left, rect.bottom - 18, 0, 18);
}

export const JournalPageEditor = forwardRef<
  JournalPageEditorHandle,
  JournalPageEditorProps
>(function JournalPageEditor(
  {
    pageIndex,
    blocks,
    isActive,
    isEditable,
    isSealed,
    isSealing = false,
    title,
    onTitleChange,
    sealedAt = null,
    sessionEditedAt,
    onBlocksChange,
    onPaginate,
    onActiveBlockChange,
    onSelectionActivity,
    onFocus,
    onWritingActivity,
    showChrome = true,
    onRequestActivate,
    onPageFits,
    onSpreadFull,
    paginationFrozen = false,
    stampPlacement = null,
  },
  ref
) {
  const editorRef = useRef<JournalTiptapEditorHandle>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const overflowInFlightRef = useRef(false);
  const paginationFrozenRef = useRef(paginationFrozen);
  paginationFrozenRef.current = paginationFrozen;
  const showHeading = isEntryFirstPage(pageIndex);
  const isRightPage = pageIndex % 2 === 1;

  const persistedTitle = typeof title === "string" ? title.trim() : "";
  const [titleValue, setTitleValue] = useState(persistedTitle);
  const isTitleFocusedRef = useRef(false);

  useEffect(() => {
    if (isTitleFocusedRef.current) return;
    setTitleValue(persistedTitle);
  }, [persistedTitle]);

  const getPageBounds = useCallback((): PageBounds | null => {
    const clip = clipRef.current;
    const measure = measureRef.current;
    if (!clip || !measure) return null;

    const maxHeight = clip.clientHeight;
    const tiptap = clip.querySelector<HTMLElement>(".journal-tiptap");
    const contentWidth = tiptap?.clientWidth ?? clip.clientWidth;

    if (maxHeight <= 0 || contentWidth <= 0) return null;

    return { measure, contentWidth, maxHeight };
  }, []);

  useEffect(() => {
    if (!paginationFrozen) overflowInFlightRef.current = false;
  }, [paginationFrozen, blocks]);

  const handleWouldOverflow = useCallback(
    (kept: JournalTextBlock[], overflow: JournalTextBlock[], source: string) => {
      if (overflow.length === 0 || overflowInFlightRef.current) return;
      if (paginationFrozenRef.current) {
        bookDebug("overflow:editor", {
          pageIndex,
          source,
          blocked: "paginationFrozen",
        });
        return;
      }
      overflowInFlightRef.current = true;
      blocksRef.current = kept;
      bookDebug("overflow:editor", {
        pageIndex,
        source,
        keptLen: kept.reduce((n, b) => n + b.text.length, 0),
        overflowLen: overflow.reduce((n, b) => n + b.text.length, 0),
      });
      onPaginate(kept, overflow);
    },
    [onPaginate, pageIndex]
  );

  const commitPageBlocks = useCallback(
    (next: JournalTextBlock[]): JournalTextBlock[] | void => {
      const bounds = getPageBounds();
      if (!bounds || bounds.maxHeight <= 0 || bounds.contentWidth <= 0) {
        bookDebug("commit:bounds-not-ready", { pageIndex });
        return blocksRef.current;
      }

      const { kept, overflow } = fitBlocksToPage(
        next,
        bounds.measure,
        bounds.contentWidth,
        bounds.maxHeight
      );

      // Cross-page moves only via capacity-plugin (user input). Commit trims locally.
      if (overflow.length > 0) {
        bookDebug("commit:local-trim", {
          pageIndex,
          keptLen: kept.reduce((n, b) => n + b.text.length, 0),
          overflowLen: overflow.reduce((n, b) => n + b.text.length, 0),
        });
        if (JSON.stringify(blocksRef.current) !== JSON.stringify(kept)) {
          blocksRef.current = kept;
          onBlocksChange(kept);
        }
        return kept;
      }

      if (JSON.stringify(blocksRef.current) !== JSON.stringify(kept)) {
        blocksRef.current = kept;
        onBlocksChange(kept);
      }

      if (isRightPage) {
        prepareMeasureRoot(bounds.measure, bounds.contentWidth);
        const height = measureBlocksHeight(kept, bounds.measure);
        if (height >= bounds.maxHeight - 1) {
          onSpreadFull?.();
        } else {
          onPageFits?.();
        }
      }

      return undefined;
    },
    [getPageBounds, isRightPage, onBlocksChange, onPageFits, onSpreadFull, pageIndex]
  );

  useEffect(() => {
    if (isActive && isEditable) {
      requestAnimationFrame(() => editorRef.current?.focus("end"));
    }
  }, [isActive, isEditable]);

  const getStampImprintAnchor = useCallback((): StampImprintAnchor | null => {
    const pageEl = bodyRef.current?.closest<HTMLElement>(".journal-page");
    if (!pageEl) return null;

    const pageRect = pageEl.getBoundingClientRect();
    const clipRect = clipRef.current?.getBoundingClientRect();
    const contentBottomInset = clipRect
      ? Math.max(STAMP_EDGE_INSET_PX, pageRect.bottom - clipRect.bottom)
      : STAMP_EDGE_INSET_PX;
    const pagePadRight = clipRect
      ? Math.max(STAMP_EDGE_INSET_PX, pageRect.right - clipRect.right)
      : STAMP_EDGE_INSET_PX;

    const endRect =
      editorRef.current?.getContentEndRect() ??
      getReadonlyContentEndRect(clipRef.current);

    return computeStampAnchorOnPage(pageEl, endRect, pageIndex, {
      contentBottomInset,
      pagePadRight,
    });
  }, [pageIndex]);

  useImperativeHandle(
    ref,
    () => ({
      focus(position = "end") {
        editorRef.current?.focus(position);
      },
      lock() {
        editorRef.current?.lock();
      },
      getEditorHandle() {
        return editorRef.current;
      },
      getPageBounds,
      fitPageBlocks(blocksToFit: JournalTextBlock[]) {
        const bounds = getPageBounds();
        if (!bounds) return { kept: blocksToFit, overflow: [] as JournalTextBlock[] };
        return fitBlocksToPage(
          blocksToFit,
          bounds.measure,
          bounds.contentWidth,
          bounds.maxHeight
        );
      },
      getStampImprintAnchor,
    }),
    [getPageBounds, getStampImprintAnchor]
  );

  const displayTitle =
    persistedTitle.length > 0 ? persistedTitle : UNTITLED_ENTRY;

  const entryDisplayAt =
    isSealed && typeof sealedAt === "number" && Number.isFinite(sealedAt)
      ? sealedAt
      : sessionEditedAt;
  const entryDateStamp = useMemo(
    () =>
      typeof entryDisplayAt === "number" && Number.isFinite(entryDisplayAt)
        ? formatJournalEntryDate(entryDisplayAt)
        : null,
    [entryDisplayAt]
  );
  const entryDateTimeIso = useMemo(
    () =>
      typeof entryDisplayAt === "number" && Number.isFinite(entryDisplayAt)
        ? new Date(entryDisplayAt).toISOString()
        : undefined,
    [entryDisplayAt]
  );

  const body = (
    <div
      ref={bodyRef}
      className={clsx(
        "journal-page__body",
        !isActive && !isSealed && !isSealing && "cursor-text"
      )}
      data-writing-zone
      data-sealed={isSealed ? "" : undefined}
      data-sealing={isSealing ? "" : undefined}
      onPointerDown={() => {
        if (!isActive && !isSealed && !isSealing && onRequestActivate) {
          onRequestActivate();
        }
      }}
    >
      <div ref={clipRef} className="journal-page__clip">
        {isActive && isEditable ? (
          <JournalTiptapEditor
            key={`page-editor-${pageIndex}`}
            ref={editorRef}
            initialBlocks={blocks}
            isSealed={isSealed}
            isSealing={isSealing}
            maxBlocks={null}
            getPageBounds={getPageBounds}
            onWouldOverflow={(kept, overflow) =>
              handleWouldOverflow(kept, overflow, "capacity-plugin")
            }
            onBlocksChange={commitPageBlocks}
            onActiveBlockChange={onActiveBlockChange}
            onSelectionActivity={onSelectionActivity}
            onFocus={onFocus}
            onWritingActivity={onWritingActivity}
          />
        ) : (
          <JournalPageReadOnly blocks={blocks} isSealed={isSealed} />
        )}
      </div>
    </div>
  );

  if (!showChrome) {
    return (
      <>
        {body}
        <div ref={measureRef} className="journal-page__measure" aria-hidden />
      </>
    );
  }

  return (
    <div
      className={clsx(
        "journal-page",
        isRightPage ? "journal-page--right" : "journal-page--left",
        showHeading && "journal-page--has-heading"
      )}
      data-page-index={pageIndex}
    >
      {(showHeading || (isRightPage && isSealed && sealedAt)) && (
      <div className="journal-page__chrome">
        {showHeading ? (
          <div className="journal-page__heading-block">
            {isSealed ? (
              <h2 className="journal-page__heading">{displayTitle}</h2>
            ) : onTitleChange ? (
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(clampBookTitle(e.target.value))}
                maxLength={MAX_BOOK_TITLE_CHARS}
                onFocus={() => {
                  isTitleFocusedRef.current = true;
                }}
                onBlur={() => {
                  isTitleFocusedRef.current = false;
                  const next = commitBookTitle(titleValue);
                  setTitleValue(next);
                  if (next !== persistedTitle) onTitleChange(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder={BOOK_TITLE_PLACEHOLDER}
                spellCheck={false}
                aria-label="Entry title"
                className="journal-page__heading journal-page__heading-input"
              />
            ) : (
              <h2 className="journal-page__heading">{displayTitle}</h2>
            )}
            {entryDateStamp ? (
              <time
                className="journal-page__date"
                dateTime={entryDateTimeIso}
              >
                {isSealed && sealedAt ? (
                  formatJournalSealedStamp(sealedAt)
                ) : (
                  <>
                    <span>{entryDateStamp.date}, </span>
                    <span>{entryDateStamp.time}</span>
                  </>
                )}
              </time>
            ) : null}
          </div>
        ) : isRightPage && isSealed && sealedAt ? (
          <span className="journal-page__status">
            {formatJournalSealedStamp(sealedAt)}
          </span>
        ) : null}
      </div>
      )}

      {body}

      {stampPlacement?.pageIndex === pageIndex && (isSealed || isSealing) ? (
        <JournalPageStamp
          bottom={stampPlacement.bottom}
          right={stampPlacement.right}
        />
      ) : null}

      <div ref={measureRef} className="journal-page__measure" aria-hidden />
    </div>
  );
});

function JournalPageReadOnly({
  blocks,
  isSealed,
}: {
  blocks: JournalTextBlock[];
  isSealed: boolean;
}) {
  return (
    <div
      className={clsx(
        "journal-tiptap journal-tiptap--book-page journal-page__readonly",
        isSealed && "journal-page__readonly--sealed"
      )}
    >
      <div className="ProseMirror">
        {blocks.map((block) => {
          if (!block.text && blocks.length > 1) return null;
          const kind = block.blockKind;
          return (
            <p
              key={block.id}
              className={clsx(
                "journal-block",
                kind !== "paragraph" && `is-${kind}`,
                kind === "checklist" && block.checked && "is-checked"
              )}
            >
              {block.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

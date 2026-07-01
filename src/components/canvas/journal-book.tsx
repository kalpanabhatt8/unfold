"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import clsx from "clsx";
import type { JournalTextBlock } from "@/components/canvas/canvas-board";
import {
  JournalPageEditor,
  type JournalPageEditorHandle,
} from "@/components/canvas/journal-page-editor";
import type { JournalTiptapEditorHandle } from "@/components/canvas/journal-tiptap-editor";
import {
  appendBlocks,
  ensurePageAt,
  isLeftPageOfSpread,
  isRightPageOfSpread,
  lastContentSpreadIndex,
  spreadPageIndices,
} from "@/lib/journal-pages";
import { createWritingSlots } from "@/lib/journal-blocks";
import { bookDebug } from "@/lib/journal-book-debug";
import type { StampImprintAnchor, StampPlacement } from "@/components/canvas/journal-stamp";
import { JournalPageStamp } from "@/components/canvas/journal-stamp";
import { JournalCoverShape } from "@/components/canvas/journal-cover-shape";
import { useJournalCoverColor } from "@/components/canvas/use-journal-cover-color";

export const JOURNAL_PAGE_DEPTH_LAYER_COUNT = 5;

const PAGE_DEPTH_LAYERS = Array.from(
  { length: JOURNAL_PAGE_DEPTH_LAYER_COUNT },
  (_, i) => JOURNAL_PAGE_DEPTH_LAYER_COUNT - i
) as number[];

const PAGE_FLIP_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.33, 1, 0.45, 1],
  times: [0, 0.45, 1],
};

const PAGE_FLIP_FORWARD = {
  rotateY: [0, -92, -180],
  z: [0, 28, 0],
  rotateX: [0, -4, 0],
};

const PAGE_FLIP_BACKWARD = {
  rotateY: [0, 92, 180],
  z: [0, 28, 0],
  rotateX: [0, 4, 0],
};

const noop = () => {};
const noopBlocksChange = () => undefined;
const noopPaginate = () => {};

export type JournalBookHandle = {
  lockEditors: () => void;
  getActiveEditor: () => JournalTiptapEditorHandle | null;
  focusActive: (position?: "start" | "end") => void;
  getStampImprintAnchor: () => StampImprintAnchor | null;
};

type JournalBookProps = {
  pages: JournalTextBlock[][];
  spreadIndex: number;
  writingPageIndex: number;
  isSealed: boolean;
  isSealing?: boolean;
  title?: string;
  onTitleChange?: (title: string) => void;
  sealedAt?: number | null;
  sessionEditedAt: number;
  onPagesChange: (
    pages:
      | JournalTextBlock[][]
      | ((prev: JournalTextBlock[][]) => JournalTextBlock[][])
  ) => void;
  onSpreadIndexChange: (index: number) => void;
  onWritingPageIndexChange: (index: number) => void;
  onActiveBlockChange: (blockId: string | null) => void;
  onSelectionActivity?: () => void;
  onFocus?: () => void;
  onWritingActivity?: () => void;
  stampPlacement?: StampPlacement | null;
  coverBackground?: string;
  coverImage?: string | null;
  coverVariant?: "solid" | "image";
};

export const JournalBook = forwardRef<JournalBookHandle, JournalBookProps>(
  function JournalBook(
    {
      pages,
      spreadIndex,
      writingPageIndex,
      isSealed,
      isSealing = false,
      title,
      onTitleChange,
      sealedAt = null,
      sessionEditedAt,
      onPagesChange,
      onSpreadIndexChange,
      onWritingPageIndexChange,
      onActiveBlockChange,
      onSelectionActivity,
      onFocus,
      onWritingActivity,
      stampPlacement = null,
      coverBackground,
      coverImage,
      coverVariant = "solid",
    },
    ref
  ) {
    const reduceMotion = useReducedMotion();
    const leftEditorRef = useRef<JournalPageEditorHandle>(null);
    const rightEditorRef = useRef<JournalPageEditorHandle>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [flipMode, setFlipMode] = useState<"forward" | "backward" | null>(
      null
    );
    const isFlippingRef = useRef(false);
    const flipModeRef = useRef<"forward" | "backward" | null>(null);
    const paginateLockRef = useRef(false);
    const [paginateLocked, setPaginateLocked] = useState(false);
    const spreadIndexRef = useRef(spreadIndex);
    const flipGenerationRef = useRef(0);
    /** While animating, left page previews the next spread (blank) before flip completes. */
    const [flipPreviewSpread, setFlipPreviewSpread] = useState<number | null>(
      null
    );
    spreadIndexRef.current = spreadIndex;
    flipModeRef.current = flipMode;

    const paginationFrozen = isFlipping || paginateLocked;

    const leftSpreadIndex =
      flipMode === "forward" && flipPreviewSpread !== null
        ? flipPreviewSpread
        : spreadIndex;
    const rightSpreadIndex =
      flipMode === "backward" && flipPreviewSpread !== null
        ? flipPreviewSpread
        : spreadIndex;
    const { left: leftPageIndex } = spreadPageIndices(leftSpreadIndex);
    const { right: animatingRightPageIndex } =
      spreadPageIndices(rightSpreadIndex);
    const rightPageIndex = animatingRightPageIndex;

    const leftBlocks = pages[leftPageIndex] ?? createWritingSlots();
    const rightBlocks = pages[animatingRightPageIndex] ?? createWritingSlots();
    const maxSpreadIndex = lastContentSpreadIndex(pages);

    const flipBackLeftPageIndex =
      flipMode === "backward" && isFlipping && flipPreviewSpread !== null
        ? spreadPageIndices(flipPreviewSpread).left
        : null;
    const flipBackRightPageIndex =
      flipMode === "forward" && isFlipping && flipPreviewSpread !== null
        ? spreadPageIndices(flipPreviewSpread).right
        : null;
    const flipUnderLeftPageIndex =
      flipMode === "backward" && isFlipping && flipPreviewSpread !== null
        ? spreadPageIndices(flipPreviewSpread).left
        : null;
    const flipUnderRightPageIndex =
      flipMode === "forward" && isFlipping && flipPreviewSpread !== null
        ? spreadPageIndices(flipPreviewSpread).right
        : null;

    const focusWritingPage = useCallback((pageIndex: number) => {
      requestAnimationFrame(() => {
        if (pageIndex % 2 === 0) {
          leftEditorRef.current?.focus("end");
        } else {
          rightEditorRef.current?.focus("end");
        }
      });
    }, []);

    const updatePageBlocks = useCallback(
      (pageIndex: number, blocks: JournalTextBlock[]) => {
        onPagesChange((prev) => {
          const next = [...prev];
          next[pageIndex] = blocks;
          return next;
        });
      },
      [onPagesChange]
    );

    const flipPendingRef = useRef<{
      generation: number;
      direction: "forward" | "backward";
      toSpread: number;
      carryOverflow: JournalTextBlock[];
      fitterAtStart: JournalPageEditorHandle | null;
    } | null>(null);

    const finishSpreadFlip = useCallback(() => {
      const pending = flipPendingRef.current;
      if (!pending || pending.generation !== flipGenerationRef.current) {
        if (pending) bookDebug("flip:stale-timer", { generation: pending.generation });
        return;
      }

      const { generation, direction, toSpread, carryOverflow, fitterAtStart } =
        pending;
      flipPendingRef.current = null;

      const { left: newLeft, right: newRight } = spreadPageIndices(toSpread);

      if (direction === "forward" && !isSealed) {
        onPagesChange((prev) => {
          const next = ensurePageAt(prev, newRight);
          const updated = [...next];

          if (carryOverflow.length > 0) {
            const fitLeft = fitterAtStart?.fitPageBlocks(carryOverflow);
            if (fitLeft) {
              updated[newLeft] =
                fitLeft.kept.length > 0 ? fitLeft.kept : createWritingSlots();
              if (fitLeft.overflow.length > 0) {
                updated[newRight] = appendBlocks(
                  updated[newRight],
                  fitLeft.overflow
                );
                bookDebug("flip:carry-split", {
                  leftChars: fitLeft.kept.reduce((n, b) => n + b.text.length, 0),
                  rightChars: fitLeft.overflow.reduce(
                    (n, b) => n + b.text.length,
                    0
                  ),
                });
              }
            } else {
              updated[newLeft] = appendBlocks(updated[newLeft], carryOverflow);
            }
          }

          return updated;
        });
      }

      onSpreadIndexChange(toSpread);
      if (!isSealed) {
        onWritingPageIndexChange(newLeft);
        focusWritingPage(newLeft);
      }
      setFlipPreviewSpread(null);
      setFlipMode(null);
      isFlippingRef.current = false;
      paginateLockRef.current = false;
      setPaginateLocked(false);
      setIsFlipping(false);

      bookDebug("flip:complete", {
        generation,
        direction,
        newSpread: toSpread,
        newWritingPage: newLeft,
      });
    }, [
      focusWritingPage,
      isSealed,
      onPagesChange,
      onSpreadIndexChange,
      onWritingPageIndexChange,
    ]);

    const startSpreadFlip = useCallback(
      (
        direction: "forward" | "backward",
        carryOverflow: JournalTextBlock[] = [],
        reason = "unknown"
      ) => {
        if (isFlippingRef.current) {
          bookDebug("flip:blocked", {
            reason,
            direction,
            isFlipping: isFlippingRef.current,
          });
          return;
        }

        const fromSpread = spreadIndexRef.current;
        if (direction === "backward" && fromSpread <= 0) return;

        const toSpread =
          direction === "forward" ? fromSpread + 1 : fromSpread - 1;

        if (isSealed && direction === "forward" && toSpread > maxSpreadIndex) {
          bookDebug("flip:blocked", {
            reason,
            direction,
            toSpread,
            maxSpreadIndex,
          });
          return;
        }

        isFlippingRef.current = true;
        paginateLockRef.current = true;
        setPaginateLocked(true);
        const generation = ++flipGenerationRef.current;
        const fitterAtStart = rightEditorRef.current ?? leftEditorRef.current;

        setFlipPreviewSpread(toSpread);
        if (!isSealed) {
          const { right: previewRight } = spreadPageIndices(toSpread);
          onPagesChange((prev) => ensurePageAt(prev, previewRight));
        }

        bookDebug("flip:start", {
          reason,
          direction,
          generation,
          fromSpread,
          toSpread,
          carryChars: carryOverflow.reduce((n, b) => n + b.text.length, 0),
        });

        flipPendingRef.current = {
          generation,
          direction,
          toSpread,
          carryOverflow,
          fitterAtStart,
        };

        setFlipMode(direction);
        setIsFlipping(true);

        if (reduceMotion) {
          finishSpreadFlip();
        }
      },
      [finishSpreadFlip, isSealed, maxSpreadIndex, onPagesChange, reduceMotion]
    );

    const handleLeftFlipComplete = useCallback(() => {
      if (!isFlippingRef.current || flipModeRef.current !== "backward") return;
      finishSpreadFlip();
    }, [finishSpreadFlip]);

    const handleRightFlipComplete = useCallback(() => {
      if (!isFlippingRef.current || flipModeRef.current !== "forward") return;
      finishSpreadFlip();
    }, [finishSpreadFlip]);

    const handlePagePaginate = useCallback(
      (
        pageIndex: number,
        kept: JournalTextBlock[],
        overflow: JournalTextBlock[]
      ) => {
        if (overflow.length === 0) return;
        if (isSealed || paginateLockRef.current || isFlippingRef.current) {
          bookDebug("paginate:blocked", {
            pageIndex,
            paginateLock: paginateLockRef.current,
            isFlipping: isFlippingRef.current,
          });
          return;
        }

        paginateLockRef.current = true;
        setPaginateLocked(true);

        bookDebug("paginate:start", {
          pageIndex,
          spread: spreadIndexRef.current,
          keptChars: kept.reduce((n, b) => n + b.text.length, 0),
          overflowChars: overflow.reduce((n, b) => n + b.text.length, 0),
        });

        if (isLeftPageOfSpread(pageIndex, spreadIndexRef.current)) {
          const { right: rightIdx } = spreadPageIndices(spreadIndexRef.current);
          let cascadeOverflow: JournalTextBlock[] = [];

          onPagesChange((prev) => {
            const next = ensurePageAt(prev, rightIdx);
            const updated = [...next];
            updated[pageIndex] =
              kept.length > 0 ? kept : createWritingSlots();

            const existingRight = updated[rightIdx] ?? createWritingSlots();
            const merged = appendBlocks(existingRight, overflow);
            const fit = rightEditorRef.current?.fitPageBlocks(merged);

            if (fit) {
              updated[rightIdx] = fit.kept;
              cascadeOverflow = fit.overflow;
            } else {
              updated[rightIdx] = merged;
            }

            return updated;
          });

          if (cascadeOverflow.length > 0) {
            bookDebug("paginate:cascade-flip", {
              pageIndex,
              rightIdx,
              cascadeChars: cascadeOverflow.reduce(
                (n, b) => n + b.text.length,
                0
              ),
            });
            startSpreadFlip("forward", cascadeOverflow, "left-cascade");
            return;
          }

          bookDebug("paginate:left-to-right", { pageIndex, rightIdx });
          onWritingPageIndexChange(rightIdx);
          focusWritingPage(rightIdx);
          paginateLockRef.current = false;
          setPaginateLocked(false);
          return;
        }

        if (isRightPageOfSpread(pageIndex, spreadIndexRef.current)) {
          onPagesChange((prev) => {
            const updated = [...prev];
            updated[pageIndex] =
              kept.length > 0 ? kept : createWritingSlots();
            return updated;
          });
          bookDebug("paginate:right-flip", { pageIndex });
          startSpreadFlip("forward", overflow, "right-overflow");
          return;
        }

        paginateLockRef.current = false;
        setPaginateLocked(false);
      },
      [
        focusWritingPage,
        isSealed,
        onPagesChange,
        onWritingPageIndexChange,
        startSpreadFlip,
      ]
    );

    const activatePage = useCallback(
      (pageIndex: number) => {
        if (isSealed || isSealing || isFlipping) return;
        const { left, right } = spreadPageIndices(spreadIndexRef.current);
        if (pageIndex !== left && pageIndex !== right) return;
        onWritingPageIndexChange(pageIndex);
        focusWritingPage(pageIndex);
      },
      [focusWritingPage, isFlipping, isSealed, isSealing, onWritingPageIndexChange]
    );

    const handleEdgeForward = useCallback(() => {
      if (isFlippingRef.current) return;
      startSpreadFlip("forward", [], "edge-forward");
    }, [startSpreadFlip]);

    const handleEdgeBack = useCallback(() => {
      if (isFlippingRef.current || spreadIndex <= 0) return;
      startSpreadFlip("backward", [], "edge-back");
    }, [spreadIndex, startSpreadFlip]);

    const getStampImprintAnchor = useCallback((): StampImprintAnchor | null => {
      let targetPageIndex = writingPageIndex >= 0 ? writingPageIndex : 0;
      for (let i = pages.length - 1; i >= 0; i--) {
        if (pages[i]?.some((block) => block.text.trim().length > 0)) {
          targetPageIndex = i;
          break;
        }
      }

      const { left, right } = spreadPageIndices(spreadIndex);
      const pageEditorRef =
        targetPageIndex === left
          ? leftEditorRef
          : targetPageIndex === right
            ? rightEditorRef
            : null;
      return pageEditorRef?.current?.getStampImprintAnchor() ?? null;
    }, [pages, spreadIndex, writingPageIndex]);

    useImperativeHandle(
      ref,
      () => ({
        lockEditors() {
          leftEditorRef.current?.lock();
          rightEditorRef.current?.lock();
        },
        getActiveEditor() {
          if (writingPageIndex % 2 === 0) {
            return leftEditorRef.current?.getEditorHandle() ?? null;
          }
          return rightEditorRef.current?.getEditorHandle() ?? null;
        },
        focusActive(position = "end") {
          if (writingPageIndex % 2 === 0) {
            leftEditorRef.current?.focus(position);
          } else {
            rightEditorRef.current?.focus(position);
          }
        },
        getStampImprintAnchor,
      }),
      [getStampImprintAnchor, writingPageIndex]
    );

    useEffect(
      () => () => {
        flipGenerationRef.current += 1;
        flipPendingRef.current = null;
        isFlippingRef.current = false;
        paginateLockRef.current = false;
      },
      []
    );

    useEffect(() => {
      if (isSealed || isFlipping) return;
      if (writingPageIndex >= 0) {
        focusWritingPage(writingPageIndex);
      }
    }, [focusWritingPage, isFlipping, isSealed, spreadIndex, writingPageIndex]);

    const canEdit =
      !isSealed && !isSealing && !isFlipping && writingPageIndex >= 0;

    const journalCoverColor = useJournalCoverColor({
      background: coverBackground,
      coverImage,
      variant: coverVariant,
    });

    return (
      <div className="journal-book-shell">
        <div className="journal-book-row">
          <div
            className="journal-book"
            data-spread={spreadIndex}
            style={
              {
                "--journal-cover": journalCoverColor,
              } as CSSProperties
            }
          >
          <div className="journal-book__spread">
            <JournalCoverShape side="left" />
            <JournalCoverShape side="right" />
            <div
              className="journal-book__depth-stack journal-book__depth-stack--left"
              aria-hidden
            >
              {PAGE_DEPTH_LAYERS.map((layer) => (
                <div
                  key={layer}
                  className={`journal-book__page-depth journal-book__page-depth--${layer} journal-book__page-depth--left`}
                />
              ))}
            </div>
            <div
              className="journal-book__depth-stack journal-book__depth-stack--right"
              aria-hidden
            >
              {PAGE_DEPTH_LAYERS.map((layer) => (
                <div
                  key={layer}
                  className={`journal-book__page-depth journal-book__page-depth--${layer} journal-book__page-depth--right`}
                />
              ))}
            </div>
            <>
              <button
                type="button"
                className="journal-book__edge journal-book__edge--left"
                onClick={handleEdgeBack}
                disabled={spreadIndex <= 0 || isFlipping}
                aria-label="Previous page"
              />
              <button
                type="button"
                className="journal-book__edge journal-book__edge--right"
                onClick={handleEdgeForward}
                disabled={
                  isFlipping ||
                  (isSealed && spreadIndex >= maxSpreadIndex)
                }
                aria-label="Next page"
              />
            </>

            {flipUnderLeftPageIndex !== null ? (
              <div
                className="journal-book__page-under journal-book__page-under--left"
                aria-hidden
              >
                <div className="journal-page journal-page--left">
                  <JournalPageEditor
                    pageIndex={flipUnderLeftPageIndex}
                    blocks={
                      pages[flipUnderLeftPageIndex] ?? createWritingSlots()
                    }
                    isActive={false}
                    isEditable={false}
                    isSealed={isSealed}
                    isSealing={isSealing}
                    showChrome={false}
                    onBlocksChange={noopBlocksChange}
                    onPaginate={noopPaginate}
                    onActiveBlockChange={noop}
                    paginationFrozen
                  />
                </div>
              </div>
            ) : null}

            <motion.div
              key={`left-${leftSpreadIndex}`}
              className={clsx(
                "journal-book__left-leaf",
                flipMode === "backward" &&
                  isFlipping &&
                  "journal-book__left-leaf--active"
              )}
              style={{ transformStyle: "preserve-3d", transformOrigin: "right center" }}
              initial={false}
              animate={
                flipMode === "backward" && isFlipping
                  ? PAGE_FLIP_BACKWARD
                  : {
                      rotateY: 0,
                      z: 0,
                      rotateX: 0,
                    }
              }
              transition={PAGE_FLIP_TRANSITION}
              onAnimationComplete={handleLeftFlipComplete}
            >
              <div className="journal-book__left-face journal-book__left-face--front">
                <JournalPageEditor
                  ref={leftEditorRef}
                  pageIndex={leftPageIndex}
                  blocks={leftBlocks}
                  isActive={
                    canEdit &&
                    !isFlipping &&
                    writingPageIndex === leftPageIndex
                  }
                  isEditable={
                    canEdit &&
                    !isFlipping &&
                    writingPageIndex === leftPageIndex
                  }
                  isSealed={isSealed}
                  isSealing={isSealing}
                  title={title}
                  onTitleChange={onTitleChange}
                  sealedAt={sealedAt}
                  sessionEditedAt={sessionEditedAt}
                  onBlocksChange={(blocks) =>
                    updatePageBlocks(leftPageIndex, blocks)
                  }
                  onPaginate={(kept, overflow) =>
                    handlePagePaginate(leftPageIndex, kept, overflow)
                  }
                  onActiveBlockChange={onActiveBlockChange}
                  onSelectionActivity={onSelectionActivity}
                  onFocus={onFocus}
                  onWritingActivity={onWritingActivity}
                  onRequestActivate={() => activatePage(leftPageIndex)}
                  paginationFrozen={paginationFrozen}
                  stampPlacement={stampPlacement}
                />
              </div>
              <div
                className="journal-book__left-face journal-book__left-face--back"
                aria-hidden
              >
                {flipBackLeftPageIndex !== null ? (
                  <div className="journal-page journal-page--right">
                    <JournalPageEditor
                      pageIndex={flipBackLeftPageIndex}
                      blocks={
                        pages[flipBackLeftPageIndex] ?? createWritingSlots()
                      }
                      isActive={false}
                      isEditable={false}
                      isSealed={isSealed}
                      isSealing={isSealing}
                      showChrome={false}
                      onBlocksChange={noopBlocksChange}
                      onPaginate={noopPaginate}
                      onActiveBlockChange={noop}
                      paginationFrozen
                    />
                  </div>
                ) : null}
              </div>
            </motion.div>

            <div className="journal-book__gutter" aria-hidden />

            {flipUnderRightPageIndex !== null ? (
              <div
                className="journal-book__page-under journal-book__page-under--right"
                aria-hidden
              >
                <div className="journal-page journal-page--right">
                  <JournalPageEditor
                    pageIndex={flipUnderRightPageIndex}
                    blocks={
                      pages[flipUnderRightPageIndex] ?? createWritingSlots()
                    }
                    isActive={false}
                    isEditable={false}
                    isSealed={isSealed}
                    isSealing={isSealing}
                    showChrome={false}
                    onBlocksChange={noopBlocksChange}
                    onPaginate={noopPaginate}
                    onActiveBlockChange={noop}
                    paginationFrozen
                  />
                </div>
              </div>
            ) : null}

            <motion.div
              key={`right-${rightSpreadIndex}`}
              className={clsx(
                "journal-book__right-leaf",
                flipMode === "forward" &&
                  isFlipping &&
                  "journal-book__right-leaf--active"
              )}
              style={{ transformStyle: "preserve-3d", transformOrigin: "left center" }}
              initial={false}
              animate={
                flipMode === "forward" && isFlipping
                  ? PAGE_FLIP_FORWARD
                  : {
                      rotateY: 0,
                      z: 0,
                      rotateX: 0,
                    }
              }
              transition={PAGE_FLIP_TRANSITION}
              onAnimationComplete={handleRightFlipComplete}
            >
              <div className="journal-book__right-face journal-book__right-face--front">
                <div className="journal-page journal-page--right">
                  <div
                    className="journal-page__chrome journal-page__chrome--band"
                    aria-hidden
                  />
                  {isSealed && sealedAt ? (
                    <div className="journal-page__seal-float">
                      <span className="journal-page__status">
                        {`🌻 Sealed · ${new Date(sealedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
                      </span>
                    </div>
                  ) : null}
                  {stampPlacement?.pageIndex === rightPageIndex &&
                  (isSealed || isSealing) ? (
                    <JournalPageStamp
                      bottom={stampPlacement.bottom}
                      right={stampPlacement.right}
                    />
                  ) : null}
                  <JournalPageEditor
                    ref={rightEditorRef}
                    pageIndex={rightPageIndex}
                    blocks={rightBlocks}
                    isActive={canEdit && writingPageIndex === rightPageIndex}
                    isEditable={canEdit && writingPageIndex === rightPageIndex}
                    isSealed={isSealed}
                    isSealing={isSealing}
                    sealedAt={sealedAt}
                    sessionEditedAt={sessionEditedAt}
                    showChrome={false}
                    onBlocksChange={(blocks) =>
                      updatePageBlocks(rightPageIndex, blocks)
                    }
                    onPaginate={(kept, overflow) =>
                      handlePagePaginate(rightPageIndex, kept, overflow)
                    }
                    onActiveBlockChange={onActiveBlockChange}
                    onSelectionActivity={onSelectionActivity}
                    onFocus={onFocus}
                    onWritingActivity={onWritingActivity}
                    onRequestActivate={() => activatePage(rightPageIndex)}
                    paginationFrozen={paginationFrozen}
                    stampPlacement={stampPlacement}
                  />
                </div>
              </div>
              <div
                className="journal-book__right-face journal-book__right-face--back"
                aria-hidden
              >
                {flipBackRightPageIndex !== null ? (
                  <div className="journal-page journal-page--left">
                    <JournalPageEditor
                      pageIndex={flipBackRightPageIndex}
                      blocks={
                        pages[flipBackRightPageIndex] ?? createWritingSlots()
                      }
                      isActive={false}
                      isEditable={false}
                      isSealed={isSealed}
                      isSealing={isSealing}
                      showChrome={false}
                      onBlocksChange={noopBlocksChange}
                      onPaginate={noopPaginate}
                      onActiveBlockChange={noop}
                      paginationFrozen
                    />
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
          </div>
        </div>
      </div>
    );
  }
);

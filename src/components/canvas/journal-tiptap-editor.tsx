"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import HardBreak from "@tiptap/extension-hard-break";
import History from "@tiptap/extension-history";
import Placeholder from "@tiptap/extension-placeholder";
import type { TextBlockKind, JournalTextBlock } from "@/components/canvas/canvas-board";
import { JournalBlock } from "@/components/canvas/extensions/journal-block";
import { JournalMaxBlocks } from "@/components/canvas/extensions/journal-max-blocks";
import {
  JournalPageCapacity,
  type PageBounds,
} from "@/components/canvas/extensions/journal-page-capacity";
import { applyBlockKind, MAX_WRITING_BLOCKS } from "@/lib/journal-blocks";
import {
  blocksToDoc,
  docToBlocks,
} from "@/lib/journal-blocks-bridge";

const JournalDocument = Document.extend({
  content: "journalBlock+",
});

export type JournalTiptapEditorHandle = {
  blur: () => void;
  lock: () => void;
  focus: (position?: "start" | "end") => void;
  focusEnd: () => void;
  selectAll: () => void;
  setBlockKind: (
    kind: TextBlockKind,
    blockIds?: string[]
  ) => void;
  getActiveBlockId: () => string | null;
  getSelectionRect: () => DOMRect | null;
  /** Caret rect at the end of the document — for stamp placement. */
  getContentEndRect: () => DOMRect | null;
  getSelectedTextLength: () => number;
};

/** Return kept blocks when the editor must trim to match page storage. */
export type JournalBlocksChangeHandler = (
  blocks: JournalTextBlock[]
) => JournalTextBlock[] | void;

type JournalTiptapEditorProps = {
  initialBlocks: JournalTextBlock[];
  isSealed: boolean;
  isSealing?: boolean;
  maxBlocks?: number | null;
  getPageBounds: () => PageBounds | null;
  onWouldOverflow: (
    kept: JournalTextBlock[],
    overflow: JournalTextBlock[]
  ) => void;
  onBlocksChange: JournalBlocksChangeHandler;
  onActiveBlockChange: (blockId: string | null) => void;
  onSelectionActivity?: () => void;
  onFocus?: () => void;
  onWritingActivity?: () => void;
};

const findJournalBlockAtSelection = (
  editor: NonNullable<ReturnType<typeof useEditor>>
): { blockId: string; pos: number } | null => {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "journalBlock") {
      return {
        blockId: node.attrs.blockId as string,
        pos: $from.before(depth),
      };
    }
  }
  return null;
};

export const JournalTiptapEditor = forwardRef<
  JournalTiptapEditorHandle,
  JournalTiptapEditorProps
>(function JournalTiptapEditor(
  {
    initialBlocks,
    isSealed,
    isSealing = false,
    maxBlocks,
    getPageBounds,
    onWouldOverflow,
    onBlocksChange,
    onActiveBlockChange,
    onSelectionActivity,
    onFocus,
    onWritingActivity,
  },
  ref
) {
  const onBlocksChangeRef = useRef(onBlocksChange);
  onBlocksChangeRef.current = onBlocksChange;
  const onActiveBlockChangeRef = useRef(onActiveBlockChange);
  onActiveBlockChangeRef.current = onActiveBlockChange;
  const onSelectionActivityRef = useRef(onSelectionActivity);
  onSelectionActivityRef.current = onSelectionActivity;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const onWritingActivityRef = useRef(onWritingActivity);
  onWritingActivityRef.current = onWritingActivity;
  const getPageBoundsRef = useRef(getPageBounds);
  getPageBoundsRef.current = getPageBounds;
  const onWouldOverflowRef = useRef(onWouldOverflow);
  onWouldOverflowRef.current = onWouldOverflow;
  const paginatingRef = useRef(false);
  const syncingRef = useRef(false);
  const initialContentRef = useRef(blocksToDoc(initialBlocks));
  const isLocked = isSealed || isSealing;

  const editor = useEditor({
    extensions: [
      JournalDocument,
      Text,
      HardBreak,
      History,
      JournalBlock,
      JournalMaxBlocks.configure({
        max: maxBlocks === undefined ? MAX_WRITING_BLOCKS : maxBlocks,
      }),
      JournalPageCapacity.configure({
        getPageBounds: () => getPageBoundsRef.current(),
        onWouldOverflow: (kept, overflow) =>
          onWouldOverflowRef.current(kept, overflow),
      }),
      Placeholder.configure({
        showOnlyCurrent: true,
        includeChildren: false,
        emptyNodeClass: "is-empty",
        placeholder: ({ node }) => {
          if (node.type.name !== "journalBlock") return "";
          const kind = node.attrs.blockKind;
          if (kind === "bullet") return "List item";
          if (kind === "checklist") return "To-do";
          return "Start writing…";
        },
      }),
    ],
    content: initialContentRef.current,
    editable: !isLocked,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "journal-tiptap-editor outline-none",
        dir: "ltr",
        spellcheck: "true",
      },
      handleScrollToSelection: () => true,
    },
    onUpdate: ({ editor: ed }) => {
      if (paginatingRef.current || syncingRef.current) return;

      const blocks = docToBlocks(ed.getJSON());
      const trimTo = onBlocksChangeRef.current(blocks);

      if (trimTo) {
        paginatingRef.current = true;
        ed.commands.setContent(blocksToDoc(trimTo), false);
        paginatingRef.current = false;
      }

      onWritingActivityRef.current?.();
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const hit = findJournalBlockAtSelection(ed);
      onActiveBlockChangeRef.current(hit?.blockId ?? null);
      onSelectionActivityRef.current?.();
    },
    onFocus: () => {
      onFocusRef.current?.();
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isLocked);
    if (isLocked) editor.commands.blur();
  }, [editor, isLocked]);

  // Page storage is authoritative — editor only shows what fits this page.
  useEffect(() => {
    if (!editor || isLocked || paginatingRef.current) return;
    const fromEditor = docToBlocks(editor.getJSON());
    if (JSON.stringify(fromEditor) === JSON.stringify(initialBlocks)) return;
    syncingRef.current = true;
    paginatingRef.current = true;
    editor.commands.setContent(blocksToDoc(initialBlocks), false);
    paginatingRef.current = false;
    queueMicrotask(() => {
      syncingRef.current = false;
    });
  }, [editor, initialBlocks, isLocked]);

  useImperativeHandle(
    ref,
    () => ({
      blur() {
        editor?.commands.blur();
      },
      lock() {
        if (!editor) return;
        editor.setEditable(false);
        editor.commands.blur();
      },
      focus(position = "end") {
        editor?.commands.focus(position);
      },
      focusEnd() {
        editor?.commands.focus("end");
      },
      selectAll() {
        editor?.commands.selectAll();
      },
      setBlockKind(kind: TextBlockKind, blockIds?: string[]) {
        if (!editor) return;

        const { state, view } = editor;
        const hit = findJournalBlockAtSelection(editor);
        const activeId = hit?.blockId ?? null;
        const targets = new Set(
          blockIds && blockIds.length > 0
            ? blockIds
            : activeId
              ? [activeId]
              : []
        );

        if (targets.size === 0) return;

        const currentBlocks = docToBlocks(state.doc.toJSON());
        const { from, to } = state.selection;
        const selectedText = state.doc.textBetween(from, to, "\n");

        if (activeId && targets.size === 1 && targets.has(activeId) && hit) {
          const blockStart = hit.pos + 1;
          const blockNode = state.doc.nodeAt(hit.pos);
          const blockLen = blockNode?.content.size ?? 0;
          const lo = Math.max(0, Math.min(from - blockStart, blockLen));
          const hi = Math.max(0, Math.min(to - blockStart, blockLen));

          const { blocks: nextBlocks } = applyBlockKind(
            currentBlocks,
            activeId,
            kind,
            {
              blockText: currentBlocks.find((b) => b.id === activeId)?.text,
              selectionStart: lo,
              selectionEnd: hi,
              selectedText,
            }
          );
          const trimTo = onBlocksChangeRef.current(nextBlocks);
          if (trimTo) {
            editor.commands.setContent(blocksToDoc(trimTo), false);
          } else {
            editor.commands.setContent(blocksToDoc(nextBlocks), false);
          }
          return;
        }

        let tr = state.tr;
        state.doc.descendants((node, pos) => {
          if (node.type.name !== "journalBlock") return;
          const blockId = node.attrs.blockId as string;
          if (!targets.has(blockId)) return;

          const attrs =
            kind === "checklist"
              ? {
                  ...node.attrs,
                  blockKind: kind,
                  checked: node.attrs.checked ?? false,
                }
              : { ...node.attrs, blockKind: kind, checked: false };

          tr = tr.setNodeMarkup(pos, undefined, attrs);
        });
        view.dispatch(tr);
        const trimTo = onBlocksChangeRef.current(
          docToBlocks(editor.getJSON())
        );
        if (trimTo) {
          editor.commands.setContent(blocksToDoc(trimTo), false);
        }
      },
      getActiveBlockId() {
        return findJournalBlockAtSelection(editor!)?.blockId ?? null;
      },
      getSelectionRect() {
        if (!editor) return null;
        const { from, to } = editor.state.selection;
        if (from === to) return null;
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        return new DOMRect(
          Math.min(start.left, end.left),
          Math.min(start.top, end.top),
          Math.abs(end.right - start.left),
          Math.abs(end.bottom - start.top)
        );
      },
      getContentEndRect() {
        if (!editor) return null;
        const docSize = editor.state.doc.content.size;
        const pos = Math.max(1, docSize - 1);
        const coords = editor.view.coordsAtPos(pos);
        const lineHeight = Math.max(coords.bottom - coords.top, 16);
        return new DOMRect(coords.left, coords.top, 0, lineHeight);
      },
      getSelectedTextLength() {
        if (!editor) return 0;
        const { from, to } = editor.state.selection;
        return Math.abs(to - from);
      },
    }),
    [editor]
  );

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className="journal-tiptap journal-tiptap--book-page w-full h-full"
    />
  );
});

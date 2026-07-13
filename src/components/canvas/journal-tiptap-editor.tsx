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
import { JournalQuoteHighlight } from "@/components/canvas/extensions/journal-quote-highlight";
import { applyBlockKind } from "@/lib/journal-blocks";
import {
  blocksToDoc,
  docToBlocks,
} from "@/lib/journal-blocks-bridge";
import { findQuoteRange } from "@/lib/journal-quote-focus";

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
  getSelectedTextLength: () => number;
  /** Highlight a Patterns quote; returns the range when found. */
  highlightQuote: (quote: string) => { from: number; to: number } | null;
  clearQuoteHighlight: () => void;
  /** Viewport coords for a doc range (for scrolling the writing column). */
  getRangeCoords: (
    from: number,
    to: number,
  ) => { top: number; bottom: number } | null;
};

type JournalTiptapEditorProps = {
  initialBlocks: JournalTextBlock[];
  isSealed: boolean;
  isSealing?: boolean;
  onBlocksChange: (blocks: JournalTextBlock[]) => void;
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
  const initialContentRef = useRef(blocksToDoc(initialBlocks));
  const isLocked = isSealed || isSealing;

  const editor = useEditor({
    extensions: [
      JournalDocument,
      Text,
      HardBreak,
      History,
      JournalBlock,
      JournalMaxBlocks,
      JournalQuoteHighlight,
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
    },
    onUpdate: ({ editor: ed }) => {
      onBlocksChangeRef.current(docToBlocks(ed.getJSON()));
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
    if (isLocked) {
      editor.commands.blur();
    }
  }, [editor, isLocked]);

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
        if (!editor) return;
        editor.commands.focus(position);
      },
      focusEnd() {
        if (!editor) return;
        editor.commands.focus("end");
      },
      selectAll() {
        if (!editor) return;
        editor.commands.selectAll();
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
          editor.commands.setContent(blocksToDoc(nextBlocks), false);
          onBlocksChangeRef.current(nextBlocks);
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
        onBlocksChangeRef.current(docToBlocks(editor.getJSON()));
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
      getSelectedTextLength() {
        if (!editor) return 0;
        const { from, to } = editor.state.selection;
        return Math.abs(to - from);
      },
      highlightQuote(quote: string) {
        if (!editor) return null;
        const range = findQuoteRange(editor.state.doc, quote);
        if (!range) return null;
        editor.commands.setQuoteHighlight(range);
        return range;
      },
      clearQuoteHighlight() {
        editor?.commands.clearQuoteHighlight();
      },
      getRangeCoords(from: number, to: number) {
        if (!editor) return null;
        try {
          const start = editor.view.coordsAtPos(from);
          const end = editor.view.coordsAtPos(to);
          return {
            top: Math.min(start.top, end.top),
            bottom: Math.max(start.bottom, end.bottom),
          };
        } catch {
          return null;
        }
      },
    }),
    [editor]
  );

  if (!editor) return null;

  return (
    <EditorContent
      editor={editor}
      className="journal-tiptap w-full"
    />
  );
});

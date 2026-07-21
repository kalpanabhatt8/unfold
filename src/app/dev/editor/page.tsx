"use client";

import { useEffect, useRef, useState } from "react";
import {
  JournalTiptapEditor,
  type JournalTiptapEditorHandle,
} from "@/components/canvas/journal-tiptap-editor";
import type { JournalTextBlock } from "@/components/canvas/canvas-board";
import { createWritingSlots } from "@/lib/journal-blocks";

export default function EditorDevPage() {
  const [mounted, setMounted] = useState(false);
  const [blocks, setBlocks] = useState<JournalTextBlock[]>(() =>
    createWritingSlots(),
  );
  const editorRef = useRef<JournalTiptapEditorHandle>(null);

  // TipTap with immediatelyRender requires a browser document — skip SSR.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="min-h-[100svh] bg-[#faf8f5] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-[#3a2820]">
          Journal editor (Tiptap)
        </h1>
        <p className="mt-1 text-sm text-black/50">
          Enter splits paragraphs. Backspace at line start merges. Max 7 blocks.
        </p>

        <div className="mt-8 rounded-2xl border border-black/[0.08] bg-white/80 p-6">
          {mounted ? (
            <JournalTiptapEditor
              ref={editorRef}
              initialBlocks={blocks}
              isSealed={false}
              onBlocksChange={setBlocks}
              onActiveBlockChange={() => {}}
            />
          ) : (
            <p className="text-sm text-black/40">Loading editor…</p>
          )}
        </div>

        <pre className="mt-8 overflow-auto rounded-xl bg-black/[0.04] p-4 text-xs text-black/70">
          {JSON.stringify(
            blocks.filter(
              (b, i) =>
                b.text.length > 0 || i <= blocks.findIndex((x) => !x.text),
            ),
            null,
            2,
          )}
        </pre>
      </div>
    </main>
  );
}

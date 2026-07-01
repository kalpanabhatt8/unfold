import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { JournalTextBlock } from "@/components/canvas/canvas-board";
import { fitBlocksToPage } from "@/lib/journal-page-fit";
import { docToBlocks } from "@/lib/journal-blocks-bridge";
import { bookDebug } from "@/lib/journal-book-debug";

export type PageBounds = {
  measure: HTMLElement;
  contentWidth: number;
  maxHeight: number;
};

export type JournalPageCapacityOptions = {
  getPageBounds: () => PageBounds | null;
  onWouldOverflow: (
    kept: JournalTextBlock[],
    overflow: JournalTextBlock[]
  ) => void;
};

/**
 * Rejects input that would exceed the fixed page area and routes overflow
 * to the next page via onWouldOverflow (pagination / spread flip).
 */
export const JournalPageCapacity = Extension.create<JournalPageCapacityOptions>({
  name: "journalPageCapacity",

  addOptions() {
    return {
      getPageBounds: () => null,
      onWouldOverflow: () => {},
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    let overflowDispatching = false;

    return [
      new Plugin({
        key: new PluginKey("journalPageCapacity"),
        filterTransaction(tr, state) {
          if (!tr.docChanged) return true;

          const beforeLen = state.doc.textContent.length;
          const afterLen = tr.doc.textContent.length;
          if (afterLen <= beforeLen) return true;

          const bounds = opts.getPageBounds();
          if (!bounds || bounds.maxHeight <= 0 || bounds.contentWidth <= 0) {
            return false;
          }

          const attempted = docToBlocks(tr.doc.toJSON());
          const { kept, overflow } = fitBlocksToPage(
            attempted,
            bounds.measure,
            bounds.contentWidth,
            bounds.maxHeight
          );

          if (overflow.length === 0) return true;
          if (overflowDispatching) return false;

          overflowDispatching = true;
          bookDebug("overflow:capacity-plugin", {
            keptChars: kept.reduce((n, b) => n + b.text.length, 0),
            overflowChars: overflow.reduce((n, b) => n + b.text.length, 0),
          });
          queueMicrotask(() => {
            overflowDispatching = false;
            opts.onWouldOverflow(kept, overflow);
          });
          return false;
        },
      }),
    ];
  },
});

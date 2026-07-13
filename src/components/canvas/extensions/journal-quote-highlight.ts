import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type QuoteHighlightRange = { from: number; to: number };

export const journalQuoteHighlightKey = new PluginKey<QuoteHighlightRange | null>(
  "journalQuoteHighlight",
);

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    journalQuoteHighlight: {
      setQuoteHighlight: (range: QuoteHighlightRange) => ReturnType;
      clearQuoteHighlight: () => ReturnType;
    };
  }
}

/**
 * Temporary inline decoration for Patterns → Journal quote focus.
 * Positions map through edits; cleared imperatively after fade / scroll.
 */
export const JournalQuoteHighlight = Extension.create({
  name: "journalQuoteHighlight",

  addCommands() {
    return {
      setQuoteHighlight:
        (range) =>
        ({ tr, dispatch }) => {
          if (range.from >= range.to) return false;
          if (dispatch) {
            tr.setMeta(journalQuoteHighlightKey, range);
            dispatch(tr);
          }
          return true;
        },
      clearQuoteHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(journalQuoteHighlightKey, null);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<QuoteHighlightRange | null>({
        key: journalQuoteHighlightKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(journalQuoteHighlightKey) as
              | QuoteHighlightRange
              | null
              | undefined;
            if (meta !== undefined) return meta;
            if (!value) return null;
            return {
              from: tr.mapping.map(value.from),
              to: tr.mapping.map(value.to),
            };
          },
        },
        props: {
          decorations(state) {
            const range = journalQuoteHighlightKey.getState(state);
            if (!range || range.from >= range.to) return null;
            if (range.to > state.doc.content.size) return null;
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, {
                class: "journal-quote-highlight",
              }),
            ]);
          },
        },
      }),
    ];
  },
});

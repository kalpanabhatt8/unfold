import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { MAX_WRITING_BLOCKS } from "@/lib/journal-blocks";

/**
 * At the journal line cap, Enter inserts a hard break inside the current
 * block instead of splitting into a new paragraph node.
 */
export const JournalMaxBlocks = Extension.create({
  name: "journalMaxBlocks",

  addOptions() {
    return { max: MAX_WRITING_BLOCKS as number | null };
  },

  addProseMirrorPlugins() {
    const max = this.options.max;

    return [
      new Plugin({
        key: new PluginKey("journalMaxBlocks"),
        filterTransaction(tr) {
          if (!tr.docChanged) return true;
          return tr.doc.childCount > 0;
        },
        props: {
          handleKeyDown(view, event) {
            if (max === null) return false;
            if (event.key !== "Enter" || event.shiftKey) return false;
            if (event.isComposing) return false;

            const { state } = view;
            if (state.doc.childCount < max) return false;

            const hardBreak = state.schema.nodes.hardBreak;
            if (!hardBreak) return true;

            event.preventDefault();
            const { tr } = state;
            if (!tr.selection.empty) tr.deleteSelection();
            const { from } = tr.selection;
            tr.insert(from, hardBreak.create());
            tr.setSelection(TextSelection.create(tr.doc, from + 1));
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});

import { Node, mergeAttributes } from "@tiptap/core";
import { joinBackward } from "@tiptap/pm/commands";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { newBlockId } from "@/lib/journal-blocks";

const CHECKLIST_HIT_WIDTH_PX = 28;

/** Block = one <p> inside the contenteditable — same model as standard editors. */
export const JournalBlock = Node.create({
  name: "journalBlock",
  priority: 1000,
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      blockId: {
        default: () => newBlockId(),
        keepOnSplit: false,
      },
      blockKind: { default: "paragraph" },
      checked: { default: false },
    };
  },

  parseHTML() {
    return [
      { tag: 'p[data-journal-block=""]' },
      { tag: 'div[data-journal-block=""]' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.blockKind as string;
    const checked = Boolean(node.attrs.checked);
    const classes = ["journal-block"];
    if (kind === "bullet") classes.push("is-bullet");
    if (kind === "checklist") {
      classes.push("is-checklist");
      if (checked) classes.push("is-checked");
    }

    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-journal-block": "",
        "data-block-kind": kind,
        class: classes.join(" "),
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ state, dispatch, view }) => {
          if (!state.selection.empty) return false;
          return joinBackward(state, dispatch, view);
        }),
      "Mod-Backspace": () =>
        this.editor.commands.command(({ state, dispatch, view }) => {
          if (!state.selection.empty) return false;
          return joinBackward(state, dispatch, view);
        }),
      "Shift-Backspace": () =>
        this.editor.commands.command(({ state, dispatch, view }) => {
          if (!state.selection.empty) return false;
          return joinBackward(state, dispatch, view);
        }),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("journalChecklistToggle"),
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (!(event instanceof MouseEvent) || event.button !== 0) {
                return false;
              }

              const target = event.target as HTMLElement;
              const row = target.closest(
                "p.journal-block.is-checklist"
              ) as HTMLElement | null;
              if (!row) return false;

              const rect = row.getBoundingClientRect();
              if (event.clientX - rect.left > CHECKLIST_HIT_WIDTH_PX) {
                return false;
              }

              const hit = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              if (!hit) return false;

              const $pos = view.state.doc.resolve(hit.pos);
              let depth = $pos.depth;
              while (
                depth > 0 &&
                $pos.node(depth).type.name !== "journalBlock"
              ) {
                depth -= 1;
              }
              if (depth === 0 || $pos.node(depth).type.name !== "journalBlock") {
                return false;
              }

              const nodePos = $pos.before(depth);
              const block = $pos.node(depth);
              if (block.attrs.blockKind !== "checklist") return false;

              event.preventDefault();
              view.dispatch(
                view.state.tr.setNodeMarkup(nodePos, undefined, {
                  ...block.attrs,
                  checked: !block.attrs.checked,
                })
              );
              return true;
            },
          },
        },
      }),
    ];
  },
});

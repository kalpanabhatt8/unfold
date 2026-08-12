import { Mark, mergeAttributes } from "@tiptap/core";

export type JournalHighlightColor = "pink" | "green" | "sage";

const HIGHLIGHT_COLORS = new Set<JournalHighlightColor>([
  "pink",
  "green",
  "sage",
]);

const parseHighlightColor = (value: unknown): JournalHighlightColor =>
  HIGHLIGHT_COLORS.has(value as JournalHighlightColor)
    ? (value as JournalHighlightColor)
    : "pink";

export const JournalBold = Mark.create({
  name: "bold",
  parseHTML() {
    return [
      { tag: "strong" },
      { tag: "b" },
      {
        style: "font-weight",
        getAttrs: (value) =>
          /^(bold|700|800|900)$/.test(value as string) ? null : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["strong", mergeAttributes(HTMLAttributes), 0];
  },
});

export const JournalHighlight = Mark.create({
  name: "highlight",
  addAttributes() {
    return {
      color: {
        default: "pink",
        parseHTML: (element) =>
          parseHighlightColor(element.getAttribute("data-highlight-color")),
        renderHTML: (attributes) => ({
          "data-highlight-color": parseHighlightColor(attributes.color),
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "mark" }, { tag: 'span[data-journal-highlight=""]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(HTMLAttributes, {
        class: "journal-user-highlight",
        "data-journal-highlight": "",
      }),
      0,
    ];
  },
});

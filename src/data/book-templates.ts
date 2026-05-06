import type { CanvasSnapshot } from "@/components/canvas/canvas-board";
import type { CoverGradientId } from "@/data/cover-gradients";

export type TemplateCategory =
  | "tone1"
  | "colorful"
  | "professional"
  | "playful";

type TemplateCanvasSnapshot = Omit<CanvasSnapshot, "updatedAt">;

export type BookTemplate = {
  id: string;
  category: TemplateCategory;
  variant: "solid" | "image";
  title: string;
  subtitle?: string;
  coverImage?: string | null;
  /** Preset in `book.css` (`--book-cover-gradient-*`); use `coverBackgroundVar()`. */
  coverGradientId: CoverGradientId;
  titleColor?: string | null;
  subtitleColor?: string | null;
  canvas: TemplateCanvasSnapshot;
};

type CoverImageContext = {
  keys(): string[];
};

declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp
  ): CoverImageContext;
};

const coverImageContext = require.context(
  "../../public/Images/cover-images",
  false,
  /\.(png|jpe?g|webp)$/
);

const coverImagePaths: string[] = coverImageContext
  .keys()
  .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }))
  .map((path: string) => `/Images/cover-images/${path.replace("./", "")}`);

const getCoverImage = (index: number) => {
  if (coverImagePaths.length === 0) return "";
  return coverImagePaths[index % coverImagePaths.length];
};

const DEFAULT_TEMPLATE_BACKGROUND = "#fbf8f1";

const createSnapshot = (
  overrides: Partial<TemplateCanvasSnapshot>
): TemplateCanvasSnapshot => ({
  version: 4,
  textColumns: [[]],
  imageBlocks: [],
  background: DEFAULT_TEMPLATE_BACKGROUND,
  columns: 1,
  ...overrides,
});

const templates: BookTemplate[] = [
  {
    id: "tone1-focus",
    category: "tone1",
    variant: "solid",
    title: "Morning Focus",
    subtitle: "Plan the day with intention",
    coverImage: null,
    coverGradientId: "g3",
    canvas: createSnapshot({
      background: "#fbf8f1",
      columns: 1,
      textColumns: [
        [
          {
            id: "text-morning-focus",
            blockKind: "paragraph",
            text: "Morning Focus",
          },
          {
            id: "text-morning-prompt",
            blockKind: "paragraph",
            text: "What absolutely matters today?",
          },
          {
            id: "text-morning-todo-1",
            blockKind: "checklist",
            text: "",
            checked: false,
          },
          {
            id: "text-morning-todo-2",
            blockKind: "checklist",
            text: "",
            checked: false,
          },
          {
            id: "text-morning-todo-3",
            blockKind: "checklist",
            text: "",
            checked: false,
          },
        ],
      ],
    }),
  },
  {
    id: "tone1-reflection",
    category: "tone1",
    variant: "image",
    title: "Evening Reflection",
    subtitle: "Wrap up with clarity",
    coverImage: getCoverImage(1),
    coverGradientId: "g2",
    canvas: createSnapshot({
      background: "#eaeef3",
      columns: 1,
      textColumns: [
        [
          {
            id: "text-reflection-title",
            blockKind: "paragraph",
            text: "Evening Reflection",
          },
          {
            id: "text-reflection-prompt",
            blockKind: "paragraph",
            text: "Three things that went well",
          },
          {
            id: "text-reflection-1",
            blockKind: "bullet",
            text: "",
          },
          {
            id: "text-reflection-2",
            blockKind: "bullet",
            text: "",
          },
          {
            id: "text-reflection-3",
            blockKind: "bullet",
            text: "",
          },
        ],
      ],
    }),
  },
  {
    id: "colorful-moodboard",
    category: "colorful",
    variant: "solid",
    title: "Color Moodboard",
    subtitle: "Palette explorations",
    coverImage: null,
    coverGradientId: "g4",
    canvas: createSnapshot({
      background: "#f5ecec",
      columns: 1,
      textColumns: [
        [
          {
            id: "text-moodboard-title",
            blockKind: "paragraph",
            text: "Color Moodboard",
          },
          {
            id: "text-moodboard-note",
            blockKind: "paragraph",
            text: "Drop in images, jot down the feeling each color evokes.",
          },
        ],
      ],
    }),
  },
  {
    id: "colorful-vision",
    category: "colorful",
    variant: "solid",
    title: "Vision Wall",
    subtitle: "Scenes that excite you",
    coverImage: null,
    coverGradientId: "g5",
    canvas: createSnapshot({
      background: "#edf1ec",
      columns: 1,
      textColumns: [
        [
          {
            id: "text-vision-title",
            blockKind: "paragraph",
            text: "Vision Wall",
          },
          {
            id: "text-vision-note",
            blockKind: "paragraph",
            text: "What does the next chapter look like?",
          },
        ],
      ],
    }),
  },
];

const cloneCanvas = (
  snapshot: TemplateCanvasSnapshot
): TemplateCanvasSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as TemplateCanvasSnapshot;

export const starterBookTemplates: BookTemplate[] = templates;
export const bookCoverSamples: string[] = coverImagePaths;

export function getTemplateById(id: string): BookTemplate | null {
  const template = starterBookTemplates.find((item) => item.id === id);
  if (!template) return null;
  return {
    ...template,
    canvas: cloneCanvas(template.canvas),
  };
}

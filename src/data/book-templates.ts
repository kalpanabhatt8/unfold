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

const createSnapshot = (
  overrides: Partial<TemplateCanvasSnapshot>
): TemplateCanvasSnapshot => ({
  version: 1,
  theme: "tone1",
  background: { color: "#f8f7ff" },
  textElements: [],
  stickyNotes: [],
  imageElements: [],
  stickerElements: [],
  audioElements: [],
  globalAudio: null,
  ...overrides,
  // textElements: overrides.textElements ?? [],
  // stickyNotes: overrides.stickyNotes ?? [],
  // imageElements: overrides.imageElements ?? [],
  // stickerElements: overrides.stickerElements ?? [],
  // audioElements: overrides.audioElements ?? [],
  // globalAudio:
  //   typeof overrides.globalAudio === "undefined" ? null : overrides.globalAudio,
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
    // titleColor: "#2f2a4a",
    // subtitleColor: "#5b5775",
    canvas: createSnapshot({
      theme: "tone1",
      background: { color: "#f7f6fb" },
      textElements: [
        {
          id: "text-morning-focus",
          text: "Morning Focus",
          fontSize: 36,
          fontFamily: "var(--font-manrope)",
          bold: true,
          italic: false,
          align: "left",
          curve: false,
          x: 80,
          y: 72,
          rotation: 0,
          isEditing: false,
        },
        {
          id: "text-intro",
          text: "What absolutely matters today?",
          fontSize: 18,
          fontFamily: "var(--font-manrope)",
          bold: false,
          italic: false,
          align: "left",
          curve: false,
          x: 82,
          y: 120,
          rotation: 0,
          isEditing: false,
        },
      ],
      stickyNotes: [
        {
          id: "sticky-priorities",
          text: "Priorities\n• Deep work 9-11\n• Ship sprint update\n• Walk in the sun",
          color: "#FFEFA1",
          fontSize: 16,
          bold: false,
          x: 360,
          y: 160,
          rotation: -3,
        },
        {
          id: "sticky-checkins",
          text: "Quick check-ins\n□ Product sync\n□ Finance ping\n□ Reply to Jess",
          color: "#D4F2FF",
          fontSize: 15,
          bold: false,
          x: 120,
          y: 220,
          rotation: 2,
        },
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
    // titleColor: "#343047",
    // subtitleColor: "#655f7d",
    canvas: createSnapshot({
      theme: "tone1",
      background: {
        image: "linear-gradient(135deg, #fdfbff 0%, #ece6ff 100%)",
      },
      textElements: [
        {
          id: "text-reflection-title",
          text: "Evening Reflection",
          fontSize: 34,
          fontFamily: "var(--font-manrope)",
          bold: true,
          italic: false,
          align: "left",
          curve: false,
          x: 90,
          y: 80,
          rotation: 0,
          isEditing: false,
        },
      ],
      stickyNotes: [
        {
          id: "sticky-grateful",
          text: "Grateful for\n- kind feedback\n- warm coffee\n- a little progress",
          color: "#FFD6E0",
          fontSize: 16,
          bold: false,
          x: 360,
          y: 160,
          rotation: -4,
        },
        {
          id: "sticky-lessons",
          text: "Lessons to keep\n1. Protect focus blocks\n2. Clarify before coding\n3. Celebrate tiny wins",
          color: "#E0F4D2",
          fontSize: 16,
          bold: false,
          x: 160,
          y: 240,
          rotation: 6,
        },
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
    // titleColor: "#412246",
    // subtitleColor: "#683968",
    canvas: createSnapshot({
      theme: "tone2",
      background: { color: "#fff2f5" },
      textElements: [
        {
          id: "text-moodboard",
          text: "Color Moodboard",
          fontSize: 34,
          fontFamily: "var(--font-gochi)",
          bold: false,
          italic: false,
          align: "center",
          curve: false,
          x: 220,
          y: 70,
          rotation: 0,
          isEditing: false,
        },
      ],
      stickyNotes: [
        {
          id: "sticky-palette",
          text: "#F75C8F • Punchy pink\n#FFC15E • Golden sun\n#7DCFB6 • Mint breeze",
          color: "#FFE5EE",
          fontSize: 15,
          bold: false,
          x: 120,
          y: 170,
          rotation: -6,
        },
        {
          id: "sticky-textures",
          text: "Texture ideas\n• Soft gradients\n• Hand-drawn frames\n• Confetti sprinkles",
          color: "#E4F0FF",
          fontSize: 15,
          bold: false,
          x: 360,
          y: 240,
          rotation: 5,
        },
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
    // titleColor: "#2c2a6b",
    // subtitleColor: "#554fa6",
    canvas: createSnapshot({
      theme: "tone2",
      background: {
        image: "linear-gradient(160deg, #fff4d8 0%, #ffd8f0 100%)",
      },
      textElements: [
        {
          id: "text-vision-wall",
          text: "Vision Wall",
          fontSize: 30,
          fontFamily: "var(--font-manrope)",
          bold: true,
          italic: false,
          align: "left",
          curve: false,
          x: 90,
          y: 80,
          rotation: 0,
          isEditing: false,
        },
      ],
      stickyNotes: [
        {
          id: "sticky-feelings",
          text: "Feels like:\n• Sun on eyelids\n• Laughing in kitchens\n• Music louder than fear",
          color: "#FFF0B5",
          fontSize: 16,
          bold: false,
          x: 350,
          y: 160,
          rotation: -2,
        },
        {
          id: "sticky-reminders",
          text: "Reminders\n□ Share process openly\n□ Invite collaboration\n□ Keep it playful",
          color: "#FFE1FF",
          fontSize: 15,
          bold: false,
          x: 120,
          y: 240,
          rotation: 4,
        },
      ],
    }),
  },
  // {
  //   id: "professional-briefing",
  //   category: "professional",
  //   variant: "image",
  //   title: "Weekly Briefing",
  //   subtitle: "Align, plan, execute",
  //   coverImage: getCoverImage(4),
  //   titleColor: "#1f2940",
  //   subtitleColor: "#46526d",
  //   canvas: createSnapshot({
  //     theme: "tone3",
  //     background: {
  //       pattern:
  //         "linear-gradient(90deg, rgba(49,60,94,.08) 1px, transparent 1px), linear-gradient(180deg, rgba(49,60,94,.08) 1px, transparent 1px)",
  //     },
  //     textElements: [
  //       {
  //         id: "text-briefing",
  //         text: "Weekly Briefing",
  //         fontSize: 32,
  //         fontFamily: "var(--font-manrope)",
  //         bold: true,
  //         italic: false,
  //         align: "left",
  //         curve: false,
  //         x: 80,
  //         y: 70,
  //         rotation: 0,
  //         isEditing: false,
  //       },
  //       {
  //         id: "text-week",
  //         text: "Week of ____",
  //         fontSize: 20,
  //         fontFamily: "var(--font-manrope)",
  //         bold: false,
  //         italic: false,
  //         align: "left",
  //         curve: false,
  //         x: 82,
  //         y: 112,
  //         rotation: 0,
  //         isEditing: false,
  //       },
  //     ],
  //     stickyNotes: [
  //       {
  //         id: "sticky-objectives",
  //         text: "Objectives\n1. Launch beta to 25 customers\n2. Close analytics backlog\n3. Prep Q3 roadmap share-out",
  //         color: "#E3ECFF",
  //         fontSize: 15,
  //         bold: false,
  //         x: 340,
  //         y: 160,
  //         rotation: 1,
  //       },
  //       {
  //         id: "sticky-metrics",
  //         text: "Metrics watchlist\n• Activation ↑\n• Support backlog ↓\n• NPS ≥ 45",
  //         color: "#F4F7FA",
  //         fontSize: 15,
  //         bold: true,
  //         x: 120,
  //         y: 220,
  //         rotation: -3,
  //       },
  //     ],
  //   }),
  // },
  // {
  //   id: "professional-roadmap",
  //   category: "professional",
  //   variant: "solid",
  //   title: "Roadmap Snapshot",
  //   subtitle: "What, why, when",
  //   coverImage: null,
  //   titleColor: "#1d3150",
  //   subtitleColor: "#4a5c7a",
  //   canvas: createSnapshot({
  //     theme: "tone3",
  //     background: { color: "#f5f8fb" },
  //     textElements: [
  //       {
  //         id: "text-roadmap",
  //         text: "Roadmap Snapshot",
  //         fontSize: 30,
  //         fontFamily: "var(--font-manrope)",
  //         bold: true,
  //         italic: false,
  //         align: "left",
  //         curve: false,
  //         x: 92,
  //         y: 78,
  //         rotation: 0,
  //         isEditing: false,
  //       },
  //     ],
  //     stickyNotes: [
  //       {
  //         id: "sticky-now",
  //         text: "Now\n- Validate onboarding\n- Ship usage dashboard",
  //         color: "#D9E7FF",
  //         fontSize: 15,
  //         bold: false,
  //         x: 120,
  //         y: 180,
  //         rotation: -5,
  //       },
  //       {
  //         id: "sticky-next",
  //         text: "Next\n- Launch integrations\n- Customer story series",
  //         color: "#FFF4CD",
  //         fontSize: 15,
  //         bold: false,
  //         x: 320,
  //         y: 240,
  //         rotation: 4,
  //       },
  //     ],
  //   }),
  // },
  // {
  //   id: "playful-sketchpad",
  //   category: "playful",
  //   variant: "solid",
  //   title: "Idea Sketchpad",
  //   subtitle: "Let it be messy",
  //   coverImage: null,
  //   titleColor: "#2c2a5e",
  //   subtitleColor: "#5a57a1",
  //   canvas: createSnapshot({
  //     theme: "tone4",
  //     background: { color: "#fdf1ff" },
  //     textElements: [
  //       {
  //         id: "text-sketchpad",
  //         text: "Idea Sketchpad",
  //         fontSize: 32,
  //         fontFamily: "var(--font-gochi)",
  //         bold: false,
  //         italic: false,
  //         align: "center",
  //         curve: false,
  //         x: 210,
  //         y: 70,
  //         rotation: 0,
  //         isEditing: false,
  //       },
  //     ],
  //     stickyNotes: [
  //       {
  //         id: "sticky-doodles",
  //         text: "Doodles to try:\n• Tiny comic frames\n• Character silhouettes\n• Animated arrows",
  //         color: "#FFF0C7",
  //         fontSize: 16,
  //         bold: false,
  //         x: 120,
  //         y: 180,
  //         rotation: -8,
  //       },
  //       {
  //         id: "sticky-remix",
  //         text: "Remix cues\n- Mix textures\n- Oversized typography\n- Unexpected color pair",
  //         color: "#FFDFED",
  //         fontSize: 15,
  //         bold: false,
  //         x: 360,
  //         y: 240,
  //         rotation: 6,
  //       },
  //     ],
  //   }),
  // },
  // {
  //   id: "playful-memory-collage",
  //   category: "playful",
  //   variant: "image",
  //   title: "Memory Collage",
  //   subtitle: "Moments worth pinning",
  //   coverImage: getCoverImage(7),
  //   titleColor: "#40275d",
  //   subtitleColor: "#6b4a8c",
  //   canvas: createSnapshot({
  //     theme: "tone4",
  //     background: {
  //       image: "linear-gradient(140deg, #fff0f8 0%, #e9f3ff 100%)",
  //     },
  //     textElements: [
  //       {
  //         id: "text-memory-collage",
  //         text: "Memory Collage",
  //         fontSize: 30,
  //         fontFamily: "var(--font-manrope)",
  //         bold: true,
  //         italic: false,
  //         align: "left",
  //         curve: false,
  //         x: 92,
  //         y: 76,
  //         rotation: 0,
  //         isEditing: false,
  //       },
  //     ],
  //     stickyNotes: [
  //       {
  //         id: "sticky-soundtrack",
  //         text: "Soundtrack\n♪ Electric Bloom\n♪ Golden Hour\n♪ Lofi Drive",
  //         color: "#E8F6FF",
  //         fontSize: 15,
  //         bold: false,
  //         x: 120,
  //         y: 180,
  //         rotation: -4,
  //       },
  //       {
  //         id: "sticky-polaroid",
  //         text: "Add photos:\n- City nights\n- Laughing snapshots\n- Coffee corners",
  //         color: "#FFE3FF",
  //         fontSize: 15,
  //         bold: false,
  //         x: 340,
  //         y: 250,
  //         rotation: 3,
  //       },
  //     ],
  //   }),
  // },
];

const cloneCanvas = (
  snapshot: TemplateCanvasSnapshot
): TemplateCanvasSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as TemplateCanvasSnapshot;

export const starterBookTemplates: BookTemplate[] = templates;

export function getTemplateById(id: string): BookTemplate | null {
  const template = starterBookTemplates.find((item) => item.id === id);
  if (!template) return null;
  return {
    ...template,
    canvas: cloneCanvas(template.canvas),
  };
}

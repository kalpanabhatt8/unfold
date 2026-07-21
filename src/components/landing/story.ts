/** Shared narrative for the three concept landing pages.
 * Voice matches product: observational, no diagnosis, no coaching.
 */

export type Moment = {
  id: string;
  quote: string;
  date: string;
  dayPart: string;
  entryTitle: string;
  /** Rough placement for canvas / workspace layouts (percent of viewport). */
  x: number;
  y: number;
  rotate: number;
};

export const BRAND = "UNFOLD";

/** Hero line above the living canvas — fades as the frame rises. */
export const TAGLINE = "Discover patterns in your thoughts.";

export const MOMENTS: Moment[] = [
  {
    id: "m1",
    quote: "I'll start after lunch.",
    date: "Mar 4",
    dayPart: "afternoon",
    entryTitle: "After Lunch",
    x: 12,
    y: 18,
    rotate: -2.5,
  },
  {
    id: "m2",
    quote: "Just one more tutorial.",
    date: "Mar 11",
    dayPart: "evening",
    entryTitle: "One More Tutorial",
    x: 68,
    y: 14,
    rotate: 1.8,
  },
  {
    id: "m3",
    quote: "Tomorrow feels easier.",
    date: "Mar 18",
    dayPart: "night",
    entryTitle: "Tomorrow Instead",
    x: 22,
    y: 58,
    rotate: 1.2,
  },
  {
    id: "m4",
    quote: "I cleaned everything before beginning.",
    date: "Mar 22",
    dayPart: "morning",
    entryTitle: "Cleaned Everything",
    x: 72,
    y: 52,
    rotate: -1.4,
  },
  {
    id: "m5",
    quote: "I changed the spacing again.",
    date: "Mar 29",
    dayPart: "evening",
    entryTitle: "Spacing Again",
    x: 48,
    y: 72,
    rotate: 0.6,
  },
];

/** Living canvas screen 2 — pattern-quote cards (dummy dates / entry names). */
export const LIVE_SCREEN2_CARDS = [
  {
    quote: "One moment rarely tells the whole story.",
    date: "Mar 4",
    entryTitle: "Before the Real Work",
  },
  {
    quote: "Over time, moments begin echoing across your journal.",
    date: "Mar 11",
    entryTitle: "Rearranging Everything",
  },
  {
    quote: "Not because they use the same words.",
    date: "Mar 18",
    entryTitle: "Almost Started",
  },
  {
    quote: "Because they keep returning in different ways.",
    date: "Mar 22",
    entryTitle: "Kept It Light",
  },
  {
    quote: "Individually, they're easy to overlook.",
    date: "Mar 29",
    entryTitle: "Left Unsaid",
  },
  {
    quote: "Together, they start to say something.",
    date: "Apr 2",
    entryTitle: "What's Easy to Miss",
  },
] as const;

export const WRITE_NATURALLY = {
  /** Canvas title placeholder — not a real entry title. */
  titlePlaceholder: "New book",
  /** Title applied when the entry is sealed. */
  sealedTitle: "How it works?",
  paragraphs: [
    "You already know how you feel.",
    "What's harder to notice\nis how your thoughts repeat over time.",
    "Unfold doesn't just tag your emotions.\nIt helps you notice the patterns behind it.",
    "Built for people who overthink.\nUnderstand your patterns, not just your thoughts.",
  ],
};

export const PATTERN = {
  title: "See Together.",
  label: "",
  evidenceLabel: "Connecting the moments",
  loops: [
    "The moments were already there.",
    "Scattered quietly across your days.",
    "Until they started to tell a story.",
  ],
  reflection: "What would it mean to leave it as it is?",
  closingQuestion: "Ready to see yours?",
};

export const JOURNAL_ENTRY_A = {
  title: "Before the Real Work",
  date: "March 4 · evening",
  paragraphs: [
    "Sat down to write the proposal. Cleared the desk first. Then the desktop. Then the downloads folder.",
    "By the time the surface was clean, the evening was gone.",
    "I told myself it was necessary. That starting on a messy desk never works.",
  ],
};

export const JOURNAL_ENTRY_B = {
  title: "Almost Started",
  date: "March 18 · night",
  paragraphs: [
    "Opened the draft again. Read the first paragraph twice.",
    "Almost done, really. Just need to reorganize the folders so I can find the research.",
    "Closed the laptop feeling productive. Nothing new on the page.",
  ],
};

export const CTA = {
  primary: "Get started",
  href: "/sign-in",
  whisper: "Your writing stays yours.",
  header: {
    primary: "Get started",
    primaryHref: "/sign-in",
  },
};

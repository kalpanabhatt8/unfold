/** Shared narrative for the living-canvas landing.
 * Voice matches product: observational, no diagnosis, no coaching.
 */

export const BRAND = "UNFOLD";

/** Hero line above the living canvas — fades as the frame rises. */
export const TAGLINE = "Discover patterns in your thoughts.";

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
  evidenceLabel: "Connecting the moments",
  loops: [
    "The moments were already there.",
    "Scattered quietly across your days.",
    "Until they started to tell a story.",
  ],
  closingQuestion: "Start your first entry.",
};

export const CTA = {
  primary: "Get started",
  href: "/sign-up",
  whisper: "Your writing stays yours.",
  header: {
    signIn: "Sign In",
    signInHref: "/sign-in",
    primary: "Get started",
    primaryHref: "/sign-up",
  },
};

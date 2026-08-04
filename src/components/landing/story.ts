/** Shared narrative for the living-canvas landing.
 * Voice matches product: observational, no diagnosis, no coaching.
 */

export const BRAND = "UNFOLD";

/** Hero line above the living canvas - fades as the frame rises. */
export const TAGLINE = "Discover patterns in your thoughts.";

/** Living canvas screen 2 - pattern-quote cards (dummy dates / entry names). */
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
  /** Canvas title placeholder - not a real entry title. */
  titlePlaceholder: "New book",
  /** Title applied when the entry is sealed. */
  sealedTitle: "How it works?",
  paragraphs: [
    "You write down what's on your mind.\nJust like a diary.",
    "Over time, Unfold starts noticing things you might not \na worry that keeps showing up, a moment you keep coming back to.",
    "It doesn't tell you what to do about it.\nIt just shows you what was already there, in your own words.",
    "Built for overthinkers and people who want to see their own patterns.",
  ],
};

export const PATTERN = {
  title: "See Together.",
  evidenceLabel: "",
  loops: [
    "The moments were already there.",
    "Scattered quietly across your days.",
    "Until they started to tell a story.",
  ],
  closingQuestion: "",
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

/** Soft closer under the living-canvas CTA - left note, right social. */
export const LANDING_FOOTER = {
  note: "Unfold is in its early days. more to come :)",
  x: {
    label: "@unfoldpattern",
    /** Paste the account URL when ready. */
    href: "https://x.com/unfoldpattern",
  },
};

/** Secondary link in the canvas - opens the in-canvas example pattern.
 * Parked with the See an example / pattern preview feature.
export const SEE_EXAMPLE = {
  label: "See an example →",
  backLabel: "← Back",
};

export const EXAMPLE_PATTERN = {
  caption:
    "Once a few entries share something in common, Unfold shows you the shape of it. Here's an example.",
  title: "Their Comfort First?",
  factLine: "23 Jul · Spotted in 5 moments",
  moments: [
    {
      entryTitle: "Third Week In a Row",
      date: "23 Jul",
      quote: "just not saying anything about it",
    },
    {
      entryTitle: "Couldn't Say No",
      date: "23 Jul",
      quote:
        'saying "I can\'t right now" felt disproportionately harder than just doing the favor',
    },
    {
      entryTitle: "Said Yes at Midnight",
      date: "23 Jul",
      quote:
        "I said it wasn't a problem, even though it meant working past midnight",
    },
    {
      entryTitle: "The Same Thing Again",
      date: "23 Jul",
      quote:
        "Agreed to be added to a group project at the last minute because someone dropped out",
    },
    {
      entryTitle: "Exhausted Listening",
      date: "23 Jul",
      quote:
        "I listened for over an hour again, even though I was pretty drained already",
    },
    {
      entryTitle: "Kept Nodding",
      date: "23 Jul",
      quote:
        "I didn't say I was tired. I just kept nodding along on the call.",
    },
  ],
  loops: [
    "Someone asked for help or time.",
    "Saying no felt harder than just doing it.",
    "So the yes came out instead.",
    "Then the next ask arrived, and the same weight showed up again.",
  ],
  closingQuestion:
    "When the ask lands, what happens in the space before the yes comes out?",
} as const;
*/


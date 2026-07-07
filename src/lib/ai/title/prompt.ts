import {
  MAX_TITLE_CHARS,
  MAX_TITLE_WORDS,
} from "@/lib/ai/title/constants";

const PAGE_NAMING_SYSTEM_PROMPT = `You name pages in a personal journal.

These are not article titles, summaries, morals, or emotional labels. They are memory anchors — short names that help the person who wrote this entry recognize it months later, the way they'd flip to a page in a notebook and know instantly which one it is.

Your job has two steps. Do both, but only output the final result.

STEP 1 (internal, do not output):
Read the entry and find the single most memorable anchor — one specific moment, image, action, phrase, or unresolved thought that appears in the writing. Something concrete enough that future-you would think "oh, that entry" when seeing the page name.

Good anchors:
- a specific thing the person did ("reorganizing folders," "kept it light")
- a specific thing left unsaid or undone ("never told them," "almost started")
- a striking phrase or image from their own words
- an unfinished or unresolved thought still hanging in the entry

Do NOT anchor on:
- the overall feeling (anxiety, exhaustion, hope)
- the lesson or takeaway (growth, letting go, moving on)
- a coping strategy or theme label (trying anyway, staying busy, still thinking)

Ask yourself: could this page name belong to hundreds of different journal entries? If yes, you picked the wrong anchor.

STEP 2 (output):
Compress that anchor into a page name of 2–5 words.

The name should feel like something the journal owner would naturally write on the page — not something an AI produced after analyzing the entry.

Rules:
- Name the memory, not the meaning.
- Prefer page names inspired by the writer's own language, tone, or memorable phrases. Rewrite or compress them when necessary so the result feels like a natural page name — not a copied sentence.
- Never resolve the entry's tension. If the person is conflicted, avoided, or unsure, the page name should preserve that — not conclude it.
- Prefer a noun, a fragment, an unfinished thought, or a small contradiction over a complete, resolved sentence.
- Avoid generic self-help or emotional-summary page names. Words like "still," "thinking," or "anyway" are fine when they name something specific — they are warning signs only when the result could fit many unrelated entries.
- Never use obvious self-help or AI vocabulary: healing, growth, journey, mindful, awareness, embracing, becoming, moving forward, self-discovery.
- Do not use adjectives that name an emotion directly (e.g. "sad," "anxious," "hopeful," "overwhelmed").
- Page names do not need Title Case. A question mark or trailing-off is fine if it matches the entry.

Contrastive examples (do not copy — calibration only):

Entry: "I kept everything light and easy. I never told them what had actually been happening."
  Weak: Trying Anyway — names resilience, not the moment. Could be any hard conversation entry.
  Weak: Still Thinking — emotional summary. Says nothing about what happened.
  Better: Left Unsaid — points at the specific withheld truth.
  Better: Kept It Light — inspired by the writer's own phrase, compressed into a page name.
  Better: What I Didn't Say — names the unresolved act, not the feeling.
  Not: I kept everything light and easy. — copied from the entry, not a page name.

Entry: "I spent an hour reorganizing folders instead of actually designing."
  Weak: Just Busy — theme label. Could describe any avoidance entry.
  Weak: Moving Forward — generic self-help. Resolves tension the entry doesn't resolve.
  Better: Before the Real Work — names the specific stall, not the mood.
  Better: Almost Started — captures the near-miss without summarizing.
  Better: Rearranging Everything — points at the actual behavior.

More target-style page names (calibration only):
Hard to Say / Carrying Too Much / Wrong Day / Tuesday? / The Folder Hour / Never Sent It`;

function formatPageNamingUserInput(text: string): string {
  return `Name this journal page.

Entry:
"""
${text}
"""

Return only the page name. No quotation marks, no explanation.`;
}

export function buildTitlePrompt(text: string): string {
  return `${PAGE_NAMING_SYSTEM_PROMPT}

${formatPageNamingUserInput(text)}`;
}

const RETRY_COACHING: Record<string, string> = {
  summary_voice:
    "Your previous page name summarized the lesson or emotion instead of naming a specific memory. Go back to the journal and identify one concrete moment, image, action, phrase, or unresolved thought that future-you would immediately recognize. Use that as the page name.",
  generic_page_name:
    "Your previous page name was too generic — it could belong to hundreds of different journal entries. Go back to the journal and find one specific moment, action, phrase, or unresolved thought that only this entry contains. Name the page from that anchor.",
  banned_vocabulary:
    "Your previous page name used generic self-help or AI vocabulary instead of naming a specific memory. Go back to the journal, find one concrete anchor in the writer's own words, and compress it into a natural page name.",
  repeats_opening:
    "Your previous page name copied phrasing from the entry instead of compressing it into a page name. Find the memorable anchor, then rewrite or shorten it so it feels like something the writer would jot on the page — inspired by their language, not lifted from it.",
  generic_single_word:
    "Your previous page name was a generic one-word label. Find a more specific anchor in the entry and compress it into a 2–5 word page name.",
};

function retryCoachingFor(reason: string): string {
  return (
    RETRY_COACHING[reason] ??
    "Your previous page name missed the mark. Go back to the journal, find one concrete anchor, and name the page from that — not from the overall feeling or lesson."
  );
}

export function buildTitleRetryPrompt(
  text: string,
  rejectionReason: string,
  rejectedTitle?: string,
): string {
  const rejectedLine = rejectedTitle
    ? `Your previous page name "${rejectedTitle}" was rejected.`
    : "Your previous page name was rejected.";

  return `${PAGE_NAMING_SYSTEM_PROMPT}

${rejectedLine}
${retryCoachingFor(rejectionReason)}

Follow the same two-step process. Output only the final page name.

${formatPageNamingUserInput(text)}`;
}

export const TITLE_REJECTION_MESSAGES: Record<string, string> = {
  empty: "The page name was empty.",
  parsing_error: "The response was not a clean single page name.",
  too_long: `The page name exceeded ${MAX_TITLE_WORDS} words.`,
  too_many_characters: `The page name exceeded ${MAX_TITLE_CHARS} characters.`,
  generic_single_word:
    "The page name was a generic one-word label, not a specific memory anchor.",
  banned_vocabulary:
    "The page name used obvious self-help or AI vocabulary instead of a concrete memory.",
  generic_page_name:
    "The page name was generic enough that it could apply to many different journal entries.",
  summary_voice:
    "The page name summarized the theme or emotion instead of naming a specific memory.",
  repeats_opening:
    "The page name copied phrasing from the entry instead of compressing it into a page name.",
};

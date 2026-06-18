/** Fixed copy for the very first canvas open. */
export const FIRST_VISIT_GREETING = "Heyy!! Nice to meet you";

/** Fixed copy for the second canvas open. */
export const SECOND_VISIT_GREETING = "Hey! You're back — I missed you";

/** Pool for first-time users (visit 3+ still uses {@link RETURNING_GREETINGS}). */

export const FIRST_TIME_GREETINGS = [
  "Ayo, hi :)",
  "Oh, hey!",
  "You made it :D",
  "Hey, nice",
  "Well, hi :)",
  "Hey there",
] as const;

/** Pool for returning users (visit 3 and onward). */
export const RETURNING_GREETINGS = [
  "Oh, hi :)",
  "Hi again",
  "You're back :D",
  "There you are",
  "Back already?!",
  "We meet again :)",
  "Look who's here",
  "Fancy seeing you :D",
] as const;

const VISIT_COUNT_KEY = "keeps-canvas-visit-count";
const LAST_GREETING_KEY = "keeps-canvas-last-greeting";

function pickRandom(pool: readonly string[], avoid?: string | null): string {
  const candidates = avoid ? pool.filter((line) => line !== avoid) : [...pool];
  const list = candidates.length > 0 ? candidates : [...pool];
  return list[Math.floor(Math.random() * list.length)]!;
}

/**
 * Picks the peek greeting for this canvas open and bumps the persisted visit count.
 * Call once per entrance, on the client only.
 */
export function pickEntranceGreeting(): string {
  if (typeof window === "undefined") return FIRST_VISIT_GREETING;

  const prevCount = Number(window.localStorage.getItem(VISIT_COUNT_KEY) ?? "0");
  const visitCount = prevCount + 1;
  window.localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

  if (visitCount === 1) return FIRST_VISIT_GREETING;
  if (visitCount === 2) return SECOND_VISIT_GREETING;

  const last = window.localStorage.getItem(LAST_GREETING_KEY);
  const greeting = pickRandom(RETURNING_GREETINGS, last);
  window.localStorage.setItem(LAST_GREETING_KEY, greeting);
  return greeting;
}

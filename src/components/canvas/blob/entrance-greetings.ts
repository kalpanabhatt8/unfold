/** Pool for the first time a user opens a specific book. */
export const FIRST_TIME_GREETINGS = [
  "Ayo, hi :)",
  "Oh, hey!",
  "You made it :D",
  "Hey, nice",
  "Well, hi :)",
  "Hey, there!",
] as const;

/** Pool when the user opens the same book again. */
export const RETURNING_GREETINGS = [
  "Oh, hi :)",
  "Hi again!",
  "You're back :D",
  "There you are",
  "Back already?!",
  "We meet again :)",
  "Look who's here",
  "Fancy seeing you :D",
] as const;

const OPENED_BOOKS_KEY = "keeps-canvas-opened-books";
const LAST_GREETING_KEY = "keeps-canvas-last-greeting-by-book";

function pickRandom(pool: readonly string[], avoid?: string | null): string {
  const candidates = avoid ? pool.filter((line) => line !== avoid) : [...pool];
  const list = candidates.length > 0 ? candidates : [...pool];
  return list[Math.floor(Math.random() * list.length)]!;
}

function readOpenedBooks(): Set<string> {
  try {
    const raw = window.localStorage.getItem(OPENED_BOOKS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markBookOpened(bookId: string) {
  const opened = readOpenedBooks();
  opened.add(bookId);
  window.localStorage.setItem(OPENED_BOOKS_KEY, JSON.stringify([...opened]));
}

function readLastGreeting(bookId: string): string | null {
  try {
    const raw = window.localStorage.getItem(LAST_GREETING_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[bookId] ?? null;
  } catch {
    return null;
  }
}

function writeLastGreeting(bookId: string, greeting: string) {
  try {
    const raw = window.localStorage.getItem(LAST_GREETING_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[bookId] = greeting;
    window.localStorage.setItem(LAST_GREETING_KEY, JSON.stringify(map));
  } catch {
    // ignore storage failures
  }
}

/**
 * Picks the peek greeting for this canvas open.
 * First open of a book uses {@link FIRST_TIME_GREETINGS}; later opens use
 * {@link RETURNING_GREETINGS}. Call once per entrance, on the client only.
 */
export function pickEntranceGreeting(bookId: string): string {
  if (typeof window === "undefined") return FIRST_TIME_GREETINGS[0];

  const isReturning = readOpenedBooks().has(bookId);
  const pool = isReturning ? RETURNING_GREETINGS : FIRST_TIME_GREETINGS;
  const greeting = pickRandom(pool, isReturning ? readLastGreeting(bookId) : null);

  if (isReturning) {
    writeLastGreeting(bookId, greeting);
  } else {
    markBookOpened(bookId);
  }

  return greeting;
}

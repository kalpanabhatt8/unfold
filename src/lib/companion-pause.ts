/** Pause required before emotion analysis (trigger path A). */
export const COMPANION_PAUSE_TRIGGER_MS = 7_000;
/** Milestone save fires after this many ms of typing inactivity. */
export const COMPANION_PAUSE_REFLECTING_MS = 7_000;
/** New words since delta baseline + pause (trigger path A). */
export const COMPANION_MIN_NEW_WORDS_FOR_EMOTION = 3;
/** Whole-canvas pause classify when total words are at or below this (short entries). */
export const COMPANION_SHORT_ENTRY_MAX_WORDS = 10;
/** New words since last analysis — fires without pause (trigger path B). */
export const COMPANION_LONG_WRITING_WORD_THRESHOLD = 40;
/** After this many ms of typing inactivity, return emotion to neutral. */
export const COMPANION_INACTIVITY_NEUTRAL_MS = 180_000;
/** Resumed draft (unsealed, existing text): analyze the canvas this soon after open. */
export const COMPANION_INITIAL_ANALYSIS_MS = 500;
/** Interval for pause / long-writing trigger poll. */
export const COMPANION_POLL_INTERVAL_MS = 1_000;
/** Max words sent to the classifier (last 100–150 word tail). */
export const COMPANION_CLASSIFY_WORD_CAP = 150;
/** Wait until deleting stops for this long before re-classifying. */
export const COMPANION_DELETION_DEBOUNCE_MS = 2_000;
/** Min words deleted since last analysis to re-classify on deletion. */
export const COMPANION_DELETION_REANALYZE_WORDS = 15;
/** Cross-valence face transition duration. */
export const COMPANION_EMOTION_TRANSITION_MS = 400;
/** No canvas activity this long → sunflower sleep animation. */
export const SLEEP_CANVAS_IDLE_MS = 4.5 * 60 * 1000;
/** Unsealed draft with content idle this long → prompt to seal on next open. */
export const UNFINISHED_DRAFT_PROMPT_MS = 24 * 60 * 60 * 1000;

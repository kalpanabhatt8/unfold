"use client";

/**
 * BlobCharacter — sunflower companion for the writing canvas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  HOW THIS FILE IS ORGANISED (read top-to-bottom)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  1. COLORS            → palette pulled from your figma assets.
 *  2. SVG PATHS         → raw path data from /public/Images/character/*.svg.
 *  3. LAYOUT NUMBERS    → where eyes / mouth / leaves / blush sit on the face.
 *  4. STATES MAP        → the single source of truth for every state.
 *                          One row per state. Edit a value here to customise
 *                          how that state looks/animates. Nothing else.
 *  5. RENDER HELPERS    → simple switch-functions that turn a config string
 *                          like "open-blink" into an actual SVG element.
 *  6. <BlobCharacter />  → puts it all together (no `if state===` branches).
 *  7. CSS (styled-jsx)  → animations, grouped by what they affect.
 *  8. useBlobState()    → hook that flips between states from typing/save events.
 *
 *  TO CUSTOMISE A STATE:
 *    Go to the STATES map (section 4) and change a value, e.g. change
 *    `idle.mouth` from "slight-smile" to "big-smile". That's it — no other
 *    edits needed. To create a new eye/mouth/leaf style, add a `case` in
 *    the matching render helper (section 5) and reference its name in STATES.
 *
 *  TO MOVE A FEATURE ON THE FACE (eyes, mouth, blush, leaves):
 *    Edit the constants in section 3 — those are the only positioning values.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import clsx from "clsx";
import { COMPANION_EMOTIONS, type CompanionEmotion } from "@/lib/companion-ai";

/* ════════════════════════════════════════════════════════════════════════════
 *  PUBLIC API (don't rename — used by canvas-board.tsx and /dev/blob)
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Behavioural states (idle/typing/etc.) plus the 8 emotion-reaction states,
 * which are exactly the {@link CompanionEmotion} values. Every emotion below
 * must have a matching row in the STATES map.
 */
export type BlobState =
  | "idle"
  | "typing"
  | "sleeping"
  | "waking"
  | "saving"
  | "greeting"
  // Spec states C / E / D / H — quiet presence reactions:
  | "waiting" // blank page: soft glow nudge after a few idle seconds
  | "pause" // gentle acknowledgment when typing briefly stops
  | "bloom" // word-milestone growth pop (writing nourishes the flower)
  | "completion" // finished: full bloom + raised leaves (high-five ready)
  | CompanionEmotion;

export type { CompanionEmotion };

/**
 * Persistent growth level — the core product metaphor (words = water).
 * Climbs as the writer crosses word milestones and stays put for the session:
 *   0 = bud · 1 = ~50 words · 2 = ~100 words · 3 = ~200 words (full bloom).
 */
export type BloomLevel = 0 | 1 | 2 | 3;

export type BlobCharacterProps = {
  state: BlobState;
  /** Visual size in px. Renders inside a 60×60 viewBox; leaves bleed below. */
  size?: number;
  className?: string;
  /** Hide entirely without unmounting (smooth state transitions). */
  hidden?: boolean;
  /** Called when the user hovers the character while it is sleeping. */
  onWakeUp?: () => void;
  /**
   * Persistent bloom growth (0–3). Scales the petal ring + warm glow so the
   * flower visibly grows as the writer adds words. Independent of `state`.
   */
  bloomLevel?: BloomLevel;
  /** Slide-in from the left for the entrance (State A). Pair with `greeting`. */
  entering?: boolean;
  /**
   * Called when the user taps the flower during `completion` — the one and
   * only major direct interaction (the high-five). Fires at most once per
   * completion window.
   */
  onHighFive?: () => void;
  /** Dev only: draw face center + feature-block guides to check Y alignment. */
  debugLayout?: boolean;
};

/* ════════════════════════════════════════════════════════════════════════════
 *  1. COLORS
 * ════════════════════════════════════════════════════════════════════════════ */

const INK = "#68462A";
const CLOSED_EYE_INK = "#4A3528";
const BLUSH = "#FEE1B2";
const HIGHLIGHT = "#FFFFFF";
const SPARKLE = "#F0B654";
const ZZZ = "#68462A"; // sleeping-sign-zzz.svg
const HEART = "#E8788A"; // soft pink heart for gentle acknowledgments
const GLOW = "#FFD27A"; // warm radial glow that grows with the bloom

/* ════════════════════════════════════════════════════════════════════════════
 *  2. SVG PATHS — copied verbatim from /public/Images/character/*.svg
 *     Each path lives in its own local coordinate system; the renderer
 *     translates+scales it into the master 60×60 viewBox.
 * ════════════════════════════════════════════════════════════════════════════ */

// face.svg  (32 × 32 viewBox, path 31.4213 × 31.4213) — cream disc + radial fill
const FACE_PATH =
  "M0 15.7106C0 7.03389 7.03389 0 15.7106 0V0C24.3874 0 31.4213 7.03389 31.4213 15.7106V15.7106C31.4213 24.3874 24.3874 31.4213 15.7106 31.4213V31.4213C7.03389 31.4213 0 24.3874 0 15.7106V15.7106Z";
const FACE_GRAD_TRANSFORM =
  "translate(15.7106 15.7106) rotate(90) scale(17.6639)";

// sunflower-leaf.svg  (50 × 50) — yellow scalloped petal ring + radial fill
const SUNFLOWER_PATH =
  "M22.0958 1.85106C23.8609 0.0618517 26.6163 -0.54403 29.0479 0.538558C30.1412 1.02532 31.0236 1.79014 31.6515 2.71141C33.9968 1.7815 36.7735 2.34667 38.5606 4.33153C39.3617 5.22122 39.8571 6.27903 40.0558 7.37645C42.5767 7.48076 44.8837 9.12622 45.7091 11.6665C46.079 12.8051 46.1009 13.9728 45.836 15.0561C48.0965 16.1768 49.5351 18.6176 49.256 21.2739C49.1307 22.4648 48.6751 23.5403 47.9923 24.4223C49.6016 26.3656 49.9235 29.1805 48.588 31.4936C47.9892 32.5307 47.1351 33.3279 46.1524 33.8559C46.8324 36.2858 45.9814 38.988 43.8204 40.5581C42.8518 41.2617 41.748 41.6432 40.6358 41.7261C40.2684 44.2221 38.3928 46.3445 35.7804 46.8999C34.6086 47.1489 33.4439 47.0486 32.3936 46.6714C31.0428 48.8022 28.4661 49.9776 25.8536 49.4223C24.6823 49.1733 23.6595 48.6088 22.8536 47.8374C20.7529 49.2345 17.9206 49.2607 15.7599 47.6909C14.7909 46.9869 14.0856 46.0547 13.6632 45.022C11.1761 45.4433 8.57846 44.3151 7.24326 42.0024C6.64457 40.9654 6.38016 39.8274 6.41415 38.7124C3.97039 38.086 2.05668 35.9983 1.77744 33.3423C1.65226 32.1513 1.87193 31.0034 2.35654 29.9985C0.379272 28.4322 -0.519445 25.7462 0.305756 23.2065C0.675673 22.0681 1.34352 21.1099 2.19443 20.3891C1.02481 18.154 1.29616 15.3348 3.0831 13.3501C3.88435 12.4602 4.88428 11.8557 5.95517 11.5434C5.79611 9.02609 7.19065 6.56132 9.62998 5.47508C10.7147 4.99213 11.8641 4.84463 12.961 4.98875C13.8342 2.60778 16.1222 0.909679 18.8058 0.909652C20.0141 0.909652 21.1412 1.25502 22.0958 1.85106Z";
const PETAL_GRAD_TRANSFORM =
  "translate(24.7105 24.7797) rotate(90) scale(38.146 38.0396)";

// leaf-left.svg  (22 × 23) — stem-tip at upper-right (~19, 5)
const LEAF_LEFT_PATH =
  "M2.8855 13.975L7.57314 15.5213C12.6422 17.1933 18.0333 14.061 19.0912 8.82918L18.9881 8.52462C14.9369 4.86856 8.59143 5.62462 5.51273 10.1302L2.8855 13.975Z";
const LEAF_LEFT_GRAD_TRANSFORM =
  "translate(9.0502 13.6087) rotate(-26.9845) scale(21.5338 21.5338)";

// leaf-right.svg  (22 × 23) — stem-tip at upper-left (~3, 8.5)
const LEAF_RIGHT_PATH =
  "M18.988 13.975L14.3004 15.5213C9.23136 17.1933 3.84023 14.061 2.78237 8.82918L2.88546 8.52462C6.93661 4.86856 13.2821 5.62462 16.3608 10.1302L18.988 13.975Z";
const LEAF_RIGHT_GRAD_TRANSFORM =
  "translate(12.8233 13.6087) rotate(-153.016) scale(21.5338 21.5338)";

// eye-left.svg / eye-right.svg  (2 × 3 viewBox) — open oval
const OPEN_EYE_LEFT_PATH =
  "M1.93922 1.19201C1.93922 1.81218 1.49407 2.24583 0.9625 2.24583C0.430926 2.24583 0 1.9352 0 1.31503C0 0.694863 0.430926 0 0.9625 0C1.49407 0 1.93922 0.571836 1.93922 1.19201Z";
const OPEN_EYE_RIGHT_PATH =
  "M0.000231862 1.19201C0.000231862 1.81218 0.445379 2.24583 0.976953 2.24583C1.50853 2.24583 1.93945 1.9352 1.93945 1.31503C1.93945 0.694863 1.50853 0 0.976953 0C0.445379 0 0.000231862 0.571836 0.000231862 1.19201Z";
const OPEN_EYE_W = 1.93922;
const OPEN_EYE_H = 2.24583;
/** Anchor at path center so open ovals sit on the face anchors (not viewBox corner). */
const OPEN_EYE_CX = OPEN_EYE_W / 2;
const OPEN_EYE_CY = OPEN_EYE_H / 2;

// eye-{left,right}-smilling.svg  (3 × 1 viewBox) — happy squint curve
const SMILE_EYE_PATH =
  "M2.19632 0.791925C2.30792 0.873078 2.46469 0.84873 2.54593 0.737238C2.62714 0.62557 2.60194 0.468831 2.49027 0.387628C2.15516 0.144006 1.74253 -4.53414e-05 1.29691 -6.70552e-05C0.851162 -6.70552e-05 0.437745 0.143897 0.102573 0.387628C-0.00883789 0.468893 -0.0332446 0.62567 0.0478851 0.737238C0.12915 0.848648 0.285927 0.873055 0.397494 0.791925C0.650027 0.608382 0.960453 0.499933 1.29691 0.499933C1.63338 0.499955 1.94379 0.608342 2.19632 0.791925Z";

// sleeping-{left,right}-eye.svg  (3 × 1 viewBox) — shallow closed line
const SLEEPING_EYE_PATH =
  "M2.19632 0.0479186C2.30792 -0.0332344 2.46469 -0.00888619 2.54593 0.102606C2.62714 0.214274 2.60194 0.371013 2.49027 0.452215C2.15516 0.695838 1.74253 0.839889 1.29691 0.839911C0.851162 0.839911 0.437745 0.695946 0.102573 0.452215C-0.00883789 0.37095 -0.0332446 0.214173 0.0478851 0.102606C0.12915 -0.0088044 0.285927 -0.0332111 0.397494 0.0479186C0.650027 0.231462 0.960453 0.339911 1.29691 0.339911C1.63338 0.339889 1.94379 0.231502 2.19632 0.0479186Z";

// slight-smile.svg  (viewBox 0 0 4 2) — subtle smile
const SLIGHT_SMILE_PATH =
  "M2.97343 0.107215C3.05213 -0.00613984 3.20768 -0.033878 3.32108 0.0447155C3.43446 0.123433 3.4632 0.278967 3.38456 0.392372C3.01816 0.920088 2.40675 1.26631 1.71464 1.2664C1.02247 1.2664 0.411174 0.920083 0.0447155 0.392372C-0.0340005 0.279 -0.00609231 0.123489 0.107215 0.0447155C0.220587 -0.0340005 0.376098 -0.00609231 0.454872 0.107215C0.731886 0.506189 1.19315 0.766395 1.71464 0.766395C2.23598 0.766308 2.69645 0.506075 2.97343 0.107215Z";

// sleeping-sign-zzz.svg  (5 × 8) — three stacked sleep marks
const ZZZ_PATH_SMALL =
  "M1.42 2.916C1.344 2.926 1.287 2.933 1.249 2.937C1.211 2.939 1.182 2.936 1.162 2.928C1.144 2.92 1.124 2.906 1.102 2.886C1.084 2.87 1.077 2.851 1.081 2.829C1.087 2.807 1.121 2.764 1.183 2.7C1.221 2.654 1.26 2.611 1.3 2.571C1.34 2.529 1.376 2.495 1.408 2.469C1.422 2.457 1.438 2.445 1.456 2.433C1.474 2.419 1.503 2.398 1.543 2.37C1.583 2.342 1.642 2.302 1.72 2.25C1.758 2.22 1.788 2.197 1.81 2.181C1.832 2.165 1.85 2.152 1.864 2.142C1.88 2.13 1.896 2.118 1.912 2.106C1.898 2.104 1.867 2.101 1.819 2.097C1.773 2.093 1.73 2.093 1.69 2.097C1.634 2.097 1.598 2.097 1.582 2.097C1.566 2.095 1.55 2.092 1.534 2.088H1.489C1.479 2.088 1.461 2.084 1.435 2.076C1.409 2.066 1.385 2.054 1.363 2.04C1.341 2.026 1.329 2.012 1.327 1.998C1.327 1.998 1.333 1.995 1.345 1.989C1.357 1.981 1.367 1.973 1.375 1.965C1.391 1.955 1.403 1.947 1.411 1.941C1.421 1.935 1.43 1.936 1.438 1.944C1.438 1.944 1.457 1.944 1.495 1.944C1.533 1.942 1.576 1.94 1.624 1.938C1.74 1.94 1.825 1.944 1.879 1.95C1.935 1.954 1.976 1.962 2.002 1.974C2.03 1.986 2.057 2.004 2.083 2.028C2.115 2.06 2.128 2.091 2.122 2.121C2.116 2.151 2.102 2.178 2.08 2.202C2.072 2.21 2.064 2.219 2.056 2.229C2.05 2.237 2.044 2.241 2.038 2.241C2.038 2.241 2.024 2.25 1.996 2.268C1.968 2.286 1.934 2.308 1.894 2.334C1.856 2.36 1.818 2.384 1.78 2.406C1.744 2.428 1.722 2.444 1.714 2.454C1.7 2.462 1.683 2.473 1.663 2.487C1.643 2.499 1.629 2.509 1.621 2.517C1.615 2.525 1.601 2.539 1.579 2.559C1.559 2.579 1.537 2.597 1.513 2.613C1.495 2.629 1.473 2.649 1.447 2.673C1.423 2.697 1.402 2.718 1.384 2.736C1.366 2.754 1.357 2.763 1.357 2.763C1.357 2.763 1.377 2.761 1.417 2.757C1.457 2.751 1.507 2.746 1.567 2.742C1.627 2.736 1.686 2.735 1.744 2.739C1.838 2.737 1.912 2.735 1.966 2.733C2.022 2.729 2.064 2.728 2.092 2.73C2.122 2.73 2.145 2.734 2.161 2.742C2.175 2.746 2.187 2.754 2.197 2.766C2.209 2.778 2.217 2.791 2.221 2.805C2.227 2.817 2.228 2.826 2.224 2.832C2.216 2.832 2.185 2.835 2.131 2.841C2.077 2.845 2.015 2.849 1.945 2.853C1.853 2.861 1.764 2.871 1.678 2.883C1.592 2.895 1.506 2.906 1.42 2.916Z";
const ZZZ_PATH_MID =
  "M3.32172 4.90167C3.22039 4.91501 3.14439 4.92434 3.09372 4.92967C3.04305 4.93234 3.00439 4.92834 2.97772 4.91767C2.95372 4.90701 2.92705 4.88834 2.89772 4.86167C2.87372 4.84034 2.86439 4.81501 2.86972 4.78567C2.87772 4.75634 2.92305 4.69901 3.00572 4.61367C3.05639 4.55234 3.10839 4.49501 3.16172 4.44167C3.21505 4.38567 3.26305 4.34034 3.30572 4.30567C3.32439 4.28967 3.34572 4.27367 3.36972 4.25767C3.39372 4.23901 3.43239 4.21101 3.48572 4.17367C3.53905 4.13634 3.61772 4.08301 3.72172 4.01367C3.77239 3.97367 3.81239 3.94301 3.84172 3.92167C3.87105 3.90034 3.89505 3.88301 3.91372 3.86967C3.93505 3.85367 3.95639 3.83767 3.97772 3.82167C3.95905 3.81901 3.91772 3.81501 3.85372 3.80967C3.79239 3.80434 3.73505 3.80434 3.68172 3.80967C3.60705 3.80967 3.55905 3.80967 3.53772 3.80967C3.51639 3.80701 3.49505 3.80301 3.47372 3.79767H3.41372C3.40039 3.79767 3.37639 3.79234 3.34172 3.78167C3.30705 3.76834 3.27505 3.75234 3.24572 3.73367C3.21639 3.71501 3.20039 3.69634 3.19772 3.67767C3.19772 3.67767 3.20572 3.67367 3.22172 3.66567C3.23772 3.65501 3.25105 3.64434 3.26172 3.63367C3.28305 3.62034 3.29905 3.60967 3.30972 3.60167C3.32305 3.59367 3.33505 3.59501 3.34572 3.60567C3.34572 3.60567 3.37105 3.60567 3.42172 3.60567C3.47239 3.60301 3.52972 3.60034 3.59372 3.59767C3.74839 3.60034 3.86172 3.60567 3.93372 3.61367C4.00839 3.61901 4.06305 3.62967 4.09772 3.64567C4.13505 3.66167 4.17105 3.68567 4.20572 3.71767C4.24839 3.76034 4.26572 3.80167 4.25772 3.84167C4.24972 3.88167 4.23105 3.91767 4.20172 3.94967C4.19105 3.96034 4.18039 3.97234 4.16972 3.98567C4.16172 3.99634 4.15372 4.00167 4.14572 4.00167C4.14572 4.00167 4.12705 4.01367 4.08972 4.03767C4.05239 4.06167 4.00705 4.09101 3.95372 4.12567C3.90305 4.16034 3.85239 4.19234 3.80172 4.22167C3.75372 4.25101 3.72439 4.27234 3.71372 4.28567C3.69505 4.29634 3.67239 4.31101 3.64572 4.32967C3.61905 4.34567 3.60039 4.35901 3.58972 4.36967C3.58172 4.38034 3.56305 4.39901 3.53372 4.42567C3.50705 4.45234 3.47772 4.47634 3.44572 4.49767C3.42172 4.51901 3.39239 4.54567 3.35772 4.57767C3.32572 4.60967 3.29772 4.63767 3.27372 4.66167C3.24972 4.68567 3.23772 4.69767 3.23772 4.69767C3.23772 4.69767 3.26439 4.69501 3.31772 4.68967C3.37105 4.68167 3.43772 4.67501 3.51772 4.66967C3.59772 4.66167 3.67639 4.66034 3.75372 4.66567C3.87905 4.66301 3.97772 4.66034 4.04972 4.65767C4.12439 4.65234 4.18039 4.65101 4.21772 4.65367C4.25772 4.65367 4.28839 4.65901 4.30972 4.66967C4.32839 4.67501 4.34439 4.68567 4.35772 4.70167C4.37372 4.71767 4.38439 4.73501 4.38972 4.75367C4.39772 4.76967 4.39905 4.78167 4.39372 4.78967C4.38305 4.78967 4.34172 4.79367 4.26972 4.80167C4.19772 4.80701 4.11505 4.81234 4.02172 4.81767C3.89905 4.82834 3.78039 4.84167 3.66572 4.85767C3.55105 4.87367 3.43639 4.88834 3.32172 4.90167Z";
const ZZZ_PATH_LARGE =
  "M0.56 6.888C0.458667 6.90133 0.382667 6.91067 0.332 6.916C0.281333 6.91867 0.242667 6.91467 0.216 6.904C0.192 6.89333 0.165333 6.87467 0.136 6.848C0.112 6.82667 0.102667 6.80133 0.108 6.772C0.116 6.74267 0.161333 6.68533 0.244 6.6C0.294667 6.53867 0.346667 6.48133 0.4 6.428C0.453333 6.372 0.501333 6.32667 0.544 6.292C0.562667 6.276 0.584 6.26 0.608 6.244C0.632 6.22533 0.670667 6.19733 0.724 6.16C0.777333 6.12267 0.856 6.06933 0.96 6C1.01067 5.96 1.05067 5.92933 1.08 5.908C1.10933 5.88667 1.13333 5.86933 1.152 5.856C1.17333 5.84 1.19467 5.824 1.216 5.808C1.19733 5.80533 1.156 5.80133 1.092 5.796C1.03067 5.79067 0.973333 5.79067 0.92 5.796C0.845333 5.796 0.797333 5.796 0.776 5.796C0.754667 5.79333 0.733333 5.78933 0.712 5.784H0.652C0.638667 5.784 0.614667 5.77867 0.58 5.768C0.545333 5.75467 0.513333 5.73867 0.484 5.72C0.454667 5.70133 0.438667 5.68267 0.436 5.664C0.436 5.664 0.444 5.66 0.46 5.652C0.476 5.64133 0.489333 5.63067 0.5 5.62C0.521333 5.60667 0.537333 5.596 0.548 5.588C0.561333 5.58 0.573333 5.58133 0.584 5.592C0.584 5.592 0.609333 5.592 0.66 5.592C0.710667 5.58933 0.768 5.58667 0.832 5.584C0.986667 5.58667 1.1 5.592 1.172 5.6C1.24667 5.60533 1.30133 5.616 1.336 5.632C1.37333 5.648 1.40933 5.672 1.444 5.704C1.48667 5.74667 1.504 5.788 1.496 5.828C1.488 5.868 1.46933 5.904 1.44 5.936C1.42933 5.94667 1.41867 5.95867 1.408 5.972C1.4 5.98267 1.392 5.988 1.384 5.988C1.384 5.988 1.36533 6 1.328 6.024C1.29067 6.048 1.24533 6.07733 1.192 6.112C1.14133 6.14667 1.09067 6.17867 1.04 6.208C0.992 6.23733 0.962667 6.25867 0.952 6.272C0.933333 6.28267 0.910667 6.29733 0.884 6.316C0.857333 6.332 0.838667 6.34533 0.828 6.356C0.82 6.36667 0.801333 6.38533 0.772 6.412C0.745333 6.43867 0.716 6.46267 0.684 6.484C0.66 6.50533 0.630667 6.532 0.596 6.564C0.564 6.596 0.536 6.624 0.512 6.648C0.488 6.672 0.476 6.684 0.476 6.684C0.476 6.684 0.502667 6.68133 0.556 6.676C0.609333 6.668 0.676 6.66133 0.756 6.656C0.836 6.648 0.914667 6.64667 0.992 6.652C1.11733 6.64933 1.216 6.64667 1.288 6.644C1.36267 6.63867 1.41867 6.63733 1.456 6.64C1.496 6.64 1.52667 6.64533 1.548 6.656C1.56667 6.66133 1.58267 6.672 1.596 6.688C1.612 6.704 1.62267 6.72133 1.628 6.74C1.636 6.756 1.63733 6.768 1.632 6.776C1.62133 6.776 1.58 6.78 1.508 6.788C1.436 6.79333 1.35333 6.79867 1.26 6.804C1.13733 6.81467 1.01867 6.828 0.904 6.844C0.789333 6.86 0.674667 6.87467 0.56 6.888Z";

// mouth-smilling.svg  (viewBox 0 0 5 3) — big smile
const BIG_SMILE_PATH =
  "M0 0.25C0 0.111929 0.111929 0 0.25 0C0.388071 0 0.5 0.111929 0.5 0.25C0.5 1.09596 1.18627 1.78223 2.03223 1.78223C2.87796 1.78196 3.56348 1.09579 3.56348 0.25C3.56348 0.111929 3.67541 0 3.81348 0C3.95155 0 4.06348 0.111929 4.06348 0.25C4.06348 1.37194 3.1541 2.28196 2.03223 2.28223C0.910128 2.28223 0 1.3721 0 0.25Z";

// Tiny heart (unit ~16×16) — floats up on gentle acknowledgments / positive moods.
const HEART_PATH =
  "M8 14.5C8 14.5 1 9.9 1 5.2C1 2.9 2.8 1.2 5 1.2C6.3 1.2 7.4 1.8 8 2.8C8.6 1.8 9.7 1.2 11 1.2C13.2 1.2 15 2.9 15 5.2C15 9.9 8 14.5 8 14.5Z";
const HEART_SOURCE = 16;

/* ════════════════════════════════════════════════════════════════════════════
 *  3. LAYOUT NUMBERS — move features on the face by editing these.
 *     Coordinate system: SVG viewBox is 0 0 60 60. (0,0) = top-left.
 * ════════════════════════════════════════════════════════════════════════════ */

// ── Face circle (cream disc inside the petals) ────────────────────────
// Strict Figma proportions:
// body 50×50, face 31×31 (62% of body), eyes 1.49×2, blush 3×3,
// smile 4.06×2.28, leaf height 22.
const BODY_SIZE = 50;
const FACE_SVG_SIZE = 31.4213; // from face.svg rect width/height
const FACE_SVG_RX = 15.7106; // from face.svg rect rx
/** Open-eye anchor radius (tuned with LEFT_EYE_CX / EYE_CY). */
const DOT_EYE_R = 1.05;
const CLOSED_EYE_W = 2.55;
const CLOSED_EYE_H = 0.84;
const BLUSH_SIZE = 3;
const SMILE_TARGET_W = 4.06;
const SMILE_TARGET_H = 2.28;
const LEAF_TARGET_H = 22;
const LEAF_SOURCE_H = 23;

const BODY_CX = 30;
const BODY_CY = 29;

// ── Face features — hand-tuned in /dev/blob ─────────────────────────────
// X is never auto-adjusted. Y uses your *_TUNED values plus one optional nudge
// that moves eyes + mouth + blush together (negative = up, positive = down).
const LEFT_EYE_CX = 25.5;
const RIGHT_EYE_CX = 34.5;
const LEFT_BLUSH_CX = 22.2;
const RIGHT_BLUSH_CX = 37.8;
const EYE_CY_TUNED = 25;
const MOUTH_CY_TUNED = 29;
const BLUSH_CY_TUNED = 29;
/** Move whole face cluster on Y only. Try −1.5 to sit a bit higher on the face. */
const FACE_FEATURES_Y_NUDGE = 0;

const EYE_CY = EYE_CY_TUNED + FACE_FEATURES_Y_NUDGE;
const MOUTH_CY = MOUTH_CY_TUNED + FACE_FEATURES_Y_NUDGE;
const BLUSH_CY = BLUSH_CY_TUNED + FACE_FEATURES_Y_NUDGE;

// Sleeping-only layout (1 screen px ≈ 0.5 viewBox units at default size 120).
const SCREEN_PX_TO_VIEWBOX = 60 / 120;
/** Eyes sit ~1px lower on the face than idle (more gap from face top). */
const SLEEP_EYE_Y_OFFSET = SCREEN_PX_TO_VIEWBOX;
const CLOSED_EYE_SCALE = 1;
const FACE_TOP_Y = BODY_CY - FACE_SVG_SIZE / 2;

function getFaceLayout(isSleeping: boolean) {
  if (!isSleeping) {
    return { eyeCy: EYE_CY, mouthCy: MOUTH_CY, blushCy: BLUSH_CY };
  }
  const eyeCy = EYE_CY + SLEEP_EYE_Y_OFFSET;
  const mouthCy = MOUTH_CY;
  const blushCy = BLUSH_CY;
  const closedH = CLOSED_EYE_H * CLOSED_EYE_SCALE;
  const blockTop = eyeCy - closedH / 2;
  const blockBottom = mouthCy + SMILE_TARGET_H / 2;
  const centerShift = BODY_CY - (blockTop + blockBottom) / 2;
  return {
    eyeCy: eyeCy + centerShift,
    mouthCy: mouthCy + centerShift,
    blushCy: blushCy + centerShift,
  };
}

// sleeping-sign-zzz.svg — straddles cream face + yellow petals (upper-right rim)
const ZZZ_SOURCE_W = 5;
const ZZZ_SOURCE_H = 8;
const ZZZ_SCALE = 1.5;
/** Degrees from center toward upper-right rim of the cream circle. */
const ZZZ_RIM_DEG = 42;

function zzzPosition() {
  const rad = (ZZZ_RIM_DEG * Math.PI) / 180;
  const rimX = BODY_CX + FACE_SVG_RX * Math.cos(rad);
  const rimY = BODY_CY - FACE_SVG_RX * Math.sin(rad);
  const w = ZZZ_SOURCE_W * ZZZ_SCALE;
  const h = ZZZ_SOURCE_H * ZZZ_SCALE;
  return {
    x: rimX - w * 0.2,
    y: rimY - h * 0.78,
  };
}

// ── Leaves: top inner corners meet at bottom-center scallop (Figma ref) ──
const SUNFLOWER_TX = 5;
const SUNFLOWER_TY = 4;
/** Bottom-center valley of the 50×50 petal ring (x = 25). */
const SUNFLOWER_LEAF_ATTACH_Y = 48.32;
/** Move both leaves on Y only. Negative = up, positive = down (try −0.5, −1, −1.5). */
const LEAF_Y_NUDGE = -0.45;
const LEAF_ATTACH_X = SUNFLOWER_TX + 25;
const LEAF_ATTACH_Y = SUNFLOWER_TY + SUNFLOWER_LEAF_ATTACH_Y + LEAF_Y_NUDGE;
/** Stem tip on each leaf SVG — top inner corner that touches the petal. */
const LEAF_STEM_LEFT_X = 18.9881;
const LEAF_STEM_RIGHT_X = 2.88546;
const LEAF_STEM_Y = 8.52462;
const LEAF_SCALE = LEAF_TARGET_H / LEAF_SOURCE_H;
const LEAF_LEFT_X = LEAF_ATTACH_X - LEAF_STEM_LEFT_X * LEAF_SCALE;
const LEAF_RIGHT_X = LEAF_ATTACH_X - LEAF_STEM_RIGHT_X * LEAF_SCALE;
const LEAF_LEFT_Y = LEAF_ATTACH_Y - LEAF_STEM_Y * LEAF_SCALE;
const LEAF_RIGHT_Y = LEAF_LEFT_Y;

/** Ground shadow — sits below the leaves (not under them). */
const SHADOW_CX = BODY_CX;
const SHADOW_CY = 62;
const SHADOW_RX = 14.5;
const SHADOW_RY = 1.35;
const SHADOW_OPACITY = 0.1;

// ── Wake tuning (base + leaves only — eyes/mouth snap instantly) ─────────
// Edit these, save, reload /dev/blob → sleep → hover to wake.
/** How long the `waking` state lasts before returning to idle (ms). */
export const WAKE_DURATION_MS = 550;
/** Greeting one-shot length — keep in sync with GREETING_DURATION_MS. */
const GREETING_DURATION_S = 1.35;
/** Body jolt length in seconds. Higher = slower. */
const WAKE_BODY_DURATION_S = 0.55;
/** Body scale at the peak of the jolt (1 = full size). Try 1.02–1.05. */
const WAKE_BODY_SCALE_PEAK = 1.025;
/** Body lift at peak in viewBox px (negative = up). Try −1 to −2.5. */
const WAKE_BODY_LIFT_PX = -1.25;
/** Leaf wake length in seconds (up, then settle). */
const WAKE_LEAF_DURATION_S = 0.58;
/** How far leaves lift up at peak (viewBox px, negative = up). */
const WAKE_LEAF_LIFT_PX = -2;
/** Degrees to swing up from droop before settling (try 4–10). */
const WAKE_LEAF_ROTATE_LIFT = 6;

// ── Typing tuning (subtle float while listening — not distracting) ───────
/** Body lean + float cycle in seconds. Higher = slower/calmer. */
const TYPING_LEAN_DURATION_S = 1.35;
/** Tilt while typing in degrees. Try 1–2 (was 4). */
const TYPING_LEAN_ROTATE_DEG = 2;
/** Vertical float at peak in viewBox px (negative = up). Try −0.5 to −1. */
const TYPING_LEAN_FLOAT_PX = -0.75;
/** Leaf sway cycle in seconds. */
const TYPING_LEAF_SWAY_DURATION_S = 1.9;
/** Leaf sway amount in degrees. Try 1.5–2.5 (was 4). */
const TYPING_LEAF_SWAY_DEG = 2;

// ── Sleep breathing (body shrink/grow loop while sleeping) ───────────────
/** Full inhale+exhale cycle in seconds. Try 3–5. */
const SLEEP_BREATH_DURATION_S = 4;
/** Scale at exhale (smallest). Try 0.955–0.97. */
const SLEEP_BREATH_SCALE_MIN = 0.962;
/** Scale at inhale (largest). Try 0.99–1. */
const SLEEP_BREATH_SCALE_MAX = 0.992;
/** Lift on inhale in viewBox px (negative = up). Try 0 to −1. */
const SLEEP_BREATH_LIFT_PX = -0.6;

// ── Bloom growth (words = water) ─────────────────────────────────────────
/** Extra petal scale per bloom level. 0→1, 3→1+3*step (full bloom). */
const BLOOM_SCALE_STEP = 0.028;
/** Warm glow opacity per bloom level (base, before any state pulse). */
const BLOOM_GLOW_STEP = 0.05;
/** Radius of the warm glow disc behind the flower (viewBox units). */
const GLOW_RADIUS = 30;
/** Completion pushes the flower past its word-bloom to a fully open peak. */
const COMPLETION_SCALE_BONUS = 0.02;

// ── Entrance (State A) — slide in from the left, then settle ─────────────
/** Entrance slide duration in seconds. */
const ENTRANCE_DURATION_S = 0.9;
/** How far left the flower starts, in px (screen space on the container). */
const ENTRANCE_OFFSET_PX = 46;

/* ════════════════════════════════════════════════════════════════════════════
 *  4. STATES MAP — the ONE place that decides what each state looks like.
 *
 *  Each row picks a value from the catalogue (the union types below).
 *  Edit a value here and reload — no other change needed.
 *
 *  Catalogue:
 *    eye    : "open" | "open-blink" | "open-wake" | "closed" | "smile" | "wink"
 *    mouth  : "slight-smile" | "big-smile" | "small-o"
 *    body   : "bob" | "lean" | "shrink" | "wake" | "bounce"
 *    leaves : "still" | "sway" | "droop" | "perk" | "wake" | "greeting"
 *    extras : "none" | "zzz" | "sparkle-burst"
 * ════════════════════════════════════════════════════════════════════════════ */

type EyeKind = "open" | "open-blink" | "open-wake" | "closed" | "smile" | "wink";
type MouthKind = "slight-smile" | "big-smile" ;
type BodyKind =
  | "bob"
  | "lean"
  | "shrink"
  | "wake"
  | "bounce"
  | "wave"
  | "heavy-breath";
type LeafKind =
  | "still"
  | "sway"
  | "droop"
  | "perk"
  | "wake"
  | "greeting"
  | "highfive"; // raised + inviting (completion); claps on tap
type ExtrasKind = "none" | "zzz" | "sparkle-burst" | "heart";

type StateConfig = {
  eye: EyeKind;
  mouth: MouthKind;
  body: BodyKind;
  leaves: LeafKind;
  extras: ExtrasKind;
};

const STATES: Record<BlobState, StateConfig> = {
  // 👉 IDLE — at rest but alive: gentle breath, soft blinks, drifting petals.
  idle: {
    eye: "open",
    mouth: "big-smile",
    body: "bob",
    leaves: "still",
    extras: "none",
  },

  // 👉 TYPING — leaning in, listening: faster blinks, lively leaves.
  typing: {
    eye: "open-blink",
    mouth: "big-smile",
    body: "lean",
    leaves: "sway",
    extras: "none",
  },

  // 👉 SLEEPING — slow breath, occasional REM twitch, staggered zzz rising.
  sleeping: {
    eye: "closed",
    mouth: "slight-smile",
    body: "shrink",
    leaves: "droop",
    extras: "zzz",
  },

  // 👉 WAKING — gasp, stretch up, eyes pop wide, leaves shoot up to settle.
  waking: {
    eye: "open-wake",
    mouth: "big-smile",
    body: "wake",
    leaves: "wake",
    extras: "none",
  },

  // 👉 SAVING — happy eyes + smaller mouth (big mouth duplicates the eye curve).
  saving: {
    eye: "smile",
    mouth: "slight-smile",
    body: "bounce",
    leaves: "perk",
    extras: "sparkle-burst",
  },

  // 👉 GREETING — soft bounce when the canvas / book opens.
  greeting: {
    eye: "open",
    mouth: "big-smile",
    body: "wave",
    leaves: "greeting",
    extras: "none",
  },

  // 👉 WAITING (State C) — blank page: still + soft glow, never pushy.
  waiting: {
    eye: "open",
    mouth: "slight-smile",
    body: "bob",
    leaves: "still",
    extras: "none",
  },

  // 👉 PAUSE (State E) — quiet "I'm listening": one tiny heart drifts up.
  pause: {
    eye: "open",
    mouth: "slight-smile",
    body: "bob",
    leaves: "still",
    extras: "heart",
  },

  // 👉 BLOOM (State D) — a word milestone landed: brief proud open + sparkle.
  bloom: {
    eye: "smile",
    mouth: "big-smile",
    body: "bounce",
    leaves: "perk",
    extras: "sparkle-burst",
  },

  // 👉 COMPLETION (State H) — fully bloomed, leaves raised for a high-five.
  completion: {
    eye: "smile",
    mouth: "big-smile",
    body: "bounce",
    leaves: "highfive",
    extras: "sparkle-burst",
  },

  // 👉 HAPPY — bright reaction after AI reads joyful writing.
  happy: {
    eye: "smile",
    mouth: "big-smile",
    body: "bounce",
    leaves: "perk",
    extras: "sparkle-burst",
  },

  // 👉 HEAVY — gentle, slower presence for weighty writing.
  heavy: {
    eye: "open",
    mouth: "slight-smile",
    body: "heavy-breath",
    leaves: "droop",
    extras: "none",
  },

  // 👉 NEUTRAL — calm acknowledgment, understated.
  neutral: {
    eye: "open",
    mouth: "slight-smile",
    body: "bob",
    leaves: "still",
    extras: "none",
  },

  /* ───────────────────────────────────────────────────────────────────────
   *  PLACEHOLDER emotion poses (anxious / angry / confused / tired / calm).
   *  These reuse existing animations for now so the 8-emotion pipeline works
   *  end-to-end. Real Figma poses get dropped in here later — just change the
   *  values in each row, no other code touches these.
   * ─────────────────────────────────────────────────────────────────────── */

  // 👉 ANXIOUS — restless, quick blinks, leaves fidget. (placeholder)
  anxious: {
    eye: "open-blink",
    mouth: "slight-smile",
    body: "heavy-breath",
    leaves: "sway",
    extras: "none",
  },

  // 👉 ANGRY — taut, held breath. (placeholder)
  angry: {
    eye: "open",
    mouth: "slight-smile",
    body: "heavy-breath",
    leaves: "still",
    extras: "none",
  },

  // 👉 CONFUSED — gently unsettled, leaves drift. (placeholder)
  confused: {
    eye: "open",
    mouth: "slight-smile",
    body: "bob",
    leaves: "sway",
    extras: "none",
  },

  // 👉 TIRED — drooped, slow breath. (placeholder)
  tired: {
    eye: "open",
    mouth: "slight-smile",
    body: "heavy-breath",
    leaves: "droop",
    extras: "none",
  },

  // 👉 CALM — settled, soft and still. (placeholder)
  calm: {
    eye: "open",
    mouth: "slight-smile",
    body: "bob",
    leaves: "still",
    extras: "none",
  },
};

/* ════════════════════════════════════════════════════════════════════════════
 *  5. RENDER HELPERS — turn config strings into actual SVG.
 *     To add a new option, add a `case` and a constant for it.
 * ════════════════════════════════════════════════════════════════════════════ */

/** Position one eye at (cx, eyeCy) with the chosen visual style. */
function Eye({
  kind,
  side,
  eyeCy,
}: {
  kind: EyeKind;
  side: "left" | "right";
  eyeCy: number;
}) {
  const cx = side === "left" ? LEFT_EYE_CX : RIGHT_EYE_CX;

  // The outer <g> places the eye on the face.
  // The inner <g> (with data-eye=…) is what CSS animates (blink, wake).
  return (
    <g transform={`translate(${cx} ${eyeCy})`}>
      <g
        className={`blob-eye blob-eye-${side}`}
        data-eye={kind}
        style={{ transformOrigin: "0px 0px" }}
      >
        {renderEyeShape(kind, side)}
      </g>
    </g>
  );
}

/** Open oval eye from eye-{left,right}.svg — centered on the face anchor like the old dot. */
function OpenOvalEye({ side }: { side: "left" | "right" }) {
  const path = side === "left" ? OPEN_EYE_LEFT_PATH : OPEN_EYE_RIGHT_PATH;
  return (
    <g transform={`translate(${-OPEN_EYE_CX} ${-OPEN_EYE_CY})`}>
      <path d={path} fill={INK} />
    </g>
  );
}

function renderEyeShape(kind: EyeKind, side: "left" | "right") {
  switch (kind) {
    case "open":
    case "open-blink":
    case "open-wake":
    case "wink":
      return <OpenOvalEye side={side} />;

    // Sleeping eye — shallow closed curve (darker ink).
    case "closed": {
      return (
        <g
          transform={`translate(${(-CLOSED_EYE_W * CLOSED_EYE_SCALE) / 2} ${(-CLOSED_EYE_H * CLOSED_EYE_SCALE) / 2}) scale(${CLOSED_EYE_SCALE})`}
        >
          <path d={SLEEPING_EYE_PATH} fill={CLOSED_EYE_INK} />
        </g>
      );
    }

    // Saving eye — happy squint from eye-{left,right}-smilling.svg.
    case "smile": {
      return (
        <g
          transform={`translate(${(-CLOSED_EYE_W * CLOSED_EYE_SCALE) / 2} ${(-CLOSED_EYE_H * CLOSED_EYE_SCALE) / 2}) scale(${CLOSED_EYE_SCALE})`}
        >
          <path d={SMILE_EYE_PATH} fill={INK} />
        </g>
      );
    }
  }
}

function mouthTransforms(mouthCy: number) {
  const slightSourceW = 4;
  const slightSourceH = 2;
  const slightSx = SMILE_TARGET_W / slightSourceW;
  const slightSy = SMILE_TARGET_H / slightSourceH;
  const slightTx = BODY_CX - (slightSourceW * slightSx) / 2;
  const slightTy = mouthCy - (slightSourceH * slightSy) / 2;

  const bigSourceW = 4.06348;
  const bigSourceH = 2.28223;
  const bigSx = SMILE_TARGET_W / bigSourceW;
  const bigSy = SMILE_TARGET_H / bigSourceH;
  const bigTx = BODY_CX - (bigSourceW * bigSx) / 2;
  const bigTy = mouthCy - (bigSourceH * bigSy) / 2;

  return { slightTx, slightTy, slightSx, slightSy, bigTx, bigTy, bigSx, bigSy };
}

type MouthDisplay = "slight" | "big";

function mouthDisplay(kind: MouthKind): MouthDisplay {
  return kind === "big-smile" ? "big" : "slight";
}

/** Both smile paths stay mounted — CSS crossfades between them on state change. */
function Mouth({ kind, mouthCy }: { kind: MouthKind; mouthCy: number }) {
  const t = mouthTransforms(mouthCy);
  const display = mouthDisplay(kind);

  return (
    <g className="blob-mouth" data-mouth-display={display}>
      <g
        transform={`translate(${t.slightTx} ${t.slightTy}) scale(${t.slightSx} ${t.slightSy})`}
        className="blob-mouth-slight"
        opacity={display === "slight" ? 1 : 0}
      >
        <path d={SLIGHT_SMILE_PATH} fill={INK} />
      </g>
      <g
        transform={`translate(${t.bigTx} ${t.bigTy}) scale(${t.bigSx} ${t.bigSy})`}
        className="blob-mouth-big"
        opacity={display === "big" ? 1 : 0}
      >
        <path d={BIG_SMILE_PATH} fill={INK} />
      </g>
    </g>
  );
}

/** Two cheek dots. */
function Blush({ blushCy }: { blushCy: number }) {
  return (
    <g>
      <rect
        x={LEFT_BLUSH_CX - BLUSH_SIZE / 2}
        y={blushCy - BLUSH_SIZE / 2}
        width={BLUSH_SIZE}
        height={BLUSH_SIZE}
        rx={BLUSH_SIZE / 2}
        fill={BLUSH}
      />
      <rect
        x={RIGHT_BLUSH_CX - BLUSH_SIZE / 2}
        y={blushCy - BLUSH_SIZE / 2}
        width={BLUSH_SIZE}
        height={BLUSH_SIZE}
        rx={BLUSH_SIZE / 2}
        fill={BLUSH}
      />
    </g>
  );
}

/** Dev overlay: blue = face center, green = eyes+mouth block center. */
function FaceLayoutGuides() {
  const faceX = BODY_CX - FACE_SVG_SIZE / 2;
  const featureCy =
    (EYE_CY - DOT_EYE_R + MOUTH_CY + SMILE_TARGET_H / 2) / 2;
  return (
    <g className="pointer-events-none" opacity={0.45}>
      <rect
        x={faceX}
        y={BODY_CY - FACE_SVG_SIZE / 2}
        width={FACE_SVG_SIZE}
        height={FACE_SVG_SIZE}
        rx={FACE_SVG_RX}
        fill="none"
        stroke="#E85D5D"
        strokeWidth={0.35}
        strokeDasharray="1.2 0.8"
      />
      <line
        x1={faceX}
        y1={BODY_CY}
        x2={faceX + FACE_SVG_SIZE}
        y2={BODY_CY}
        stroke="#3B82F6"
        strokeWidth={0.35}
      />
      <line
        x1={faceX}
        y1={featureCy}
        x2={faceX + FACE_SVG_SIZE}
        y2={featureCy}
        stroke="#22C55E"
        strokeWidth={0.35}
        strokeDasharray="0.6 0.6"
      />
      <circle cx={BODY_CX} cy={BODY_CY} r={0.55} fill="#3B82F6" />
      <circle cx={BODY_CX} cy={featureCy} r={0.55} fill="#22C55E" />
      <circle cx={LEAF_ATTACH_X} cy={LEAF_ATTACH_Y} r={0.65} fill="#6D8759" />
    </g>
  );
}

/** Single 4-point sparkle path used by both sparkle layouts. */
function Sparkle({
  cx,
  cy,
  r,
  className,
}: {
  cx: number;
  cy: number;
  r: number;
  className?: string;
}) {
  const k = r * 0.32;
  const d =
    `M ${cx} ${cy - r} C ${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} ` +
    `C ${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} ` +
    `C ${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} ` +
    `C ${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
  return (
    <path
      d={d}
      fill={SPARKLE}
      className={className}
      style={{ opacity: 0, transformOrigin: `${cx}px ${cy}px` }}
    />
  );
}

/** Sleeping zzz — three Zs rise and fade in a slow, drifting cascade. */
function SleepZzz() {
  const { x, y } = zzzPosition();
  // Outer <g> = SVG position (never CSS-animated). Inner wrappers handle the
  // float; each Z animates independently so the cascade feels dreamy, not looped.
  return (
    <g transform={`translate(${x} ${y}) scale(${ZZZ_SCALE})`}>
      <g className="blob-zzz">
        <g className="blob-zzz-tier blob-zzz-1">
          <path d={ZZZ_PATH_SMALL} fill={ZZZ} />
        </g>
        <g className="blob-zzz-tier blob-zzz-2">
          <path d={ZZZ_PATH_MID} fill={ZZZ} />
        </g>
        <g className="blob-zzz-tier blob-zzz-3">
          <path d={ZZZ_PATH_LARGE} fill={ZZZ} />
        </g>
      </g>
    </g>
  );
}

/** One small heart that drifts up from the petals and fades. */
function FloatingHeart() {
  const scale = 0.42;
  const w = HEART_SOURCE * scale;
  // Sit just above the upper-right petals, like a soft thought.
  const x = 41;
  const y = 9;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g
        className="blob-heart"
        style={{ transformOrigin: `${HEART_SOURCE / 2}px ${HEART_SOURCE / 2}px` }}
      >
        <path d={HEART_PATH} fill={HEART} />
      </g>
      {/* keep w referenced so future layouts can center off the heart width */}
      <g aria-hidden data-heart-w={w} />
    </g>
  );
}

/** Pick the right extras layer for the given config. */
function Extras({ kind }: { kind: ExtrasKind }) {
  if (kind === "sparkle-burst") {
    return (
      <g>
        <Sparkle cx={46} cy={13} r={1.6} className="blob-sparkle-burst blob-sparkle-burst-1" />
        <Sparkle cx={50.5} cy={18} r={1.1} className="blob-sparkle-burst blob-sparkle-burst-2" />
        <Sparkle cx={43} cy={8} r={0.85} className="blob-sparkle-burst blob-sparkle-burst-3" />
      </g>
    );
  }
  if (kind === "heart") {
    return <FloatingHeart />;
  }
  return null;
}

/**
 * Warm radial glow behind the flower. Base opacity grows with the bloom level
 * (words = water); `state` adds a slow breathing pulse during the quiet
 * reaction states so the glow reads as "warmth", never a flashing alert.
 */
function Glow({
  bloomLevel,
  state,
  gradId,
}: {
  bloomLevel: BloomLevel;
  state: BlobState;
  gradId: string;
}) {
  const base = bloomLevel * BLOOM_GLOW_STEP;
  return (
    <g
      className="blob-glow"
      data-glow-state={state}
      style={{ ["--blob-glow-base" as string]: base } as React.CSSProperties}
    >
      <circle
        cx={BODY_CX}
        cy={BODY_CY}
        r={GLOW_RADIUS}
        fill={`url(#${gradId})`}
      />
    </g>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  6. <BlobCharacter />
 *     - Looks up the config for the current state.
 *     - Renders each layer with that config.
 *     - Sets data-* attributes so CSS (section 7) can target the
 *       right animation without using string concatenation.
 * ════════════════════════════════════════════════════════════════════════════ */

export default function BlobCharacter({
  state,
  size = 200,
  className,
  hidden = false,
  onWakeUp,
  bloomLevel = 0,
  entering = false,
  onHighFive,
  debugLayout = false,
}: BlobCharacterProps) {
  // styled-jsx injects after first paint; gate visibility so animations /
  // opacity rules never flash the wrong frame on refresh.
  const [paintReady, setPaintReady] = React.useState(false);
  React.useLayoutEffect(() => {
    setPaintReady(true);
  }, []);

  // High-five is a one-shot per completion window: tapping the raised leaves
  // plays a quick clap and notifies the parent exactly once.
  const [highFived, setHighFived] = React.useState(false);
  React.useEffect(() => {
    if (state !== "completion") setHighFived(false);
  }, [state]);

  const cfg = STATES[state];
  const face = getFaceLayout(state === "sleeping");
  const reactId = React.useId();
  const faceClipId = `blob-face-clip-${reactId.replace(/:/g, "")}`;
  const petalGradId = `blob-petal-grad-${reactId.replace(/:/g, "")}`;
  const faceGradId = `blob-face-grad-${reactId.replace(/:/g, "")}`;
  const leafLeftGradId = `blob-leaf-left-grad-${reactId.replace(/:/g, "")}`;
  const leafRightGradId = `blob-leaf-right-grad-${reactId.replace(/:/g, "")}`;
  const glowGradId = `blob-glow-grad-${reactId.replace(/:/g, "")}`;
  const faceX = BODY_CX - FACE_SVG_SIZE / 2;
  const faceY = BODY_CY - FACE_SVG_SIZE / 2;

  // Persistent growth — petals open a touch more at each milestone, and the
  // completion peak nudges it just past full bloom.
  const clampedBloom = Math.max(0, Math.min(3, Math.round(bloomLevel))) as BloomLevel;
  const bloomScale =
    1 +
    clampedBloom * BLOOM_SCALE_STEP +
    (state === "completion" ? COMPLETION_SCALE_BONUS : 0);

  const isCompletion = state === "completion";

  const handlePointerEnterWake = React.useCallback(() => {
    if (state === "sleeping") onWakeUp?.();
  }, [state, onWakeUp]);

  const handleHighFive = React.useCallback(() => {
    if (state !== "completion" || highFived) return;
    setHighFived(true);
    onHighFive?.();
  }, [state, highFived, onHighFive]);

  // Per-mount seed (0..1) derived from React's stable useId so multiple
  // companions on a page don't loop in lockstep, but SSR/CSR stay matched.
  const seed = React.useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < reactId.length; i++) {
      h ^= reactId.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  }, [reactId]);

  return (
    <div
      data-blob-state={state}
      data-entering={entering ? "true" : undefined}
      aria-hidden={isCompletion ? undefined : "true"}
      role={isCompletion ? "button" : undefined}
      aria-label={isCompletion ? "High-five the flower" : undefined}
      onPointerEnter={handlePointerEnterWake}
      onClick={isCompletion ? handleHighFive : undefined}
      className={clsx(
        "select-none",
        !paintReady || hidden ? "opacity-0" : "opacity-100",
        hidden && paintReady && "transition-opacity duration-300",
        entering && "blob-entering",
        state === "sleeping" || isCompletion ? "cursor-pointer" : "cursor-default",
        className
      )}
      style={
        {
          width: size,
          height: size,
          // Used by `animation-delay: calc(var(--blob-seed) * Ns)` further down.
          "--blob-seed": seed,
        } as React.CSSProperties
      }
    >
      <svg
        viewBox="0 0 60 60"
        width="100%"
        height="100%"
        fill="none"
        className="overflow-visible"
      >
        <defs>
          <clipPath id={faceClipId}>
            <circle cx={BODY_CX} cy={BODY_CY} r={FACE_SVG_RX} />
          </clipPath>
          <radialGradient
            id={glowGradId}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform={`translate(${BODY_CX} ${BODY_CY}) scale(${GLOW_RADIUS})`}
          >
            <stop stopColor={GLOW} stopOpacity="0.9" />
            <stop offset="0.55" stopColor={GLOW} stopOpacity="0.35" />
            <stop offset="1" stopColor={GLOW} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Warm glow — behind everything; grows with bloom + breathes on reactions. */}
        <Glow bloomLevel={clampedBloom} state={state} gradId={glowGradId} />

        {/* Body group — face, petals, and leaves move together. */}
        <g
          className="blob-body"
          data-body={cfg.body}
          style={{ transformOrigin: "30px 46px" }}
        >
          {/* Yellow scalloped petal ring — blooms on wake + grows with words. */}
          <g transform={`translate(${SUNFLOWER_TX} ${SUNFLOWER_TY})`}>
            <defs>
              <radialGradient
                id={petalGradId}
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform={PETAL_GRAD_TRANSFORM}
              >
                <stop stopColor="#F7B235" />
                <stop offset="0.478259" stopColor="#F7B235" />
                <stop offset="1" stopColor="#E35061" />
              </radialGradient>
            </defs>
            <g
              className="blob-petals"
              data-body={cfg.body}
              style={{ transformOrigin: "25px 25px" }}
            >
              {/* Persistent bloom scale composes with the petal rotate above. */}
              <g
                className="blob-bloom-scale"
                style={{
                  transformOrigin: "25px 25px",
                  transform: `scale(${bloomScale})`,
                }}
              >
                <path d={SUNFLOWER_PATH} fill={`url(#${petalGradId})`} />
              </g>
            </g>
          </g>

          {/* Face cluster — cream disc + features move together on head beats. */}
          <g
            className="blob-face-cluster"
            data-state={state}
            style={{ transformOrigin: `${BODY_CX}px ${BODY_CY}px` }}
          >
            <g transform={`translate(${faceX} ${faceY})`}>
              <defs>
                <radialGradient
                  id={faceGradId}
                  cx="0"
                  cy="0"
                  r="1"
                  gradientUnits="userSpaceOnUse"
                  gradientTransform={FACE_GRAD_TRANSFORM}
                >
                  <stop offset="0.0718464" stopColor="#FFF8EB" />
                  <stop offset="0.809758" stopColor="#FFF8EB" />
                  <stop offset="1" stopColor="#964707" />
                </radialGradient>
              </defs>
              <path d={FACE_PATH} fill={`url(#${faceGradId})`} />
            </g>

            <g clipPath={`url(#${faceClipId})`}>
              <g className="blob-features">
                <g className="blob-eyes-look" data-eye={cfg.eye}>
                  <Eye kind={cfg.eye} side="left" eyeCy={face.eyeCy} />
                  <Eye kind={cfg.eye} side="right" eyeCy={face.eyeCy} />
                </g>
                <Blush blushCy={face.blushCy} />
                <Mouth kind={cfg.mouth} mouthCy={face.mouthCy} />
              </g>
            </g>
          </g>

          {cfg.extras === "zzz" ? <SleepZzz /> : null}
          {debugLayout ? <FaceLayoutGuides /> : null}

          {/* Ground shadow (paused — set SHADOW_* and uncomment to re-enable).
          <ellipse
            className="blob-shadow"
            data-body={cfg.body}
            cx={SHADOW_CX}
            cy={SHADOW_CY}
            rx={SHADOW_RX}
            ry={SHADOW_RY}
            fill={INK}
            opacity={SHADOW_OPACITY}
          />
          */}

          {/* Leaves last so they paint on top of the yellow petals. */}
          <g transform={`translate(${LEAF_LEFT_X} ${LEAF_LEFT_Y}) scale(${LEAF_SCALE})`}>
            <defs>
              <radialGradient
                id={leafLeftGradId}
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform={LEAF_LEFT_GRAD_TRANSFORM}
              >
                <stop stopColor="#59702D" />
                <stop offset="1" stopColor="#8FB645" />
              </radialGradient>
            </defs>
            <g
              className="blob-leaf blob-leaf-left"
              data-leaves={cfg.leaves}
              data-highfive={highFived ? "clap" : undefined}
              style={{ transformOrigin: `${LEAF_STEM_LEFT_X}px ${LEAF_STEM_Y}px` }}
            >
              <path d={LEAF_LEFT_PATH} fill={`url(#${leafLeftGradId})`} />
            </g>
          </g>
          <g transform={`translate(${LEAF_RIGHT_X} ${LEAF_RIGHT_Y}) scale(${LEAF_SCALE})`}>
            <defs>
              <radialGradient
                id={leafRightGradId}
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform={LEAF_RIGHT_GRAD_TRANSFORM}
              >
                <stop stopColor="#59702D" />
                <stop offset="1" stopColor="#8FB645" />
              </radialGradient>
            </defs>
            <g
              className="blob-leaf blob-leaf-right"
              data-leaves={cfg.leaves}
              data-highfive={highFived ? "clap" : undefined}
              style={{ transformOrigin: `${LEAF_STEM_RIGHT_X}px ${LEAF_STEM_Y}px` }}
            >
              <path d={LEAF_RIGHT_PATH} fill={`url(#${leafRightGradId})`} />
            </g>
          </g>
        </g>

        {/* Particle extras (sparkles / heart) live outside the body group so
            the body bob doesn't drag them around. */}
        <Extras kind={cfg.extras} />
      </svg>

      <style jsx>{`
        /* ════════════════════════════════════════════════════════════════
         *  7. CSS ANIMATIONS
         *
         *  Design rules (read before editing):
         *    • Every state layers ≥ 2 animations on different elements with
         *      mismatched periods so the loop never feels like one big GIF.
         *    • Per-mount randomness via --blob-seed phases blinks / sways
         *      so multiple companions on a page don't lockstep.
         *    • Body, petals, leaves, features, eyes each animate on
         *      DIFFERENT cycle lengths — that mismatch is what feels alive.
         *    • Custom cubic-beziers (never linear) for organic ease.
         *    • One-shot states (wake, bounce) use anticipation + overshoot
         *      + settle — never a single linear pop.
         * ════════════════════════════════════════════════════════════════ */

        /* ── BODY (data-body) ─────────────────────────────────────────── */
        :global(.blob-body) {
          transition: transform 0.45s cubic-bezier(0.34, 1.12, 0.64, 1);
          will-change: transform;
        }

        /* IDLE — slow, soft breath. Y drift + tiny squash like inhale/exhale,
           not a hover-bob. Phased per mount so two companions don't sync. */
        :global(.blob-body[data-body="bob"]) {
          animation: blob-idle-breath 4.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -2.3s);
        }
        @keyframes blob-idle-breath {
          0%, 100% { transform: translateY(0) scale(1, 1); }
          50%      { transform: translateY(-0.85px) scale(1.012, 0.992); }
        }

        /* TYPING — leans in like it's listening. Secondary bob + scale so
           the lean never feels frozen; reads as "nodding along". */
        :global(.blob-body[data-body="lean"]) {
          animation: blob-typing-listen ${TYPING_LEAN_DURATION_S}s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @keyframes blob-typing-listen {
          0%, 100% {
            transform: rotate(${TYPING_LEAN_ROTATE_DEG}deg) translateY(0) scale(1, 1);
          }
          35% {
            transform: rotate(${TYPING_LEAN_ROTATE_DEG + 0.4}deg)
                       translateY(${TYPING_LEAN_FLOAT_PX}px)
                       scale(1.012, 0.988);
          }
          70% {
            transform: rotate(${TYPING_LEAN_ROTATE_DEG - 0.5}deg)
                       translateY(${TYPING_LEAN_FLOAT_PX * -0.25}px)
                       scale(0.996, 1.004);
          }
        }

        /* SLEEPING — slow inhale/exhale, with a tiny "second beat" at 58%
           so each cycle has a chest-rise shape (not a perfect sine wave). */
        :global(.blob-body[data-body="shrink"]) {
          animation: blob-sleep-breath ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-sleep-breath {
          0%, 100% {
            transform: scale(${SLEEP_BREATH_SCALE_MIN}, ${SLEEP_BREATH_SCALE_MIN - 0.005}) translateY(0.55px);
          }
          45% {
            transform: scale(${SLEEP_BREATH_SCALE_MAX}, ${SLEEP_BREATH_SCALE_MAX - 0.012})
                       translateY(${SLEEP_BREATH_LIFT_PX}px);
          }
          58% {
            transform: scale(${(SLEEP_BREATH_SCALE_MAX + SLEEP_BREATH_SCALE_MIN) / 2 + 0.003},
                             ${(SLEEP_BREATH_SCALE_MAX + SLEEP_BREATH_SCALE_MIN) / 2 - 0.005})
                       translateY(${SLEEP_BREATH_LIFT_PX * 0.55}px);
          }
        }

        /* WAKING — gasp → stretch up → tiny re-bounce → settle. 0% frame
           matches the last sleeping pose so there's no snap at flip. */
        :global(.blob-body[data-body="wake"]) {
          animation: blob-wake-body ${WAKE_BODY_DURATION_S}s cubic-bezier(0.34, 1.36, 0.64, 1) forwards;
        }
        @keyframes blob-wake-body {
          0%   { transform: scale(0.965, 0.97) translateY(0.6px); }
          18%  { transform: scale(0.95, 1.06) translateY(-0.4px); }
          42%  { transform: scale(${WAKE_BODY_SCALE_PEAK + 0.01}, ${WAKE_BODY_SCALE_PEAK - 0.05})
                            translateY(${WAKE_BODY_LIFT_PX}px); }
          62%  { transform: scale(0.99, 1.015) translateY(-0.2px); }
          82%  { transform: scale(1.008, 0.994) translateY(0.1px); }
          100% { transform: scale(1, 1) translateY(0); }
        }

        /* SAVING — proud little hop. Anticipation squat first, then up with
           stretch, second smaller bounce, settle. Never touches opacity
           (closing handles fade via the parent 'hidden' prop). */
        :global(.blob-body[data-body="bounce"]) {
          animation: blob-save-hop 1.1s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-save-hop {
          0%   { transform: translateY(0) scale(1, 1); }
          12%  { transform: translateY(0.8px) scale(1.045, 0.94); }
          32%  { transform: translateY(-5.5px) scale(0.96, 1.06); }
          50%  { transform: translateY(-0.6px) scale(1.025, 0.978); }
          66%  { transform: translateY(-2.6px) scale(0.985, 1.018); }
          82%  { transform: translateY(0.1px) scale(1.008, 0.994); }
          100% { transform: translateY(0) scale(1, 1); }
        }

        /* GREETING — soft bounce + tiny sway when the book / canvas opens. */
        :global(.blob-body[data-body="wave"]) {
          animation: blob-greeting-wave ${GREETING_DURATION_S}s cubic-bezier(0.34, 1.28, 0.64, 1) forwards;
        }
        @keyframes blob-greeting-wave {
          0%   { transform: rotate(0deg) translateY(0) scale(1, 1); }
          14%  { transform: rotate(-1.5deg) translateY(0.8px) scale(1.035, 0.97); }
          32%  { transform: rotate(2deg) translateY(-2.8px) scale(0.98, 1.045); }
          52%  { transform: rotate(-1.2deg) translateY(-1.2px) scale(1.02, 0.985); }
          72%  { transform: rotate(0.8deg) translateY(-0.4px) scale(0.995, 1.01); }
          88%  { transform: rotate(-0.4deg) translateY(0.15px) scale(1.006, 0.994); }
          100% { transform: rotate(0deg) translateY(0) scale(1, 1); }
        }

        /* HEAVY — slower, softer breath for weighty moments. */
        :global(.blob-body[data-body="heavy-breath"]) {
          animation: blob-heavy-breath 5.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-heavy-breath {
          0%, 100% { transform: translateY(0.4px) scale(0.985, 0.992); }
          50%      { transform: translateY(-0.3px) scale(0.992, 0.988); }
        }

        /* ── PETALS (data-body) — secondary motion on the petal ring ─── */
        :global(.blob-petals) {
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        :global(.blob-petals[data-body="bob"]) {
          animation: blob-petals-drift 7.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -3.7s);
        }
        @keyframes blob-petals-drift {
          0%, 100% { transform: rotate(0deg); }
          33%      { transform: rotate(0.7deg); }
          66%      { transform: rotate(-0.5deg); }
        }
        :global(.blob-petals[data-body="lean"]) {
          animation: blob-petals-typing 2.5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @keyframes blob-petals-typing {
          0%, 100% { transform: rotate(-0.4deg); }
          50%      { transform: rotate(0.9deg); }
        }
        :global(.blob-petals[data-body="shrink"]) {
          animation: blob-petals-sleep ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-petals-sleep {
          0%, 100% { transform: rotate(-0.5deg); }
          50%      { transform: rotate(0.5deg); }
        }
        :global(.blob-petals[data-body="wake"]) {
          animation: blob-petals-wake ${WAKE_BODY_DURATION_S}s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-petals-wake {
          0%   { transform: rotate(-0.4deg); }
          25%  { transform: rotate(-2.6deg); }
          55%  { transform: rotate(2deg); }
          80%  { transform: rotate(-0.6deg); }
          100% { transform: rotate(0); }
        }
        :global(.blob-petals[data-body="bounce"]) {
          animation: blob-petals-save 1.1s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-petals-save {
          0%   { transform: rotate(0); }
          32%  { transform: rotate(4deg); }
          66%  { transform: rotate(-2.5deg); }
          100% { transform: rotate(0); }
        }
        :global(.blob-petals[data-body="wave"]) {
          animation: blob-petals-greeting ${GREETING_DURATION_S}s cubic-bezier(0.34, 1.28, 0.64, 1) forwards;
        }
        @keyframes blob-petals-greeting {
          0%   { transform: rotate(0); }
          28%  { transform: rotate(-2deg); }
          55%  { transform: rotate(1.8deg); }
          100% { transform: rotate(0); }
        }
        :global(.blob-petals[data-body="heavy-breath"]) {
          animation: blob-petals-heavy 5.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-petals-heavy {
          0%, 100% { transform: rotate(-0.3deg); }
          50%      { transform: rotate(0.3deg); }
        }

        /* ── FACE CLUSTER — cream disc + eyes + mouth move as one unit ─── */
        :global(.blob-face-cluster) {
          transition: transform 0.45s cubic-bezier(0.34, 1.18, 0.64, 1);
        }
        :global(.blob-face-cluster[data-state="typing"]) {
          transform: translateY(0.45px);
        }
        :global(.blob-face-cluster[data-state="waking"]) {
          animation: blob-face-cluster-wake ${WAKE_BODY_DURATION_S}s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-face-cluster-wake {
          0%   { transform: translateY(0.4px); }
          40%  { transform: translateY(-0.6px); }
          100% { transform: translateY(0); }
        }
        :global(.blob-face-cluster[data-state="saving"]) {
          animation: blob-face-cluster-save 1.1s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-face-cluster-save {
          0%   { transform: translateY(0); }
          32%  { transform: translateY(-0.7px); }
          66%  { transform: translateY(-0.3px); }
          100% { transform: translateY(0); }
        }
        :global(.blob-face-cluster[data-state="greeting"]) {
          animation: blob-face-cluster-greeting ${GREETING_DURATION_S}s cubic-bezier(0.34, 1.28, 0.64, 1) forwards;
        }
        @keyframes blob-face-cluster-greeting {
          0%   { transform: translateY(0); }
          32%  { transform: translateY(-0.9px); }
          58%  { transform: translateY(-0.35px); }
          100% { transform: translateY(0); }
        }
        :global(.blob-face-cluster[data-state="happy"]) {
          animation: blob-face-cluster-save 1.1s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        :global(.blob-face-cluster[data-state="heavy"]) {
          transform: translateY(0.35px);
        }

        /* ── MOUTH — crossfade + gentle scale between slight / big smile ─ */
        :global(.blob-mouth-slight),
        :global(.blob-mouth-big) {
          transition:
            opacity 0.42s cubic-bezier(0.4, 0, 0.2, 1),
            transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1);
        }
        :global(.blob-mouth[data-mouth-display="slight"] .blob-mouth-slight) {
          opacity: 1;
        }
        :global(.blob-mouth[data-mouth-display="slight"] .blob-mouth-big) {
          opacity: 0;
          transform: scale(0.92);
        }
        :global(.blob-mouth[data-mouth-display="big"] .blob-mouth-slight) {
          opacity: 0;
          transform: scale(0.88);
        }
        :global(.blob-mouth[data-mouth-display="big"] .blob-mouth-big) {
          opacity: 1;
        }

        /* ── LEAVES (data-leaves) ─────────────────────────────────────── */
        :global(.blob-leaf) {
          transition: transform 0.45s cubic-bezier(0.34, 1.18, 0.64, 1);
          will-change: transform;
        }

        /* IDLE — barely-there sway, like a tiny breeze. Two different
           periods so the leaves never swing as a mirror pair. */
        :global(.blob-leaf-left[data-leaves="still"]) {
          animation: blob-leaf-still-l 5.3s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -2.6s);
        }
        :global(.blob-leaf-right[data-leaves="still"]) {
          animation: blob-leaf-still-r 5.9s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -2.9s - 0.6s);
        }
        @keyframes blob-leaf-still-l {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(-0.9deg); }
        }
        @keyframes blob-leaf-still-r {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(0.9deg); }
        }

        /* TYPING — livelier sway. Right leaf slightly slower so they
           never read as one mirrored shape. */
        :global(.blob-leaf-left[data-leaves="sway"]) {
          animation: blob-leaf-sway-l ${TYPING_LEAF_SWAY_DURATION_S}s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        :global(.blob-leaf-right[data-leaves="sway"]) {
          animation: blob-leaf-sway-r ${TYPING_LEAF_SWAY_DURATION_S + 0.25}s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: -0.5s;
        }
        @keyframes blob-leaf-sway-l {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(-${TYPING_LEAF_SWAY_DEG}deg); }
        }
        @keyframes blob-leaf-sway-r {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(${TYPING_LEAF_SWAY_DEG}deg); }
        }

        /* SLEEPING — relaxed droop that very gently breathes with the body. */
        :global(.blob-leaf-left[data-leaves="droop"]) {
          animation: blob-leaf-droop-l ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        :global(.blob-leaf-right[data-leaves="droop"]) {
          animation: blob-leaf-droop-r ${SLEEP_BREATH_DURATION_S}s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes blob-leaf-droop-l {
          0%, 100% { transform: rotate(-6deg) translateY(0.7px); }
          50%      { transform: rotate(-4.5deg) translateY(0.3px); }
        }
        @keyframes blob-leaf-droop-r {
          0%, 100% { transform: rotate(6deg) translateY(0.7px); }
          50%      { transform: rotate(4.5deg) translateY(0.3px); }
        }

        /* WAKING — leaves shoot up off the droop, overshoot, settle. */
        :global(.blob-leaf-left[data-leaves="wake"]),
        :global(.blob-leaf-right[data-leaves="wake"]) {
          transition: none;
        }
        :global(.blob-leaf-left[data-leaves="wake"]) {
          animation: blob-leaf-wake-l ${WAKE_LEAF_DURATION_S}s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        :global(.blob-leaf-right[data-leaves="wake"]) {
          animation: blob-leaf-wake-r ${WAKE_LEAF_DURATION_S}s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
        }
        @keyframes blob-leaf-wake-l {
          0%   { transform: rotate(-6deg) translateY(0.6px); }
          32%  { transform: rotate(${-6 + WAKE_LEAF_ROTATE_LIFT + 2}deg) translateY(${WAKE_LEAF_LIFT_PX}px); }
          60%  { transform: rotate(-2deg) translateY(-0.4px); }
          82%  { transform: rotate(1deg) translateY(-0.1px); }
          100% { transform: rotate(0deg) translateY(0); }
        }
        @keyframes blob-leaf-wake-r {
          0%   { transform: rotate(6deg) translateY(0.6px); }
          32%  { transform: rotate(${6 - WAKE_LEAF_ROTATE_LIFT - 2}deg) translateY(${WAKE_LEAF_LIFT_PX}px); }
          60%  { transform: rotate(2deg) translateY(-0.4px); }
          82%  { transform: rotate(-1deg) translateY(-0.1px); }
          100% { transform: rotate(0deg) translateY(0); }
        }

        /* SAVING — leaves perk up proudly on the hop, settle slightly raised. */
        :global(.blob-leaf-left[data-leaves="perk"]) {
          animation: blob-leaf-perk-l 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        :global(.blob-leaf-right[data-leaves="perk"]) {
          animation: blob-leaf-perk-r 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-leaf-perk-l {
          0%   { transform: rotate(0); }
          30%  { transform: rotate(-22deg) translateY(-0.4px); }
          65%  { transform: rotate(-10deg) translateY(0.1px); }
          100% { transform: rotate(-14deg); }
        }
        @keyframes blob-leaf-perk-r {
          0%   { transform: rotate(0); }
          30%  { transform: rotate(22deg) translateY(-0.4px); }
          65%  { transform: rotate(10deg) translateY(0.1px); }
          100% { transform: rotate(14deg); }
        }

        /* GREETING — leaves sway with the bounce, settle back to neutral. */
        :global(.blob-leaf-left[data-leaves="greeting"]) {
          animation: blob-leaf-greeting-l ${GREETING_DURATION_S}s cubic-bezier(0.34, 1.28, 0.64, 1) forwards;
        }
        :global(.blob-leaf-right[data-leaves="greeting"]) {
          animation: blob-leaf-greeting-r ${GREETING_DURATION_S}s cubic-bezier(0.34, 1.28, 0.64, 1) forwards;
        }
        @keyframes blob-leaf-greeting-l {
          0%   { transform: rotate(0deg); }
          28%  { transform: rotate(-7deg) translateY(-0.35px); }
          52%  { transform: rotate(4.5deg) translateY(-0.2px); }
          76%  { transform: rotate(-2.5deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes blob-leaf-greeting-r {
          0%   { transform: rotate(0deg); }
          28%  { transform: rotate(7deg) translateY(-0.35px); }
          52%  { transform: rotate(-4.5deg) translateY(-0.2px); }
          76%  { transform: rotate(2.5deg); }
          100% { transform: rotate(0deg); }
        }

        /* ── EYES ─────────────────────────────────────────────────────── */
        /* Eyes ride with the body/face. Per-eye motion is blink only (scaleY). */

        /* IDLE — natural slow blink + a much rarer "double-blink" beat. */
        :global(.blob-eye[data-eye="open"]) {
          animation: blob-idle-blink 5.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -3.3s);
        }
        @keyframes blob-idle-blink {
          0%, 53%, 56%, 86%, 90%, 100% { transform: scaleY(1); }
          54.5%                         { transform: scaleY(0.08); }
          88%                           { transform: scaleY(0.08); }
        }

        /* TYPING — quicker, more attentive blinks with an occasional double. */
        :global(.blob-eye[data-eye="open-blink"]) {
          animation: blob-typing-blink 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
          animation-delay: calc(var(--blob-seed, 0) * -1.5s);
        }
        @keyframes blob-typing-blink {
          0%, 38%, 47%, 70%, 73%, 78%, 100% { transform: scaleY(1); }
          42%                                { transform: scaleY(0.1); }
          75%                                { transform: scaleY(0.1); }
        }

        /* WAKING — eyes pop wide with overshoot (surprise → settle). */
        :global(.blob-eye[data-eye="open-wake"]) {
          animation: blob-eye-wake-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-eye-wake-pop {
          0%   { transform: scaleY(0.05); }
          40%  { transform: scaleY(1.18); }
          70%  { transform: scaleY(0.94); }
          100% { transform: scaleY(1); }
        }

        /* SLEEPING — closed eyes stay fixed (no twitch). */
        :global(.blob-eye[data-eye="closed"]) {
          transform: none;
        }

        /* SAVING — happy squint pop-in. */
        :global(.blob-eye[data-eye="smile"]) {
          animation: blob-smile-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes blob-smile-pop {
          0%   { transform: scaleY(0.4); }
          55%  { transform: scaleY(1.15); }
          100% { transform: scaleY(1); }
        }

        /* Wink kept for future use — both eyes squash together. */
        :global(.blob-eye[data-eye="wink"]) {
          animation: blob-wink-sync 0.48s ease-in-out 0.05s 1 forwards;
        }
        @keyframes blob-wink-sync {
          0%, 100% { transform: scaleY(1); }
          32%      { transform: scaleY(0.12); }
          58%      { transform: scaleY(1); }
        }

        /* ── SPARKLES — three sparkles bloom outward then fade ──────── */
        :global(.blob-sparkle-burst) {
          opacity: 0;
          animation-duration: 1.15s;
          animation-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
          animation-fill-mode: forwards;
        }
        :global(.blob-sparkle-burst-1) {
          animation-name: blob-sparkle-1;
          animation-delay: 0.05s;
        }
        :global(.blob-sparkle-burst-2) {
          animation-name: blob-sparkle-2;
          animation-delay: 0.22s;
        }
        :global(.blob-sparkle-burst-3) {
          animation-name: blob-sparkle-3;
          animation-delay: 0.38s;
        }
        /* Each sparkle drifts outward in its own direction so the burst
           reads as a celebration, not three pulses in place. */
        @keyframes blob-sparkle-1 {
          0%   { opacity: 0; transform: scale(0.15) translate(0, 0) rotate(-18deg); }
          28%  { opacity: 1; transform: scale(1.2) translate(0.6px, -0.5px) rotate(10deg); }
          65%  { opacity: 0.95; transform: scale(0.95) translate(1.1px, -1.1px) rotate(2deg); }
          100% { opacity: 0; transform: scale(0.5) translate(1.8px, -1.9px) rotate(-12deg); }
        }
        @keyframes blob-sparkle-2 {
          0%   { opacity: 0; transform: scale(0.15) translate(0, 0) rotate(12deg); }
          28%  { opacity: 1; transform: scale(1.15) translate(0.4px, 0.4px) rotate(-6deg); }
          65%  { opacity: 0.95; transform: scale(0.9) translate(0.8px, 0.9px) rotate(2deg); }
          100% { opacity: 0; transform: scale(0.45) translate(1.4px, 1.5px) rotate(14deg); }
        }
        @keyframes blob-sparkle-3 {
          0%   { opacity: 0; transform: scale(0.15) translate(0, 0) rotate(-8deg); }
          28%  { opacity: 1; transform: scale(1.1) translate(-0.3px, -0.5px) rotate(8deg); }
          65%  { opacity: 0.95; transform: scale(0.85) translate(-0.6px, -1px) rotate(-2deg); }
          100% { opacity: 0; transform: scale(0.45) translate(-1px, -1.6px) rotate(10deg); }
        }

        /* ── ZZZ — three Zs rise and fade in a staggered cascade ────── */
        /* fill-box origin so each tier scales around its own bbox center,
           not the viewBox corner. */
        :global(.blob-zzz-tier) {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
          animation-duration: 3.6s;
          animation-iteration-count: infinite;
          animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
        }
        :global(.blob-zzz-1) {
          animation-name: blob-zzz-rise;
          animation-delay: 0s;
        }
        :global(.blob-zzz-2) {
          animation-name: blob-zzz-rise;
          animation-delay: 1.2s;
        }
        :global(.blob-zzz-3) {
          animation-name: blob-zzz-rise;
          animation-delay: 2.4s;
        }
        @keyframes blob-zzz-rise {
          0%   { opacity: 0;    transform: translate(0, 0.9px) scale(0.85); }
          18%  { opacity: 0.85; transform: translate(0.05px, 0) scale(1); }
          45%  { opacity: 1;    transform: translate(0.15px, -0.9px) scale(1.04); }
          75%  { opacity: 0.55; transform: translate(0.25px, -1.9px) scale(1); }
          100% { opacity: 0;    transform: translate(0.4px, -2.8px) scale(0.9); }
        }

        /* ── REDUCED MOTION — keep only the breathing rhythms ──────── */
        @media (prefers-reduced-motion: reduce) {
          :global(.blob-body[data-body="bob"]) {
            animation: blob-idle-breath 7s ease-in-out infinite;
          }
          :global(.blob-body[data-body="shrink"]) {
            animation: blob-sleep-breath ${SLEEP_BREATH_DURATION_S * 1.6}s ease-in-out infinite;
          }
          :global(.blob-body[data-body="lean"]),
          :global(.blob-body[data-body="wake"]),
          :global(.blob-body[data-body="bounce"]),
          :global(.blob-body[data-body="wave"]),
          :global(.blob-petals),
          :global(.blob-face-cluster),
          :global(.blob-leaf),
          :global(.blob-eyes-look),
          :global(.blob-eye),
          :global(.blob-sparkle-burst),
          :global(.blob-zzz-tier) {
            animation: none !important;
            transition: none !important;
          }
          :global(.blob-eye[data-eye="closed"]) {
            transform: scaleX(1);
          }
          /* Keep sleeping zzz visible (faint) so the state still reads. */
          :global(.blob-zzz-tier) {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  8. useBlobState — typing / idle / sleep state machine.
 *
 *  Lifecycle:
 *    - Mount → "idle", sleep timer starts
 *    - onActivity() → "typing" → "idle" after ~900ms pause; sleep timer resets
 *    - 15s no typing → companion reacts (COMPANION_INACTIVITY_MS)
 *    - sleepAfterMs (3 min on canvas) with no activity → "sleeping"
 *    - onCanvasInteraction() / onWakeUp() while sleeping → "waking" → "idle"
 *    - Typing while sleeping skips wake animation → "typing" directly
 *    - onSave() → "saving" → "idle"
 * ════════════════════════════════════════════════════════════════════════════ */

/** Dev playground default — quick sleep for iteration. */
export const DEFAULT_SLEEP_AFTER_MS = 5_000;
/** Canvas: 3 min idle after last keystroke before sleeping (thinking ≠ inactivity). */
export const LONG_SLEEP_AFTER_MS = 180_000;
export const GREETING_DURATION_MS = 1350;
/** Match companion message total (1s in + 4s stay + 1s out) before returning to idle. */
export const EMOTION_REACTION_MS = 6_000;

const EMOTION_STATES: BlobState[] = [...COMPANION_EMOTIONS];

export type UseBlobStateOptions = {
  typingRestoreMs?: number;
  sleepAfterMs?: number;
  wakeDurationMs?: number;
  saveDurationMs?: number;
  greetingDurationMs?: number;
  emotionDurationMs?: number;
  /** When false, skip the mount greeting (dev grid previews). */
  greetOnMount?: boolean;
};

export function useBlobState(opts: UseBlobStateOptions = {}) {
  const {
    typingRestoreMs = 900,
    sleepAfterMs = DEFAULT_SLEEP_AFTER_MS,
    wakeDurationMs = WAKE_DURATION_MS,
    saveDurationMs = 1100,
    greetingDurationMs = GREETING_DURATION_MS,
    emotionDurationMs = EMOTION_REACTION_MS,
    greetOnMount = true,
  } = opts;

  const [state, setState] = React.useState<BlobState>(() =>
    greetOnMount ? "greeting" : "idle"
  );
  const [hidden, setHidden] = React.useState(false);

  const sleepTimerRef = React.useRef<number | null>(null);
  const idleTimerRef = React.useRef<number | null>(null);
  const wakeTimerRef = React.useRef<number | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const greetingTimerRef = React.useRef<number | null>(null);
  const emotionTimerRef = React.useRef<number | null>(null);
  const closingRef = React.useRef(false);
  const stateRef = React.useRef<BlobState>(greetOnMount ? "greeting" : "idle");

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearTimer = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearAll = React.useCallback(() => {
    clearTimer(sleepTimerRef);
    clearTimer(idleTimerRef);
    clearTimer(wakeTimerRef);
    clearTimer(saveTimerRef);
    clearTimer(greetingTimerRef);
    clearTimer(emotionTimerRef);
  }, []);

  const scheduleSleep = React.useCallback(() => {
    clearTimer(sleepTimerRef);
    sleepTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      if (
        stateRef.current === "sleeping" ||
        stateRef.current === "waking" ||
        stateRef.current === "greeting"
      ) {
        return;
      }
      if (EMOTION_STATES.includes(stateRef.current)) return;
      clearTimer(idleTimerRef);
      setState("sleeping");
    }, sleepAfterMs);
  }, [sleepAfterMs]);

  React.useEffect(() => {
    scheduleSleep();
    return clearAll;
  }, [clearAll, scheduleSleep]);

  const runGreeting = React.useCallback(() => {
    if (closingRef.current) return;
    clearTimer(greetingTimerRef);
    clearTimer(emotionTimerRef);
    setState("greeting");
    greetingTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      if (stateRef.current !== "greeting") return;
      setState("idle");
      scheduleSleep();
    }, greetingDurationMs);
  }, [greetingDurationMs, scheduleSleep]);

  React.useEffect(() => {
    if (!greetOnMount) return;
    runGreeting();
  }, [greetOnMount, runGreeting]);

  const onWakeUp = React.useCallback(() => {
    if (closingRef.current) return;
    if (stateRef.current !== "sleeping") return;
    clearTimer(sleepTimerRef);
    clearTimer(idleTimerRef);
    clearTimer(wakeTimerRef);
    setState("waking");
    wakeTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("idle");
      scheduleSleep();
    }, wakeDurationMs);
  }, [scheduleSleep, wakeDurationMs]);

  /** Pointer on canvas or character while sleeping → wake (no auto-idle until this). */
  const onCanvasInteraction = React.useCallback(() => {
    onWakeUp();
  }, [onWakeUp]);

  const onActivity = React.useCallback(() => {
    if (closingRef.current) return;
    clearTimer(sleepTimerRef);
    clearTimer(idleTimerRef);
    clearTimer(wakeTimerRef);
    clearTimer(greetingTimerRef);
    clearTimer(emotionTimerRef);

    if (stateRef.current === "sleeping") {
      setState("typing");
      idleTimerRef.current = window.setTimeout(() => {
        if (closingRef.current) return;
        setState("idle");
        scheduleSleep();
      }, typingRestoreMs);
      return;
    }

    if (stateRef.current === "waking" || stateRef.current === "saving") return;

    setState("typing");
    idleTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("idle");
      scheduleSleep();
    }, typingRestoreMs);
  }, [scheduleSleep, typingRestoreMs]);

  const onEmotionReaction = React.useCallback(
    (emotion: CompanionEmotion) => {
      if (closingRef.current) return;
      clearAll();
      setState(emotion);
      emotionTimerRef.current = window.setTimeout(() => {
        if (closingRef.current) return;
        if (!EMOTION_STATES.includes(stateRef.current)) return;
        setState("idle");
        scheduleSleep();
      }, emotionDurationMs);
    },
    [clearAll, emotionDurationMs, scheduleSleep]
  );

  const onSave = React.useCallback(() => {
    if (closingRef.current) return;
    clearAll();
    setState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      if (closingRef.current) return;
      setState("idle");
      scheduleSleep();
    }, saveDurationMs);
  }, [clearAll, saveDurationMs, scheduleSleep]);

  const onClosing = React.useCallback((): Promise<void> => {
    closingRef.current = true;
    clearAll();
    setState("saving");
    return new Promise((resolve) => {
      window.setTimeout(() => {
        setHidden(true);
        resolve();
      }, saveDurationMs);
    });
  }, [clearAll, saveDurationMs]);

  return {
    state,
    setState,
    hidden,
    onActivity,
    onCanvasInteraction,
    onWakeUp,
    onSave,
    onClosing,
    onEmotionReaction,
    runGreeting,
  };
}

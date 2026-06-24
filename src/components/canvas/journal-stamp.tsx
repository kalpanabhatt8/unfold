"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, useClerk, useSession } from "@clerk/nextjs";
import type { PublicUserData, UserResource } from "@clerk/types";
import { Stamp } from "lucide-react";
import {
  btnIcon,
  btnState,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import { Tooltip } from "@/components/ui/tooltip";

const STAMP_IMAGE = "/Images/stamp.svg";
const STAMP_INK = "158, 118, 90"; // #9E765A — matches stamp.svg border
const STAMP_NAME_CACHE_KEY = "keeps-stamp-display-name-v2";

function readCachedStampName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STAMP_NAME_CACHE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function cacheStampName(name: string) {
  if (typeof window === "undefined" || !name.trim()) return;
  try {
    window.localStorage.setItem(STAMP_NAME_CACHE_KEY, name.trim());
  } catch {
    /* noop */
  }
}

/* ─── Resolve display name from Clerk / Google OAuth ─────────────────────── */

function joinNameParts(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

/** Inner text safe zone — keeps ink inside the scalloped border. */
const STAMP_TEXT_ZONE_RATIO = 0.70;
/** Text uses the full safe zone; wraps only when it truly overflows. */
const STAMP_TEXT_WRAP_RATIO = 1;

function capitalizeWord(part: string): string {
  if (!part) return "";
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

/** Title-case each word for the stamp — "kalpana bhatt" → "Kalpana Bhatt". */
function formatStampDisplayText(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}

/** Handwritten signature face — shared with canvas signature field. */
const STAMP_FONT_FAMILY = "var(--font-signature), cursive";
const STAMP_LETTER_SPACING = "0.04em";
const STAMP_WORD_SPACING = "0.005em";

/** `first_last@…` → "First Last" (layout picks one vs two lines). */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  if (!local) return "";

  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}

function resolveFromPublicUserData(
  publicUserData: PublicUserData | null | undefined,
): string {
  if (!publicUserData) return "";

  const sessionName = joinNameParts(
    publicUserData.firstName,
    publicUserData.lastName,
  );
  if (sessionName) return sessionName;

  if (publicUserData.identifier.includes("@")) {
    return nameFromEmail(publicUserData.identifier);
  }

  return publicUserData.identifier.trim();
}

function resolveStampUserName(
  user: UserResource | null | undefined,
  publicUserData: PublicUserData | null | undefined,
): string {
  const sessionName = resolveFromPublicUserData(publicUserData);
  if (sessionName) return sessionName;

  if (!user) return "";

  const fullName = user.fullName?.trim();
  if (fullName) return fullName;

  const profileName = joinNameParts(user.firstName, user.lastName);
  if (profileName) return profileName;

  const googleAccount = user.externalAccounts?.find(
    (account) => account.provider === "google",
  );
  if (googleAccount) {
    const googleName = joinNameParts(
      googleAccount.firstName,
      googleAccount.lastName,
    );
    if (googleName) return googleName;
  }

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    user.externalAccounts.find((account) => account.emailAddress)?.emailAddress;

  if (email) return nameFromEmail(email);

  const username = user.username?.trim();
  if (username) return username;

  return "";
}

function logStampNameDebug({
  hasClerkPublishableKey,
  clerkLoaded,
  authLoaded,
  sessionLoaded,
  isSignedIn,
  user,
  publicUserData,
  sessionClaims,
  resolved,
  cached,
}: {
  hasClerkPublishableKey: boolean;
  clerkLoaded: boolean;
  authLoaded: boolean;
  sessionLoaded: boolean;
  isSignedIn: boolean | undefined;
  user: UserResource | null | undefined;
  publicUserData: PublicUserData | undefined;
  sessionClaims: Record<string, unknown> | null | undefined;
  resolved: string;
  cached: string;
}) {
  const googleAccount = user?.externalAccounts?.find(
    (account) => account.provider === "google",
  );
  const claimsFirst =
    typeof sessionClaims?.first_name === "string"
      ? sessionClaims.first_name
      : undefined;
  const claimsLast =
    typeof sessionClaims?.last_name === "string"
      ? sessionClaims.last_name
      : undefined;

  console.group("[🪪 stamp] name resolution");
  console.log("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set:", hasClerkPublishableKey);
  console.log("signed in:", isSignedIn);
  console.log("clerk loaded:", { clerkLoaded, authLoaded, sessionLoaded });
  console.log("session.publicUserData:", publicUserData);
  console.log("sessionClaims.first_name / last_name:", claimsFirst, claimsLast);
  console.log("user:", user
    ? {
        id: user.id,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        primaryEmail: user.primaryEmailAddress?.emailAddress,
        emailAddresses: user.emailAddresses.map((e) => e.emailAddress),
      }
    : null);
  console.log("google external account:", googleAccount
    ? {
        firstName: googleAccount.firstName,
        lastName: googleAccount.lastName,
        emailAddress: googleAccount.emailAddress,
      }
    : null);
  console.log(
    "resolved stamp name:",
    resolved ? `"${resolved}"` : "(empty — stamp shows border only)",
  );
  console.log("cached stamp name:", cached ? `"${cached}"` : "(none)");
  if (!hasClerkPublishableKey) {
    console.warn(
      "[🪪 stamp] Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local, then sign in with Google.",
    );
  } else if (clerkLoaded && !isSignedIn) {
    console.warn(
      "[🪪 stamp] Not signed in — visit /sign-in with Google to personalize the stamp.",
    );
  }
  console.groupEnd();
}

/* ─── Name layout ────────────────────────────────────────────────────────── */

function stampFontSizeForName(
  name: string,
  size: number,
  wrapped: boolean,
): number {
  const text = name.trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return size * 0.14;

  const longestWord = Math.max(...words.map((word) => word.length));
  if (wrapped) {
    return stampFontSize(longestWord, 2, size);
  }
  return stampFontSize(Math.max(longestWord, text.length), 1, size);
}

function stampFontSize(
  longestLineChars: number,
  lineCount: number,
  size: number,
): number {
  if (lineCount === 1) {
    if (longestLineChars <= 5) return size * 0.16;
    if (longestLineChars <= 8) return size * 0.14;
    if (longestLineChars <= 11) return size * 0.12;
    if (longestLineChars <= 14) return size * 0.105;
    return size * 0.09;
  }
  if (longestLineChars <= 5) return size * 0.13;
  if (longestLineChars <= 8) return size * 0.11;
  return size * 0.145;
}

/* ─── Stamp face ─────────────────────────────────────────────────────────── */

interface StampFaceProps {
  userName: string;
  size: number;
  /** Base ink opacity (0–1) applied to the name text. */
  inkAlpha: number;
  className?: string;
  style?: React.CSSProperties;
}

export function StampFace({
  userName,
  size,
  inkAlpha,
  className,
  style,
}: StampFaceProps) {
  const displayName = useMemo(
    () => formatStampDisplayText(userName),
    [userName],
  );

  if (!displayName) {
    return (
      <div
        className={className}
        style={{ position: "relative", width: size, height: size, ...style }}
        aria-hidden
      >
        <img
          src={STAMP_IMAGE}
          alt=""
          width={size}
          height={size}
          draggable={false}
          style={{ display: "block" }}
        />
      </div>
    );
  }

  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldWrap, setShouldWrap] = useState(false);

  const wrapWidth = size * STAMP_TEXT_ZONE_RATIO * STAMP_TEXT_WRAP_RATIO;
  const fontSize = stampFontSizeForName(displayName, size, shouldWrap);
  const inkColor = `rgba(${STAMP_INK}, ${inkAlpha.toFixed(3)})`;

  useEffect(() => {
    setShouldWrap(false);
  }, [displayName]);

  /* Prefer one line — measure with nowrap; wrap only on real overflow. */
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    el.style.whiteSpace = "nowrap";
    const needsWrap = el.scrollWidth > el.clientWidth + 1;
    setShouldWrap(needsWrap);
  }, [displayName, fontSize, wrapWidth]);

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size, ...style }}
      aria-hidden
    >
      <img
        src={STAMP_IMAGE}
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ display: "block" }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: wrapWidth,
          maxWidth: wrapWidth,
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: STAMP_FONT_FAMILY,
          fontWeight: 400,
          fontSize,
          lineHeight: 1.4,
          letterSpacing: STAMP_LETTER_SPACING,
          wordSpacing: STAMP_WORD_SPACING,
          color: inkColor,
          textAlign: "center",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        <span
          ref={textRef}
          style={{
            display: "block",
            width: "100%",
            whiteSpace: shouldWrap ? "normal" : "nowrap",
            wordBreak: "normal",
            overflowWrap: "normal",
            hyphens: "none",
          }}
        >
          {displayName}
        </span>
      </div>
    </div>
  );
}

/* ─── Animation phase type ───────────────────────────────────────────────── */

type Phase = "idle" | "pressing" | "impact" | "lifting" | "done";

/* ─── JournalStamp ───────────────────────────────────────────────────────── */

export type JournalStampHandle = {
  /** Run the press-and-lift animation, then call `onSeal`. */
  playSealAnimation: () => void;
};

export interface JournalStampProps {
  /** Called when the stamp press animation begins — fire seal side-effects early. */
  onStampBegin?: () => void;
  /** Hover/focus on stamp — prefetch title generation before click. */
  onStampHover?: () => void;
  /** Called after the full press-and-lift animation completes — seals entry. */
  onSeal: () => void;
  /**
   * Whether the entry is already sealed (rehydrated from localStorage).
   * When true the imprint is shown immediately, with no animation.
   */
  isSealed: boolean;
}

/**
 * Physical rubber-stamp interaction for sealing a journal entry.
 *
 * Animation sequence (~700 ms total):
 *   A. Press down    180 ms  — tool translates down + squashes
 *   B. Impact hold   120 ms  — brief compression at bottom
 *   C. Ink reveal    200 ms  — imprint fades + springs into view on paper
 *   D. Lift          180 ms  — tool springs back up
 *   E. Done         +220 ms  — onSeal() fires, tool hides, imprint stays
 */
export const JournalStamp = forwardRef<JournalStampHandle, JournalStampProps>(
  function JournalStamp({ onStampBegin, onStampHover, onSeal, isSealed }, ref) {
  const clerk = useClerk();
  const { isSignedIn, sessionClaims, isLoaded: authLoaded } = useAuth();
  const { session, isLoaded: sessionLoaded } = useSession();
  const user = clerk.user;

  const hasClerkPublishableKey = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  const userName = useMemo(() => {
    const cached = readCachedStampName();

    if (!clerk.loaded) return cached;

    const fromClaims = joinNameParts(
      typeof sessionClaims?.first_name === "string"
        ? sessionClaims.first_name
        : undefined,
      typeof sessionClaims?.last_name === "string"
        ? sessionClaims.last_name
        : undefined,
    );

    const resolved =
      fromClaims || resolveStampUserName(user, session?.publicUserData);

    if (resolved) {
      cacheStampName(resolved);
      return resolved;
    }

    return cached;
  }, [clerk.loaded, sessionClaims, user, session?.publicUserData]);

  useEffect(() => {
    const cached = readCachedStampName();
    console.log("[🪪 stamp] auth snapshot", {
      hasClerkPublishableKey,
      clerkLoaded: clerk.loaded,
      authLoaded,
      sessionLoaded,
      isSignedIn,
      userNameOnStamp: userName || "(empty)",
      cachedName: cached || "(none)",
    });

    logStampNameDebug({
      hasClerkPublishableKey,
      clerkLoaded: clerk.loaded,
      authLoaded,
      sessionLoaded,
      isSignedIn,
      user,
      publicUserData: session?.publicUserData,
      sessionClaims: sessionClaims as Record<string, unknown> | null | undefined,
      resolved: userName,
      cached,
    });
  }, [
    authLoaded,
    clerk.loaded,
    hasClerkPublishableKey,
    isSignedIn,
    session?.publicUserData,
    sessionClaims,
    sessionLoaded,
    user,
    userName,
  ]);

  useEffect(() => {
    if (!clerk.loaded || !user || userName) return;
    void user.reload();
  }, [clerk.loaded, user, userName]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [imprintVisible, setImprintVisible] = useState(false);

  /* Stable random values — chosen once per mount for ink realism */
  const [inkAlpha] = useState(() => 0.7 + Math.random() * 0.17); // 0.70…0.87

  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* Keep imprint visible whenever sealed — covers hydration and post-animation. */
  useEffect(() => {
    if (isSealed) {
      setImprintVisible(true);
      setPhase("done");
    }
  }, [isSealed]);

  /* Cleanup all pending timers on unmount */
  useEffect(() => {
    return () => timerIds.current.forEach(clearTimeout);
  }, []);

  const playSealAnimation = useCallback(() => {
    if (phase !== "idle" || isSealed) return;

    onStampBegin?.();

    const push = (cb: () => void, delay: number) => {
      const id = setTimeout(cb, delay);
      timerIds.current.push(id);
    };

    // A) Press down — 180 ms
    setPhase("pressing");

    push(() => {
      // B) Impact hold — 120 ms
      setPhase("impact");

      document.body.classList.add("stamp-impact");
      setTimeout(() => document.body.classList.remove("stamp-impact"), 300);

      push(() => {
        // C) Ink starts appearing — 200 ms transition handled by CSS
        setImprintVisible(true);

        // D) Lift begins simultaneously with ink reveal
        push(() => {
          setPhase("lifting");

          // E) Fully lifted — fire seal callback
          push(() => {
            setPhase("done");
            onSeal();
          }, 220);
        }, 180);
      }, 120);
    }, 180);
  }, [phase, isSealed, onSeal, onStampBegin]);

  useImperativeHandle(ref, () => ({ playSealAnimation }), [playSealAnimation]);

  const handleStampClick = useCallback(() => {
    if (phase !== "idle" || isSealed) return;
    playSealAnimation();
  }, [phase, isSealed, playSealAnimation]);

  /* ── Tool transform — presses down on click, springs back on lift ── */
  const toolIsDown = phase === "pressing" || phase === "impact";

  const toolStyle: React.CSSProperties = {
    transform: toolIsDown
      ? "translateY(20px) scaleY(0.91)"
      : "translateY(0px) scaleY(1)",
    transformOrigin: "50% 100%",
    transition:
      phase === "pressing"
        ? "transform 180ms cubic-bezier(0.55, 0, 1, 0.45)"
        : phase === "lifting"
          ? "transform 220ms cubic-bezier(0, 0, 0.2, 1)"
          : "none",
  };

  const showImprint = imprintVisible || isSealed;

  useEffect(() => {
    if (!showImprint) return;
    console.log(
      "[🪪 stamp] imprint on page — name:",
      userName ? `"${userName}"` : "(none — sign in with Google or add Clerk keys)",
    );
  }, [showImprint, userName]);

  /** Right edge of the centered writing column (matches canvas-board layout). */
  const writingColumnRight =
    "calc(max(1.5rem, (100vw - min(92vw, 700px)) / 2) + 1.5rem)";

  /* ── Imprint — bottom edge at 100svh; fixed so it stays while content scrolls ── */
  const imprintStyle: React.CSSProperties = {
    position: "fixed",
    top: "100svh",
    right: writingColumnRight,
    zIndex: 20,
    pointerEvents: "none",
    transformOrigin: "100% 100%",
    transform: `translateY(-100%) rotate(var(--stamp-imprint-tilt, -10deg)) scale(${showImprint ? 1 : 0.75})`,
    opacity: showImprint ? inkAlpha : 0,
    transition: showImprint
      ? "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 240ms ease-out"
      : "none",
    mixBlendMode: "multiply",
  };

  const imprint = (
    <div style={imprintStyle} aria-hidden>
      <StampFace userName={userName} size={132} inkAlpha={0.88} />
    </div>
  );

  const showTool = !isSealed && phase !== "done";

  return (
    <>
      {showImprint && imprint}

      {/* ── Stamp tool — icon button, bottom-right of canvas ── */}
      {showTool && (
        <div
          className="pointer-events-auto fixed bottom-5 right-5 z-20"
          style={toolStyle}
        >
          <Tooltip content="Seal forever">
            <button
              type="button"
              onClick={handleStampClick}
              onPointerEnter={onStampHover}
              onFocus={onStampHover}
              aria-label="Seal this entry forever"
              disabled={phase !== "idle"}
              className={`group shrink-0 cursor-pointer select-none outline-none disabled:cursor-default ${btnIcon("lg")} ${btnState.default} ${btnState.hover} ${btnState.active} ${btnState.disabled}`}
            >
              <Stamp
                size={iconPx("lg")}
                strokeWidth={iconStroke("lg")}
                aria-hidden
                className={`${iconFixed} origin-center transition-transform duration-200 ease-out group-hover:rotate-12 group-disabled:rotate-0`}
              />
            </button>
          </Tooltip>
        </div>
      )}
    </>
  );
});

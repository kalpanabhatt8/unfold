"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAuth, useClerk, useSession } from "@clerk/nextjs";
import type { PublicUserData, UserResource } from "@clerk/types";

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
const STAMP_TEXT_ZONE_RATIO = 0.54;

function capitalizeWord(part: string): string {
  if (!part) return "";
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

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

/**
 * Two-word+ names: first name on line 1, rest on line 2 when both fit.
 * Otherwise one line if the full name fits; last resort first name only.
 */
function layoutStampText(fullName: string): { lines: string[] } | null {
  const text = fullName.trim().replace(/\s+/g, " ");
  if (!text) return null;

  const MAX_SINGLE_LINE_CHARS = 14;
  const MAX_LINE_CHARS = 10;

  const words = text.split(" ");

  if (words.length >= 2) {
    const line1 = words[0];
    const line2 = words.slice(1).join(" ");
    if (line1.length <= MAX_LINE_CHARS && line2.length <= MAX_LINE_CHARS) {
      return { lines: [line1, line2] };
    }
  }

  if (text.length <= MAX_SINGLE_LINE_CHARS) {
    return { lines: [text] };
  }

  return { lines: [words[0] ?? text] };
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
  return size * 0.095;
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
  const layout = useMemo(() => layoutStampText(userName), [userName]);
  if (!layout) {
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

  const { lines } = layout;
  const isTwoLine = lines.length > 1;
  const longestLine = Math.max(...lines.map((line) => line.length));
  const fontSize = stampFontSize(longestLine, lines.length, size);
  const textZoneWidth = size * STAMP_TEXT_ZONE_RATIO;

  const inkColor = `rgba(${STAMP_INK}, ${inkAlpha.toFixed(3)})`;

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
          width: textZoneWidth,
          maxWidth: textZoneWidth,
          padding: `0 ${size * 0.03}px`,
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-balsamiq-sans), var(--font-caveat), cursive",
          fontWeight: 400,
          fontSize,
          lineHeight: 1.08,
          color: inkColor,
          textAlign: "center",
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {lines.map((line) => (
          <span
            key={line}
            style={{
              display: "block",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: isTwoLine ? "normal" : "nowrap",
            }}
          >
            {line}
          </span>
        ))}
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
  /** Called after the full press-and-lift animation completes — seals entry. */
  onSeal: () => void;
  /**
   * Whether the entry is already sealed (rehydrated from localStorage).
   * When true the imprint is shown immediately, with no animation.
   */
  isSealed: boolean;
  /** Writing column — imprint is portaled here so it stays on the page. */
  imprintAnchorEl?: HTMLElement | null;
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
  function JournalStamp({ onSeal, isSealed, imprintAnchorEl = null }, ref) {
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
  /* Slight left tilt — feels hand-stamped on the page */
  const STAMP_IMPRINT_ROTATION = -7.5;
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
  }, [phase, isSealed, onSeal]);

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

  /* ── Imprint style — anchored on the writing column, scrolls with the page ── */
  const imprintStyle: React.CSSProperties = {
    position: imprintAnchorEl ? "absolute" : "fixed",
    ...(imprintAnchorEl
      ? { top: "4.5rem", right: 0 }
      : {
          right:
            "calc(max(1.5rem, (100vw - min(92vw, 700px)) / 2 + 1.5rem))",
          top: "30%",
        }),
    zIndex: 20,
    pointerEvents: "none",
    transform: `rotate(${STAMP_IMPRINT_ROTATION}deg) scale(${showImprint ? 1 : 0.75})`,
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
      {showImprint &&
        (imprintAnchorEl
          ? createPortal(imprint, imprintAnchorEl)
          : imprint)}

      {/* ── Stamp tool — physical handle sits at bottom-right ── */}
      {showTool && (
        <div
          className="pointer-events-auto fixed bottom-5 right-5 z-20 flex flex-col items-center"
          style={toolStyle}
        >
          <p
            aria-hidden
            className="mb-2 select-none text-[9px] uppercase leading-none tracking-[0.2em] text-black/25"
          >
            Seal forever
          </p>

          <button
            type="button"
            onClick={handleStampClick}
            aria-label="Seal this entry forever"
            title="Seal this entry forever"
            disabled={phase !== "idle"}
            className="group flex cursor-pointer select-none flex-col items-center outline-none disabled:cursor-default"
          >
            <div className="h-5 w-8 rounded-t-lg border border-b-0 border-black/[0.09] bg-black/[0.10] transition-colors group-hover:bg-black/[0.17]" />
            <div className="h-2 w-11 border-x border-black/[0.07] bg-black/[0.07]" />
            <div className="mb-px h-1.5 w-14 rounded-b-[3px] border border-t-0 border-black/[0.05] bg-black/[0.06]" />
            <div className="opacity-55 transition-opacity group-hover:opacity-75">
              <StampFace userName={userName} size={58} inkAlpha={0.95} />
            </div>
          </button>
        </div>
      )}
    </>
  );
});

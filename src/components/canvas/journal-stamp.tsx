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
import { Signature } from "lucide-react";
import {
  btnIcon,
  btnState,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import { Tooltip } from "@/components/ui/tooltip";

/** Equal visual inset from viewport bottom and right (px). */
const STAMP_EDGE_INSET_PX = 32;
/** Text-only imprint box — width fits long names; height fits two lines at 2× font. */
const STAMP_WIDTH = 180;
const STAMP_HEIGHT = 80;
const STAMP_TEXT_PADDING = 12;
/** Baseline used for font scale — keeps 2× sizing vs the old 132px stamp. */
const STAMP_FONT_REFERENCE = 132;
const STAMP_TILT_DEG = 24;
const STAMP_PRESS_MS = 200;
const STAMP_IMPACT_HOLD_MS = 150;
const STAMP_INK_FADE_MS = 420;
const STAMP_PRESS_SCALE = 0.92;
const STAMP_TILT = `rotate(var(--stamp-imprint-tilt, -${STAMP_TILT_DEG}deg))`;

/**
 * Rotating the imprint around its center extends past the layout box.
 * Nudge bottom/right so the tilted stamp sits the same distance from each edge.
 */
function stampAlignedCornerInsets(
  width: number,
  height: number,
  insetPx: number,
  tiltDeg: number,
): Pick<React.CSSProperties, "bottom" | "right"> {
  const rad = (Math.abs(tiltDeg) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = width / 2;
  const halfH = height / 2;
  const aabbW = width * cos + height * sin;
  const aabbH = width * sin + height * cos;
  const overflow = Math.max(aabbW / 2 - halfW, aabbH / 2 - halfH);
  return {
    bottom: insetPx + overflow,
    right: insetPx + overflow,
  };
}

const stampImprintInsets = stampAlignedCornerInsets(
  STAMP_WIDTH,
  STAMP_HEIGHT,
  STAMP_EDGE_INSET_PX,
  STAMP_TILT_DEG,
);

/** Seal icon button — true corner inset. */
const stampCornerAnchor: React.CSSProperties = {
  position: "fixed",
  bottom: STAMP_EDGE_INSET_PX,
  right: STAMP_EDGE_INSET_PX,
  zIndex: 20,
};

/** Stamp imprint — optical corner inset after tilt. */
const stampImprintShell: React.CSSProperties = {
  position: "fixed",
  ...stampImprintInsets,
  zIndex: 20,
  width: STAMP_WIDTH,
  height: STAMP_HEIGHT,
  overflow: "visible",
};

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

const STAMP_FONT_FAMILY = "var(--font-bonheur-royale), cursive";
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
  wrapped: boolean,
): number {
  const text = name.trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return STAMP_FONT_REFERENCE * 0.28;

  const longestWord = Math.max(...words.map((word) => word.length));
  if (wrapped) {
    return stampFontSize(longestWord, 2, STAMP_FONT_REFERENCE);
  }
  return stampFontSize(
    Math.max(longestWord, text.length),
    1,
    STAMP_FONT_REFERENCE,
  );
}

function stampFontSize(
  longestLineChars: number,
  lineCount: number,
  size: number,
): number {
  if (lineCount === 1) {
    if (longestLineChars <= 5) return size * 0.32;
    if (longestLineChars <= 8) return size * 0.28;
    if (longestLineChars <= 11) return size * 0.24;
    if (longestLineChars <= 14) return size * 0.21;
    return size * 0.18;
  }
  if (longestLineChars <= 5) return size * 0.26;
  if (longestLineChars <= 8) return size * 0.22;
  return size * 0.29;
}

/* ─── Stamp face ─────────────────────────────────────────────────────────── */

interface StampFaceProps {
  userName: string;
  width: number;
  height: number;
  /** Base ink opacity (0–1) applied to the name text. */
  inkAlpha: number;
  className?: string;
  style?: React.CSSProperties;
}

export function StampFace({
  userName,
  width,
  height,
  inkAlpha,
  className,
  style,
}: StampFaceProps) {
  const displayName = useMemo(
    () => formatStampDisplayText(userName),
    [userName],
  );

  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldWrap, setShouldWrap] = useState(false);

  const fontSize = stampFontSizeForName(displayName, shouldWrap);
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
  }, [displayName, fontSize, width, height]);

  if (!displayName) {
    return (
      <div
        className={className}
        style={{
          position: "relative",
          width,
          height,
          boxSizing: "border-box",
          ...style,
        }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        height,
        boxSizing: "border-box",
        padding: STAMP_TEXT_PADDING,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        fontFamily: STAMP_FONT_FAMILY,
        fontWeight: 400,
        fontSize,
        lineHeight: 1.35,
        letterSpacing: STAMP_LETTER_SPACING,
        wordSpacing: STAMP_WORD_SPACING,
        color: inkColor,
        textAlign: "center",
        userSelect: "none",
        pointerEvents: "none",
        ...style,
      }}
      aria-hidden
    >
      {/* <img
        src={STAMP_IMAGE}
        alt=""
        width={width}
        height={height}
        draggable={false}
        style={{ display: "block" }}
      /> */}
      <span
        ref={textRef}
        style={{
          display: "block",
          width: "100%",
          maxWidth: "100%",
          whiteSpace: shouldWrap ? "normal" : "nowrap",
          wordBreak: "normal",
          overflowWrap: "normal",
          hyphens: "none",
        }}
      >
        {displayName}
      </span>
    </div>
  );
}

/* ─── Animation phase type ───────────────────────────────────────────────── */

type Phase = "idle" | "pressing" | "impact" | "lifting" | "done";

/* ─── JournalStamp ───────────────────────────────────────────────────────── */

export type JournalStampHandle = {
  /** Run the press-and-lift stamp animation. */
  playSealAnimation: () => void;
};

export interface JournalStampProps {
  /** Called when the stamp press animation begins — fire seal side-effects early. */
  onStampBegin?: () => void;
  /** Called when the stamp face meets the page — start text preservation animation. */
  onStampImpact?: () => void;
  /** Hover/focus on stamp — prefetch title generation before click. */
  onStampHover?: () => void;
  /**
   * Whether the entry is already sealed (rehydrated from localStorage).
   * When true the imprint is shown immediately, with no animation.
   */
  isSealed: boolean;
}

/**
 * Physical rubber-stamp interaction for sealing a journal entry.
 *
 * Animation sequence (~770 ms total):
 *   A. Press in place  200 ms  — uniform scale, corner pinned at 32 / 32 px
 *   B. Hold             150 ms  — brief pause at contact
 *   C. Ink fade         420 ms  — slow opacity fade, zero movement
 *   D. Done              — imprint never moves again
 */
export const JournalStamp = forwardRef<JournalStampHandle, JournalStampProps>(
  function JournalStamp(
    { onStampBegin, onStampImpact, onStampHover, isSealed },
    ref,
  ) {
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

  /** Stable primitive key — avoids re-logging when Clerk object refs change on parent re-render. */
  const authDebugFingerprint = useMemo(() => {
    const publicUserData = session?.publicUserData;
    const claimsFirst =
      typeof sessionClaims?.first_name === "string"
        ? sessionClaims.first_name
        : "";
    const claimsLast =
      typeof sessionClaims?.last_name === "string"
        ? sessionClaims.last_name
        : "";
    return [
      hasClerkPublishableKey,
      clerk.loaded,
      authLoaded,
      sessionLoaded,
      isSignedIn,
      user?.id ?? "",
      publicUserData?.firstName ?? "",
      publicUserData?.lastName ?? "",
      publicUserData?.identifier ?? "",
      claimsFirst,
      claimsLast,
      userName,
    ].join("|");
  }, [
    hasClerkPublishableKey,
    clerk.loaded,
    authLoaded,
    sessionLoaded,
    isSignedIn,
    user?.id,
    session?.publicUserData?.firstName,
    session?.publicUserData?.lastName,
    session?.publicUserData?.identifier,
    sessionClaims?.first_name,
    sessionClaims?.last_name,
    userName,
  ]);

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
    // Log only when authDebugFingerprint changes (mount + real auth/name updates).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint encodes all auth primitives
  }, [authDebugFingerprint]);

  useEffect(() => {
    if (!clerk.loaded || !user || userName) return;
    void user.reload();
  }, [clerk.loaded, user, userName]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [imprintVisible, setImprintVisible] = useState(false);
  const [pressEngaged, setPressEngaged] = useState(false);
  const sealStartedRef = useRef(false);

  /* Stable random values — chosen once per mount for ink realism */
  const [inkAlpha] = useState(() => 0.7 + Math.random() * 0.17); // 0.70…0.87

  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* Keep imprint visible whenever sealed — covers hydration and post-animation. */
  useEffect(() => {
    if (isSealed) {
      sealStartedRef.current = true;
      setImprintVisible(true);
      setPhase("done");
    }
  }, [isSealed]);

  /* Cleanup all pending timers on unmount */
  useEffect(() => {
    return () => timerIds.current.forEach(clearTimeout);
  }, []);

  /* Uniform in-place press — scale on the next frame after contact. */
  useEffect(() => {
    if (phase !== "pressing") {
      setPressEngaged(false);
      return;
    }
    const id = requestAnimationFrame(() => setPressEngaged(true));
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const playSealAnimation = useCallback(() => {
    if (sealStartedRef.current || isSealed) return;
    sealStartedRef.current = true;

    console.log(
      "[🪪 stamp] seal animation started — name:",
      userName ? `"${userName}"` : "(none)",
    );

    onStampBegin?.();

    const push = (cb: () => void, delay: number) => {
      const id = setTimeout(cb, delay);
      timerIds.current.push(id);
    };

    setImprintVisible(false);
    setPressEngaged(false);
    setPhase("pressing");

    push(() => {
      setPhase("impact");
      onStampImpact?.();

      push(() => {
        setImprintVisible(true);
        setPhase("lifting");

        push(() => {
          setPhase("done");
        }, STAMP_INK_FADE_MS);
      }, STAMP_IMPACT_HOLD_MS);
    }, STAMP_PRESS_MS);
  }, [isSealed, onStampBegin, onStampImpact, userName]);

  useImperativeHandle(ref, () => ({ playSealAnimation }), [playSealAnimation]);

  const startSeal = useCallback(() => {
    playSealAnimation();
  }, [playSealAnimation]);

  const isOnPaper = imprintVisible || isSealed;
  const showRubberStamp = phase !== "idle" || isOnPaper;
  const showSealButton = !isSealed && phase === "idle";

  /** One transform for every phase after contact — no translate, no axis squash. */
  const stampFaceTransform =
    phase === "pressing" && !pressEngaged
      ? `${STAMP_TILT} scale(${STAMP_PRESS_SCALE})`
      : `${STAMP_TILT} scale(1)`;

  const stampFaceStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    transformOrigin: "50% 50%",
    transform: stampFaceTransform,
    opacity: isOnPaper ? inkAlpha : 1,
    mixBlendMode: isOnPaper ? "multiply" : "normal",
    transition:
      phase === "done"
        ? "none"
        : isOnPaper || phase === "lifting"
          ? `opacity ${STAMP_INK_FADE_MS}ms ease-out`
          : phase === "pressing" && pressEngaged
            ? `transform ${STAMP_PRESS_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`
            : "none",
  };

  const prevShowImprintRef = useRef(false);

  useEffect(() => {
    if (!isOnPaper || prevShowImprintRef.current) return;
    prevShowImprintRef.current = true;
    console.log(
      "[🪪 stamp] imprint on page — name:",
      userName ? `"${userName}"` : "(none — sign in with Google or add Clerk keys)",
    );
  }, [isOnPaper, userName]);

  return (
    <>
      {showRubberStamp && (
        <div style={{ ...stampImprintShell, pointerEvents: "none" }} aria-hidden>
          <div style={stampFaceStyle}>
            <StampFace
              userName={userName}
              width={STAMP_WIDTH}
              height={STAMP_HEIGHT}
              inkAlpha={isOnPaper ? 0.88 : 0.95}
            />
          </div>
        </div>
      )}

      {/* ── Sign control — icon at rest; press animation leaves signature imprint ── */}
      {showSealButton && (
        <div className="pointer-events-auto" style={stampCornerAnchor}>
          <Tooltip content="Sign it">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                startSeal();
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                startSeal();
              }}
              onClick={(e) => e.preventDefault()}
              onPointerEnter={onStampHover}
              onFocus={onStampHover}
              aria-label="Sign this entry"
              className={`group shrink-0 cursor-pointer select-none outline-none ${btnIcon("lg")} ${btnState.default} ${btnState.hover} ${btnState.active}`}
            >
              <Signature
                size={iconPx("lg")}
                strokeWidth={iconStroke("lg")}
                aria-hidden
                className={`${iconFixed} origin-center transition-transform duration-200 ease-out group-hover:rotate-0`}
              />
            </button>
          </Tooltip>
        </div>
      )}
    </>
  );
});

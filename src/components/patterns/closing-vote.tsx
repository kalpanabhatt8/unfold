"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PatternVoteValue } from "@/lib/patterns/pattern-vote-store";

export type ClosingVoteProps = {
  value: PatternVoteValue | null;
  onVote: (vote: PatternVoteValue) => void;
};

const DOWN_REASONS = [
  "Doesn’t resonate",
  "Too vague",
  "Missed what I meant",
  "Not useful right now",
  "Other",
] as const;

const TOAST_MS = 2_600;

const copyStyle = {
  fontSize: "var(--text-sm)",
  lineHeight: "var(--text-sm--line-height)",
  fontFamily: "var(--font-body)",
} as const;

const voteBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
  "text-(--sidebar-ink-soft) transition-colors duration-150 " +
  "hover:bg-(--sidebar-hover-bg) hover:text-(--sidebar-ink) " +
  "data-[active=true]:bg-[color-mix(in_srgb,var(--button-primary)_5%,white)] " +
  "data-[active=true]:text-[color-mix(in_srgb,var(--button-primary)_72%,transparent)]";

/** Solid thumbs — single filled shapes (stem included). Lucide’s stroke+fill leaves a seam. */
function ThumbsUpIcon({ solid }: { solid: boolean }) {
  if (solid) {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M1 21h4V9H1zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73z"
        />
      </svg>
    );
  }
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function ThumbsDownIcon({ solid }: { solid: boolean }) {
  if (solid) {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2m4 0v12h4V3z"
        />
      </svg>
    );
  }
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

/**
 * Quiet thumbs under a closing beat.
 * Up → thanks toast. Down → short reason form, then thanks.
 * Both controls stay visible; only the selected one fills + soft circle.
 */
export function ClosingVote({ value, onVote }: ClosingVoteProps) {
  const titleId = useId();
  const formRef = useRef<HTMLDivElement | null>(null);
  /** After submit/close, keep downvote selected but hide the form until they tap down again. */
  const [formDismissed, setFormDismissed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const formOpen = value === "down" && !formDismissed;

  useEffect(() => {
    if (value !== "down") setFormDismissed(false);
  }, [value]);

  useEffect(() => {
    if (!formOpen || !formRef.current) return;
    formRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [formOpen]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const showThanks = () => {
    setToast("Thank you! Your feedback helps make Unfold better for everyone.");
  };

  const handleUp = () => {
    onVote("up");
    setFormDismissed(false);
    showThanks();
  };

  const handleDown = () => {
    onVote("down");
    setFormDismissed(false);
  };

  const submitReason = (reason: string) => {
    setFormDismissed(true);
    showThanks();
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[pattern closing] ${reason}` }),
    }).catch(() => {
      /* vote already saved; reason is best-effort */
    });
  };

  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label="Was this helpful?"
      >
        <button
          type="button"
          aria-label="Thumbs up"
          aria-pressed={value === "up"}
          onClick={handleUp}
          className={voteBtnClass}
          data-active={value === "up" ? "true" : "false"}
        >
          <ThumbsUpIcon solid={value === "up"} />
        </button>
        <button
          type="button"
          aria-label="Thumbs down"
          aria-pressed={value === "down"}
          onClick={handleDown}
          className={voteBtnClass}
          data-active={value === "down" ? "true" : "false"}
        >
          <ThumbsDownIcon solid={value === "down"} />
        </button>
      </div>

      {formOpen ? (
        <div
          ref={formRef}
          role="dialog"
          aria-labelledby={titleId}
          className="w-full max-w-sm rounded-xl border border-(--popover-border) bg-(--surface-raised) px-3.5 py-3 shadow-[0_0.75rem_1.75rem_-1rem_rgba(15,15,15,0.22)]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id={titleId}
                className="text-sm font-semibold tracking-tight text-primary"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                What went wrong?
              </h3>
              <p
                className="mt-0.5 text-(--sidebar-ink-soft)"
                style={copyStyle}
              >
                Your feedback helps make Unfold better.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setFormDismissed(true)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--sidebar-ink-soft) transition-colors hover:bg-(--sidebar-hover-bg) hover:text-primary"
            >
              <X size={15} strokeWidth={1.85} aria-hidden />
            </button>
          </div>

          <ul className="mt-3 flex flex-col items-start gap-1.5">
            {DOWN_REASONS.map((reason) => (
              <li key={reason}>
                <button
                  type="button"
                  onClick={() => submitReason(reason)}
                  className="rounded-full border border-(--popover-border) bg-(--surface-canvas) px-3 py-1.5 text-left text-primary transition-colors duration-150 hover:bg-(--sidebar-hover-bg)"
                  style={copyStyle}
                >
                  {reason}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {toast && typeof document !== "undefined"
        ? createPortal(
            <div role="status" aria-live="polite" className="app-toast">
              {toast}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

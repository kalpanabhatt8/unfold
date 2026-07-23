"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { btnIconChrome, btnPrimary, btnSecondary } from "@/components/ui/button-system";
import { BREAKPOINT_MD } from "@/lib/breakpoints";
import {
  FEEDBACK_CATEGORIES,
  feedbackChipClass,
  feedbackChipStyle,
  isValidFeedbackPayload,
  type FeedbackCategoryId,
} from "@/lib/feedback";

const MAX_FEEDBACK_CHARS = 4_000;

const copyStyle = feedbackChipStyle;
const chipBtnClass = feedbackChipClass;

type SendFeedbackModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SendFeedbackModal({ open, onClose }: SendFeedbackModalProps) {
  const titleId = useId();
  const [selectedChips, setSelectedChips] = useState<FeedbackCategoryId[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [textareaRows, setTextareaRows] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= BREAKPOINT_MD ? 7 : 5,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${BREAKPOINT_MD}px)`);
    const sync = () => setTextareaRows(mq.matches ? 7 : 5);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;

    setSelectedChips([]);
    setText("");
    setBusy(false);
    setError(null);
    setSent(false);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const trimmedText = text.trim();
  const needsFeatureDetails = selectedChips.includes("feature");
  const canSubmit = isValidFeedbackPayload(selectedChips, trimmedText);

  const submit = async () => {
    if (busy || !canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: selectedChips,
          text: trimmedText,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Couldn’t send feedback");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send feedback");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close feedback"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--text-primary)_28%,transparent)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-(--sidebar-border) bg-(--surface-canvas) shadow-[0_1.25rem_3rem_-1rem_rgba(15,15,15,0.28)]"
        style={{ fontFamily: "var(--font-body)", minHeight: "min(28rem, calc(100svh - 2rem))" }}
      >
        <div className="relative flex min-h-[inherit] flex-col py-6">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`absolute top-6 right-6 z-10 ${btnIconChrome("sm")}`}
          >
            <X size={16} strokeWidth={1.85} aria-hidden />
          </button>

          <div className="relative px-6">
            {/* Keep form in layout when sent so the dialog height doesn’t jump. */}
            <div
              className={
                sent
                  ? "invisible pointer-events-none flex flex-col gap-6"
                  : "flex flex-col gap-6"
              }
              aria-hidden={sent}
            >
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight text-primary"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Send feedback
              </h2>

              <div
                role="group"
                aria-label="Feedback type"
                className="flex flex-wrap gap-1.5 md:gap-2"
              >
              {FEEDBACK_CATEGORIES.map((chip) => {
                const active = selectedChips.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={active}
                    disabled={busy || sent}
                    tabIndex={sent ? -1 : undefined}
                    onClick={() =>
                      setSelectedChips((current) =>
                        current.includes(chip.id)
                          ? current.filter((id) => id !== chip.id)
                          : [...current, chip.id],
                      )
                    }
                    className={chipBtnClass}
                    data-active={active ? "true" : "false"}
                    style={copyStyle}
                  >
                    {active ? (
                      <Check
                        size={14}
                        strokeWidth={2.25}
                        aria-hidden
                        className="shrink-0"
                      />
                    ) : null}
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <label className="flex flex-col gap-1 md:gap-1.5">
              <span className="text-primary" style={copyStyle}>
                {needsFeatureDetails
                  ? "What would you like us to build? "
                  : "Anything you'd like to share? "}
                <span className="text-(--sidebar-ink-soft)">
                  {needsFeatureDetails ? "(required)" : "(optional)"}
                </span>
              </span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={MAX_FEEDBACK_CHARS}
                rows={textareaRows}
                required={needsFeatureDetails}
                aria-required={needsFeatureDetails}
                placeholder={
                  needsFeatureDetails
                    ? "A few words about the feature you have in mind."
                    : "Share anything you'd like us to know."
                }
                disabled={busy || sent}
                tabIndex={sent ? -1 : undefined}
                className="w-full resize-y rounded-md border border-(--sidebar-border) bg-(--surface-raised) px-3 py-2.5 text-primary outline-none transition-colors placeholder:text-(--sidebar-ink-soft)/70 focus:border-[color-mix(in_srgb,var(--canvas-title-ink)_28%,var(--sidebar-border))] focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                style={copyStyle}
              />
            </label>
            {error ? (
              <p
                className="text-(--button-destructive-soft-foreground)"
                style={copyStyle}
              >
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy || sent}
                tabIndex={sent ? -1 : undefined}
                onClick={onClose}
                className={btnSecondary("sm")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || sent || !canSubmit}
                tabIndex={sent ? -1 : undefined}
                onClick={() => void submit()}
                className={btnPrimary("sm")}
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
            </div>
            {sent ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-center text-(--sidebar-ink-soft)" style={copyStyle}>
                  Thanks for your feedback 💖
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

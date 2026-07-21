"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { btnPrimary, btnSecondary } from "@/components/ui/button-system";

const MAX_FEEDBACK_CHARS = 4_000;

const copyStyle = {
  fontSize: "var(--text-sm)",
  lineHeight: "var(--text-sm--line-height)",
  fontFamily: "var(--font-body)",
} as const;

type SendFeedbackModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SendFeedbackModal({ open, onClose }: SendFeedbackModalProps) {
  const titleId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;

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

  const submit = async () => {
    const next = text.trim();
    if (!next || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next }),
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
        className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-(--sidebar-border) bg-(--surface-canvas) shadow-[0_1.25rem_3rem_-1rem_rgba(15,15,15,0.28)]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-(--sidebar-border) px-4 py-3">
          <h2
            id={titleId}
            className="text-base font-semibold tracking-tight text-primary"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Send feedback
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--sidebar-ink-soft) transition-colors hover:bg-(--sidebar-hover-bg) hover:text-primary"
          >
            <X size={16} strokeWidth={1.85} aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {sent ? (
            <p className="py-6 text-center text-(--sidebar-ink-soft)" style={copyStyle}>
              Thanks — got it.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="sr-only">Your feedback</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={MAX_FEEDBACK_CHARS}
                  rows={6}
                  placeholder="What’s on your mind?"
                  disabled={busy}
                  className="w-full resize-y rounded-md border border-(--sidebar-border) bg-(--surface-raised) px-3 py-2.5 text-primary outline-none transition-colors placeholder:text-(--sidebar-ink-soft)/70 focus:border-(--canvas-title-ink) focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
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
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className={btnSecondary("sm")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || !text.trim()}
                  onClick={() => void submit()}
                  className={btnPrimary("sm")}
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

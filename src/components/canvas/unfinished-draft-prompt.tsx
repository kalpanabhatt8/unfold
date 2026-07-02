"use client";

import React from "react";
import { btnState, btnText } from "@/components/ui/button-system";

export type UnfinishedDraftPromptProps = {
  open: boolean;
  onSeal: () => void;
  onKeepEditing: () => void;
};

export function UnfinishedDraftPrompt({
  open,
  onSeal,
  onKeepEditing,
}: UnfinishedDraftPromptProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/15 px-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={onKeepEditing}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unfinished-draft-heading"
        className="w-full max-w-sm rounded-2xl border border-black/[0.08] bg-(--canvas-bg,#faf8f5) p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="unfinished-draft-heading"
          className="text-base font-semibold tracking-tight text-(--canvas-ink)"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          This entry was left unfinished. Sign it?
        </h2>
        <p className="mt-1.5 text-sm text-black/45">
          Your draft is still open. Signing makes it permanent — or keep writing.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onKeepEditing}
            className={`${btnText("sm", "soft")} ${btnState.default} ${btnState.hover} ${btnState.active}`}
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onSeal}
            className={`${btnText("sm", "soft")} bg-(--canvas-ink) text-white hover:bg-black/80 active:bg-black/90`}
          >
            Sign it
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Feedback modal playground — open at /dev/feedback
 */

import { useState } from "react";
import { SendFeedbackModal } from "@/components/sidebar/send-feedback-modal";
import { btnPrimary } from "@/components/ui/button-system";

export default function FeedbackDevPage() {
  const [open, setOpen] = useState(true);

  return (
    <main
      className="min-h-[100svh] w-full"
      style={{
        backgroundColor: "var(--surface-canvas)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-12">
        <header>
          <h1
            className="text-xl font-semibold text-primary"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Feedback modal
          </h1>
          <p className="mt-1 text-sm text-(--sidebar-ink-soft)">
            Preview of the account-menu Send feedback dialog.
          </p>
        </header>
        <button
          type="button"
          className={`w-fit ${btnPrimary("sm")}`}
          onClick={() => setOpen(true)}
        >
          Open feedback
        </button>
      </div>
      <SendFeedbackModal open={open} onClose={() => setOpen(false)} />
    </main>
  );
}

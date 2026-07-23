"use client";

import { useState } from "react";
import { SendFeedbackModal } from "@/components/sidebar/send-feedback-modal";
import { btnPrimary } from "@/components/ui/button-system";

export function FeedbackModalTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`w-fit ${btnPrimary("sm")}`}
        onClick={() => setOpen(true)}
      >
        Open feedback modal
      </button>
      <SendFeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

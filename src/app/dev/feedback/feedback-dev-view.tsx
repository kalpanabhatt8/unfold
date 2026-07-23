"use client";

import { useState } from "react";
import { feedbackChipClass, feedbackChipStyle } from "@/lib/feedback";
import { FeedbackInbox, type FeedbackInboxItem } from "./feedback-inbox";
import { PatternFeedbackPanel, type PatternFeedbackItem } from "./pattern-feedback-panel";

type FeedbackDevViewProps = {
  productItems: FeedbackInboxItem[];
  patternItems: PatternFeedbackItem[];
};

const VIEW_PRODUCT = "product" as const;
const VIEW_PATTERN = "pattern" as const;
type FeedbackView = typeof VIEW_PRODUCT | typeof VIEW_PATTERN;

export function FeedbackDevView({
  productItems,
  patternItems,
}: FeedbackDevViewProps) {
  const [view, setView] = useState<FeedbackView>(VIEW_PRODUCT);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1
          className="text-xl font-semibold text-primary"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Feedback inbox
        </h1>

        <div
          role="tablist"
          aria-label="Feedback type"
          className="flex flex-wrap gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === VIEW_PRODUCT}
            onClick={() => setView(VIEW_PRODUCT)}
            className={`${feedbackChipClass} shrink-0`}
            data-active={view === VIEW_PRODUCT ? "true" : "false"}
            style={feedbackChipStyle}
          >
            Product ({productItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === VIEW_PATTERN}
            onClick={() => setView(VIEW_PATTERN)}
            className={`${feedbackChipClass} shrink-0`}
            data-active={view === VIEW_PATTERN ? "true" : "false"}
            style={feedbackChipStyle}
          >
            Pattern ({patternItems.length})
          </button>
        </div>
      </header>

      {view === VIEW_PRODUCT ? (
        <FeedbackInbox items={productItems} />
      ) : (
        <PatternFeedbackPanel items={patternItems} />
      )}
    </div>
  );
}

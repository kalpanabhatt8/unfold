"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { PatternVoteValue } from "@/lib/patterns/pattern-vote-store";

export type ClosingVoteProps = {
  value: PatternVoteValue | null;
  onVote: (vote: PatternVoteValue) => void;
};

/**
 * Quiet thumbs control under a closing beat — capture only, no product logic.
 */
export function ClosingVote({ value, onVote }: ClosingVoteProps) {
  return (
    <div
      className="mt-6 flex items-center gap-1"
      role="group"
      aria-label="Was this helpful?"
    >
      <button
        type="button"
        aria-label="Thumbs up"
        aria-pressed={value === "up"}
        onClick={() => onVote("up")}
        className="rounded-md p-2 text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink) data-[active=true]:text-(--sidebar-ink)"
        data-active={value === "up" ? "true" : "false"}
      >
        <ThumbsUp
          size={16}
          strokeWidth={1.75}
          fill={value === "up" ? "currentColor" : "none"}
          aria-hidden
        />
      </button>
      <button
        type="button"
        aria-label="Thumbs down"
        aria-pressed={value === "down"}
        onClick={() => onVote("down")}
        className="rounded-md p-2 text-(--sidebar-ink-soft) transition-colors duration-150 hover:text-(--sidebar-ink) data-[active=true]:text-(--sidebar-ink)"
        data-active={value === "down" ? "true" : "false"}
      >
        <ThumbsDown
          size={16}
          strokeWidth={1.75}
          fill={value === "down" ? "currentColor" : "none"}
          aria-hidden
        />
      </button>
    </div>
  );
}

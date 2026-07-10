"use client";

import Link from "next/link";
import type { PatternDisplay, PatternEvidenceItem } from "@/lib/patterns/types";

const anchorTs = (item: PatternEvidenceItem): number =>
  item.sealedAt ?? item.lastEditedAt ?? item.createdAt;

const formatMoments = (count: number): string =>
  count === 1 ? "1 moment" : `${count} moments`;

const formatLastSeen = (timestamp: number): string => {
  const now = Date.now();
  const dayMs = 86_400_000;
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date(now));
  const seenDay = startOfDay(new Date(timestamp));
  const diffDays = Math.round((today - seenDay) / dayMs);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

const representativeQuote = (evidence: PatternEvidenceItem[]): string | null => {
  const sorted = [...evidence].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return anchorTs(b) - anchorTs(a);
  });

  for (const item of sorted) {
    const quote = item.quotes.find((q) => q.trim().length > 0);
    if (quote) return quote.trim();
  }
  return null;
};

const lastSeenTs = (evidence: PatternEvidenceItem[]): number =>
  Math.max(...evidence.map(anchorTs));

export type PatternListItemProps = {
  label: string;
  href: string;
  entryCount: number;
  evidence: PatternEvidenceItem[];
  timeHint: string | null;
  display: PatternDisplay | null;
};

function PatternRowSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <span className="h-4 w-[55%] animate-pulse rounded bg-(--sidebar-tab-track)" />
      <span className="h-3.5 w-full animate-pulse rounded bg-(--sidebar-tab-selected-bg)" />
      <span className="h-3 w-[35%] animate-pulse rounded bg-(--sidebar-tab-track)" />
    </div>
  );
}

/** Thin landing row with comfortable internal rhythm. */
export function PatternListItem({
  label,
  href,
  entryCount,
  evidence,
  timeHint,
  display,
}: PatternListItemProps) {
  const loading = display === null;
  const title = display?.displayTitle ?? null;
  const quote = representativeQuote(evidence);
  const metaParts = [
    formatMoments(entryCount),
    timeHint,
    `last seen ${formatLastSeen(lastSeenTs(evidence))}`,
  ].filter(Boolean);

  return (
    <Link
      href={href}
      className="group block border-b border-(--sidebar-border) py-6 transition-colors duration-150 last:border-b-0 sm:py-7"
    >
      {loading ? (
        <PatternRowSkeleton />
      ) : (
        <div className="flex flex-col gap-2">
          {title ? (
            <p
              className="text-[0.9375rem] font-semibold leading-snug tracking-tight text-(--sidebar-active-ink) sm:text-base"
            >
              {title}
            </p>
          ) : (
            <p className="text-[0.9375rem] font-semibold leading-snug text-(--sidebar-ink-soft) sm:text-base">
              {label}
            </p>
          )}

          {quote ? (
            <p
              className="line-clamp-2 text-[0.9rem] leading-relaxed text-(--canvas-ink-secondary)!"
              style={{ fontFamily: "var(--font-lora)" }}
            >
              &ldquo;{quote}&rdquo;
            </p>
          ) : null}

          <div className="mt-0.5 flex items-baseline justify-between gap-4">
            <p className="min-w-0 text-[0.6875rem] leading-relaxed tracking-[0.01em] text-(--sidebar-ink-soft)">
              {metaParts.join("  ·  ")}
            </p>
            {/* <span className="shrink-0 text-[0.75rem] text-(--sidebar-icon) transition-colors duration-150 group-hover:text-(--sidebar-ink)">
              Open →
            </span> */}
          </div>
        </div>
      )}
    </Link>
  );
}

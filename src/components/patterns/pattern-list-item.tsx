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
    <div className="pli-skel" aria-hidden>
      <span className="h-3.5 w-[55%] animate-pulse rounded bg-(--sidebar-tab-track)" />
      <span className="h-3 w-full animate-pulse rounded bg-(--sidebar-tab-selected-bg)" />
      <span className="h-2.5 w-[35%] animate-pulse rounded bg-(--sidebar-tab-track)" />
    </div>
  );
}

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
  const heading = title ?? label;

  return (
    <Link href={href} className="pattern-list-item group">
      {loading ? (
        <PatternRowSkeleton />
      ) : (
        <div className="pli-inner">
          <p className="pli-title" style={{ fontFamily: "var(--font-heading)" }}>
            {heading}
          </p>
          {quote ? (
            <p className="pli-quote" style={{ fontFamily: "var(--font-lora)" }}>
              &ldquo;{quote}&rdquo;
            </p>
          ) : null}
          <p className="pli-meta">{metaParts.join("  ·  ")}</p>
        </div>
      )}
    </Link>
  );
}

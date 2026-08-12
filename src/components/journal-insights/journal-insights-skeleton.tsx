/**
 * Placeholder for the Patterns-route insights sidebar while local data / sync
 * settles — mirrors Summary metric cards so the empty state never flashes.
 */

export function JournalInsightsSkeleton() {
  return (
    <div
      className="flex min-w-0 flex-col gap-4 pb-6"
      aria-busy="true"
      aria-label="Loading insights"
    >
      <div className="flex flex-col gap-2">
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,7.5rem),1fr))] gap-2">
          {(
            [
              "bg-(--journal-metric-days)",
              "bg-(--journal-metric-entries)",
              "bg-(--journal-metric-words)",
            ] as const
          ).map((bg) => (
            <div
              key={bg}
              className={`flex min-w-0 flex-col gap-2 rounded-xl px-3 py-3.5 ${bg}`}
              aria-hidden
            >
              <span className="block h-6 w-10 animate-pulse rounded-sm bg-(--sidebar-ink)/12" />
              <span className="block h-3 w-14 animate-pulse rounded-sm bg-(--sidebar-ink)/8" />
            </div>
          ))}
        </div>
      </div>
      <span
        className="block h-3 w-[70%] animate-pulse rounded-sm bg-(--sidebar-ink)/8"
        aria-hidden
      />
    </div>
  );
}

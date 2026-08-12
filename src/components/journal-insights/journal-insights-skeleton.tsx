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
        <div className="flex h-9 shrink-0 items-center">
          <span className="block h-3 w-16 animate-pulse rounded-sm bg-(--sidebar-ink)/10" />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-col gap-2 rounded-xl bg-(--surface-wash-strong) px-3 py-3.5"
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

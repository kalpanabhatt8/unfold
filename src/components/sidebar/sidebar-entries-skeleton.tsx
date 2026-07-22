/**
 * Placeholder entry rows that mirror the real sidebar list layout
 * (title + relative time + preview) while initial sync is in flight.
 */

const ROWS: ReadonlyArray<{
  title: string;
  time: string;
  preview: string;
  active?: boolean;
}> = [
  { title: "w-[58%]", time: "w-7", preview: "w-[82%]", active: true },
  { title: "w-[46%]", time: "w-6", preview: "w-[70%]" },
  { title: "w-[64%]", time: "w-8", preview: "w-[88%]" },
  { title: "w-[40%]", time: "w-6", preview: "w-[62%]" },
  { title: "w-[52%]", time: "w-7", preview: "w-[76%]" },
  { title: "w-[36%]", time: "w-5", preview: "w-[55%]" },
];

export function SidebarEntriesSkeleton() {
  return (
    <ul
      className="flex flex-col gap-1 px-2 pb-4"
      aria-busy="true"
      aria-label="Loading entries"
    >
      {ROWS.map((row, i) => (
        <li
          key={i}
          className={
            row.active
              ? "relative rounded-md bg-(--sidebar-active-bg)"
              : "relative rounded-md"
          }
          aria-hidden
        >
          <div className="relative flex flex-col gap-0.5 px-2.75 py-2.5">
            <span className="flex items-start justify-between gap-3">
              <span
                className={`mt-0.5 block h-3.5 animate-pulse rounded-sm bg-(--sidebar-ink)/12 ${row.title}`}
              />
              <span
                className={`mt-1 block h-3 shrink-0 animate-pulse rounded-sm bg-(--sidebar-ink)/8 ${row.time}`}
              />
            </span>
            <span
              className={`mt-0.5 block h-3.5 max-w-[88%] animate-pulse rounded-sm bg-(--sidebar-ink)/8 ${row.preview}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

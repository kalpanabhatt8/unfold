/** Bookshelf — disabled; original implementation kept below for reference. */
const __bookshelf_disabled = String.raw`
"use client";

import React, { useEffect, useRef } from "react";
import clsx from "clsx";
import type { RecentBook } from "@/lib/recent-books";
import { BookSpineWithColor } from "@/components/bookshelf/book-spine-with-color";

type BookshelfProps = {
  books: RecentBook[];
  onBookClick?: (book: RecentBook) => void;
  className?: string;
  /** Map vertical wheel/trackpad scroll to horizontal shelf movement. */
  mapVerticalScroll?: boolean;
};

export function Bookshelf({
  books,
  onBookClick,
  className,
  mapVerticalScroll = false,
}: BookshelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapVerticalScroll) return;
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mapVerticalScroll]);

  return (
    <div
      ref={scrollRef}
      className={clsx(
        "flex w-full items-end gap-3 overflow-x-auto overflow-y-hidden",
        mapVerticalScroll && "min-h-0 flex-1 overscroll-x-contain",
        className,
      )}
      style={{
        scrollbarWidth: "thin",
      }}
    >
      {books.map((book) => (
        <BookSpineWithColor
          key={book.id}
          book={book}
          onClick={() => onBookClick?.(book)}
        />
      ))}
    </div>
  );
}
`;

void __bookshelf_disabled;

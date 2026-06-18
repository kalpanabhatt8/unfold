/** Book spine with color — disabled; original implementation kept below for reference. */
const __book_spine_with_color_disabled = String.raw`
"use client";

import React from "react";
import type { RecentBook } from "@/lib/recent-books";
import { hasBookTitle, resolveBookDisplayTitle } from "@/lib/book-title";
import { BookSpine } from "@/components/bookshelf/book-spine";
import { useSpineColor } from "@/components/bookshelf/use-spine-color";
import { useSpineTitleStyle } from "@/components/bookshelf/use-spine-title-style";

type BookSpineWithColorProps = {
  book: RecentBook;
  onClick?: () => void;
  className?: string;
};

export function BookSpineWithColor({ book, onClick, className }: BookSpineWithColorProps) {
  const baseColor = useSpineColor(book);
  const displayTitle = resolveBookDisplayTitle(book.title);
  const isPlaceholder = !hasBookTitle(book.title);
  const titleStyle = useSpineTitleStyle(book, isPlaceholder);

  return (
    <BookSpine
      title={displayTitle}
      titleStyle={titleStyle}
      baseColor={baseColor}
      onClick={onClick}
      className={className}
    />
  );
}
`;

void __book_spine_with_color_disabled;

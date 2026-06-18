/** useSpineTitleStyle — disabled; original implementation kept below for reference. */
const __use_spine_title_style_disabled = String.raw`
"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  coverGradientIdFromBackground,
  resolveBookCoverBackground,
} from "@/data/cover-gradients";
import {
  coverOverlayTextStyles,
  estimateBackgroundLuminance,
  sampleCoverImageFromUrl,
} from "@/lib/cover-text-contrast";
import type { RecentBook } from "@/lib/recent-books";

/** Title / hint colors — same contrast rules as \`BookCover\` on the cover page. */
export function useSpineTitleStyle(
  book: RecentBook,
  isPlaceholder: boolean,
): CSSProperties {
  const background = resolveBookCoverBackground(book.background);
  const resolvedGradient = coverGradientIdFromBackground(book.background);
  const fallbackLum = useMemo(
    () => estimateBackgroundLuminance(background, resolvedGradient),
    [background, resolvedGradient],
  );
  const [imageRegionLum, setImageRegionLum] = useState<number | null>(null);

  useEffect(() => {
    if (book.variant !== "image" || !book.coverImage) {
      setImageRegionLum(null);
      return;
    }
    let cancelled = false;
    void sampleCoverImageFromUrl(book.coverImage).then((lum) => {
      if (!cancelled) setImageRegionLum(lum);
    });
    return () => {
      cancelled = true;
    };
  }, [book.variant, book.coverImage]);

  const effectiveLuminance =
    book.variant === "image" && imageRegionLum !== null
      ? imageRegionLum
      : fallbackLum;

  return useMemo(() => {
    const chrome = coverOverlayTextStyles({
      luminance: effectiveLuminance,
      onImage: book.variant === "image" && Boolean(book.coverImage),
    });
    return isPlaceholder ? chrome.hint : chrome.title;
  }, [book.variant, book.coverImage, effectiveLuminance, isPlaceholder]);
}
`;

void __use_spine_title_style_disabled;

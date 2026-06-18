/** useSpineColor — disabled; original implementation kept below for reference. */
const __use_spine_color_disabled = String.raw`
"use client";

import { useEffect, useState } from "react";
import type { RecentBook } from "@/lib/recent-books";
import {
  type Rgb,
  sampleCoverImageRgb,
  spineBaseRgbFromBackground,
} from "@/lib/spine-colors";

export function useSpineColor(book: RecentBook): Rgb {
  const fallback = spineBaseRgbFromBackground(book.background);
  const [rgb, setRgb] = useState<Rgb>(fallback);

  useEffect(() => {
    const fromBackground = spineBaseRgbFromBackground(book.background);
    setRgb(fromBackground);

    if (book.variant !== "image" || !book.coverImage) return;

    let cancelled = false;
    sampleCoverImageRgb(book.coverImage).then((sampled) => {
      if (!cancelled && sampled) setRgb(sampled);
    });
    return () => {
      cancelled = true;
    };
  }, [book.background, book.coverImage, book.variant]);

  return rgb;
}
`;

void __use_spine_color_disabled;

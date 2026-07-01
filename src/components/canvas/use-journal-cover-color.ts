"use client";

import { useEffect, useState } from "react";
import {
  rgbToHex,
  sampleCoverImageDominantRgb,
  spineBaseRgbFromBackground,
  type Rgb,
} from "@/lib/spine-colors";

const DEFAULT_COVER_RGB: Rgb = { r: 232, g: 180, b: 184 };

export function useJournalCoverColor(opts: {
  background?: string;
  coverImage?: string | null;
  variant?: "solid" | "image";
}): string {
  const { background, coverImage, variant = "solid" } = opts;
  const fallback = spineBaseRgbFromBackground(background) ?? DEFAULT_COVER_RGB;
  const [hex, setHex] = useState(() => rgbToHex(fallback));

  useEffect(() => {
    const fromBackground = spineBaseRgbFromBackground(background) ?? DEFAULT_COVER_RGB;
    setHex(rgbToHex(fromBackground));

    if (variant !== "image" || !coverImage) return;

    let cancelled = false;
    void sampleCoverImageDominantRgb(coverImage).then((sampled) => {
      if (!cancelled && sampled) setHex(rgbToHex(sampled));
    });
    return () => {
      cancelled = true;
    };
  }, [background, coverImage, variant]);

  return hex;
}

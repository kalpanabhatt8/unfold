import type { CSSProperties } from "react";
import type { CoverGradientId } from "@/data/cover-gradients";
import { coverGradientIdFromBackground } from "@/data/cover-gradients";

/** WCAG relative luminance for sRGB channels in 0–255. */
export function relativeLuminance255(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function parseHexTriplet(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    const r = Number.parseInt(h[0] + h[0], 16);
    const g = Number.parseInt(h[1] + h[1], 16);
    const b = Number.parseInt(h[2] + h[2], 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
      ? { r, g, b }
      : null;
  }
  if (h.length === 6) {
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
      ? { r, g, b }
      : null;
  }
  return null;
}

/** Parses #rgb / #rrggbb and rgb()/rgba() with 0–255 channels. */
export function parseCssColorToRgb(value: string): { r: number; g: number; b: number } | null {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) return parseHexTriplet(trimmed);

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)/,
  );
  if (!rgbaMatch) return null;
  const r = Number(rgbaMatch[1]);
  const g = Number(rgbaMatch[2]);
  const b = Number(rgbaMatch[3]);
  if (![r, g, b].every((c) => Number.isFinite(c))) return null;
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
  };
}

function collectHexColors(css: string): string[] {
  const out: string[] = [];
  const re = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    out.push(`#${m[1]}`);
  }
  return out;
}

/**
 * Luminance for each built-in cover slot (`book.css` / `--gradient-*` solids).
 * Kept in sync with the hex values there for title/subtitle contrast.
 */
export const COVER_GRADIENT_LUMINANCE: Record<CoverGradientId, number> = {
  g1: relativeLuminance255(247, 245, 242),
  g2: relativeLuminance255(92, 111, 130),
  g3: relativeLuminance255(196, 131, 106),
  g4: relativeLuminance255(92, 74, 107),
  g5: relativeLuminance255(61, 107, 92),
  g6: relativeLuminance255(232, 230, 227),
  g7: relativeLuminance255(26, 31, 46),
  g8: relativeLuminance255(15, 45, 42),
  g9: relativeLuminance255(42, 34, 53),
  g10: relativeLuminance255(254, 253, 251),
};

const DARK_BG_THRESHOLD = 0.45;

export function isDarkCoverBackground(luminance: number): boolean {
  return luminance < DARK_BG_THRESHOLD;
}

/**
 * Best-effort luminance from `style.background` (solid, CSS gradient with hex stops, or
 * `var(--book-cover-gradient-g*)`).
 */
export function estimateBackgroundLuminance(
  background: string | undefined,
  resolvedGradientId: CoverGradientId | undefined,
): number {
  if (typeof background === "string" && background.trim()) {
    const fromVar = coverGradientIdFromBackground(background);
    if (fromVar && COVER_GRADIENT_LUMINANCE[fromVar] !== undefined) {
      return COVER_GRADIENT_LUMINANCE[fromVar];
    }
    const solid = parseCssColorToRgb(background);
    if (solid) {
      return relativeLuminance255(solid.r, solid.g, solid.b);
    }
    const hexes = collectHexColors(background);
    if (hexes.length > 0) {
      let sum = 0;
      for (const hx of hexes) {
        const rgb = parseHexTriplet(hx);
        if (rgb) sum += relativeLuminance255(rgb.r, rgb.g, rgb.b);
      }
      return sum / hexes.length;
    }
  }
  if (resolvedGradientId && COVER_GRADIENT_LUMINANCE[resolvedGradientId] !== undefined) {
    return COVER_GRADIENT_LUMINANCE[resolvedGradientId];
  }
  return COVER_GRADIENT_LUMINANCE.g1;
}

const IMAGE_TEXT_SHADOW_LIGHT =
  "0 1px 2px rgba(0,0,0,0.55), 0 0 14px rgba(0,0,0,0.35)";
const IMAGE_TEXT_SHADOW_DARK =
  "0 1px 2px rgba(255,255,255,0.45), 0 0 12px rgba(0,0,0,0.18)";

export type CoverOverlayTextStyles = {
  title: CSSProperties;
  subtitle: CSSProperties;
  /** Muted overlay copy (e.g. “open journal”) — same polarity as title, lower alpha. */
  hint: CSSProperties;
};

export function coverOverlayTextStyles(opts: {
  luminance: number;
  onImage: boolean;
}): CoverOverlayTextStyles {
  const darkBg = isDarkCoverBackground(opts.luminance);
  const shadow = opts.onImage
    ? darkBg
      ? IMAGE_TEXT_SHADOW_LIGHT
      : IMAGE_TEXT_SHADOW_DARK
    : undefined;

  if (darkBg) {
    return {
      title: { color: "rgba(255,255,255,0.94)", textShadow: shadow },
      subtitle: { color: "rgba(255,255,255,0.78)", textShadow: shadow },
      hint: { color: "rgba(255,255,255,0.5)", textShadow: shadow },
    };
  }
  return {
    title: { color: "rgba(15,23,42,0.92)", textShadow: shadow },
    subtitle: { color: "rgba(15,23,42,0.68)", textShadow: shadow },
    hint: { color: "rgba(15,23,42,0.45)", textShadow: shadow },
  };
}

/**
 * Average relative luminance over the bottom-left region of a bitmap (where cover
 * title text sits). Returns null if sampling fails.
 */
export function sampleBitmapRegionLuminance(
  bitmap: CanvasImageSource,
  width: number,
  height: number,
): number | null {
  if (typeof document === "undefined") return null;
  const sampleW = Math.max(8, Math.min(96, Math.floor(width)));
  const sampleH = Math.max(8, Math.min(96, Math.floor(height)));
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, sampleW, sampleH);
  } catch {
    return null;
  }

  const x0 = 0;
  const y0 = Math.floor(sampleH * 0.42);
  const rw = Math.floor(sampleW * 0.92);
  const rh = sampleH - y0;
  if (rw <= 0 || rh <= 0) return null;

  const imageData = ctx.getImageData(x0, y0, rw, rh);
  const { data } = imageData;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.08) continue;
    sum += relativeLuminance255(data[i]!, data[i + 1]!, data[i + 2]!);
    n++;
  }
  if (!n) return null;
  return sum / n;
}

export function sampleCoverImageFromUrl(imageUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        resolve(null);
        return;
      }
      resolve(sampleBitmapRegionLuminance(img, w, h));
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

import { coverTintRgbFromBackground } from "@/lib/cover-text-contrast";

export type Rgb = { r: number; g: number; b: number };

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (c: number) => clamp(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Base spine color from a book's stored background (solid or preset slot). */
export function spineBaseRgbFromBackground(background: string | undefined | null): Rgb {
  return coverTintRgbFromBackground(background) ?? { r: 232, g: 208, b: 192 };
}

/** Figma inner shadows — depth on left/top and right/bottom edges. */
export const SPINE_INNER_SHADOWS =
  "inset 4px 2px 10px 0 rgba(0,0,0,0.25), inset -4px 4px 14px 0 rgba(0,0,0,0.25)";

/** Average RGB over the center band of a cover image (for image-based spines). */
export function sampleCoverImageRgb(imageUrl: string): Promise<Rgb | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h || typeof document === "undefined") {
        resolve(null);
        return;
      }

      const sampleW = Math.max(8, Math.min(64, Math.floor(w)));
      const sampleH = Math.max(8, Math.min(64, Math.floor(h)));
      const canvas = document.createElement("canvas");
      canvas.width = sampleW;
      canvas.height = sampleH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      try {
        ctx.drawImage(img, 0, 0, w, h, 0, 0, sampleW, sampleH);
      } catch {
        resolve(null);
        return;
      }

      const x0 = Math.floor(sampleW * 0.2);
      const y0 = Math.floor(sampleH * 0.15);
      const rw = Math.floor(sampleW * 0.6);
      const rh = Math.floor(sampleH * 0.7);
      if (rw <= 0 || rh <= 0) {
        resolve(null);
        return;
      }

      const { data } = ctx.getImageData(x0, y0, rw, rh);
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]! / 255;
        if (a < 0.08) continue;
        r += data[i]!;
        g += data[i + 1]!;
        b += data[i + 2]!;
        n++;
      }
      if (!n) {
        resolve(null);
        return;
      }
      resolve({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) });
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

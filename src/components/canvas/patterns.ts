// pattern.ts
import type { Theme } from "./canvas-board";

export type Pattern = {
  name: string;
  style: (theme: Theme, backgroundColor?: string) => string;  // always a function
  color?: string;
  blend?: string;
  size?: string;
  tintable?: boolean;
};


/** Theme aware ink */
function isDarkColor(color: string): boolean {
  // Handle hex colors (#rrggbb or #rgb)
  if (color.startsWith("#")) {
    let hex = color.replace("#", "");
    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
    }
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  }

  // Handle rgb() and rgba()
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  }

  // Fallback: not dark
  return false;
}

function pickGridColor(theme: Theme, background?: string): string {
  // Define palettes for each theme and background lightness
  const lightBackgroundColors: Record<Theme, string> = {
    // subtle gray for tone1, pastel pink for tone2, earthy brown for tone3, deep black/gray for tone4
    tone1: "rgba(0,0,0,0.1)",      // faint gray
    tone2: "rgba(255,182,193,0.4)", // very soft pink
    tone3:  "rgba(74,50,31,0.2)",     // subtle brown
    tone4:  "rgba(20,20,20,0.6)", 
  };
  const darkBackgroundColors: Record<Theme, string> = {
    // pure white for tone1, vivid pink for tone2, off-white/beige for tone3, bright cyan for tone4
    tone1: "rgba(255,255,255,0.15)", // faint white
  tone2: "rgba(255,128,170,0.5)",  // slightly stronger vivid pink
  tone3:  "rgba(245,235,210,0.25)",  // light beige
  tone4:  "rgba(200,255,255,0.18)",  // pale cyan accent
  };
  let useDark = false;
  if (background) {
    useDark = isDarkColor(background);
    // console.log("pickGridColor background check", { theme, background, useDark });
  }
  if (useDark) {
    return darkBackgroundColors[theme];
  }
  return lightBackgroundColors[theme];
}

/** Dot grid */
export function generateDotGridTexture(
  theme: Theme,
  spacing = 20,
  radius = 1,
  color?: string,
  backgroundColor?: string
): string {
  if (typeof document === "undefined") {
    // SSR fallback: transparent or empty
    return "none";
  }

  const dotColor = color ?? pickGridColor(theme, backgroundColor ?? "#ffffff");
  console.log("generateDotGridTexture → dotColor", dotColor);
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;

  const canvas = document.createElement("canvas");
  canvas.width = spacing * dpr;
  canvas.height = spacing * dpr;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  return `url(${canvas.toDataURL("image/png")})`;
}

export function generateLineGridTexture(
  theme: Theme,
  spacing = 20,
  lineWidth = 1,
  color?: string,
  backgroundColor?: string
): string {
  if (typeof document === "undefined") {
    return "none"; // SSR safe fallback
  }

  const ink = color ?? pickGridColor(theme, backgroundColor ?? "#ffffff");
  console.log("generateLineGridTexture → ink", ink);
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;

  const canvas = document.createElement("canvas");
  canvas.width = spacing * dpr;
  canvas.height = spacing * dpr;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = ink;
    ctx.lineWidth = lineWidth;

    const half = lineWidth % 2 === 1 ? 0.5 : 0;

    ctx.beginPath();
    ctx.moveTo(0 + half, 0);
    ctx.lineTo(0 + half, spacing);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0 + half);
    ctx.lineTo(spacing, 0 + half);
    ctx.stroke();
  }
  return `url(${canvas.toDataURL("image/png")})`;
}

/** Build the "universal" set (wrapped in functions) */
export function getUniversalPatterns(theme: Theme): Pattern[] {
  return [
    {
      name: "Line Grid",
      style: (t: Theme, bg?: string) => generateLineGridTexture(t, 30, 1, undefined, bg),
      color: "transparent",
      blend: "multiply",
      size: "30px 30px",
    },
    {
      name: "Dot Grid",
      style: (t: Theme, bg?: string) => generateDotGridTexture(t, 30, 2, undefined, bg),
      color: "transparent",
      blend: "overlay",
      size: "30px 30px",
    },
    {
      name: "Paper",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/handmade-paper.png')",
      color: "transparent",
      blend: "normal",
    },
    {
      name: "Base Texture",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/grid.png')",
      color: "transparent",
      size: "40px",
      blend: "soft-light",
    },
    {
      name: "Base Grid",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/grid.png')",
      color: "transparent",
      blend: "normal",
    },
    {
      name: "Asfalt Dark",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')",
      color: "transparent",
      blend: "overlay",
    },
    {
      name: "Asfalt Light",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/asfalt-light.png')",
      color: "transparent",
      blend: "overlay",
    },
  ];
}

/** Build presets per theme (everything centralized here) */
export function getThemeTexturePresets(theme: Theme): Pattern[] {
  const base = getUniversalPatterns(theme);

  if (theme === "tone1") {
    return [
      ...base,
      {
        name: "Subtle Grey",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/subtle-grey.png')",
        color: "transparent",
        blend: "multiply",
      },
      // {
      //   name: "Concrete Wall",
      //   style: () =>
      //     "url('https://www.transparenttextures.com/patterns/concrete-wall.png')",
      //   color: "transparent",
      //   blend: "overlay",
      // },
      {
        name: "Beige Paper",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/beige-paper.png')",
        color: "transparent",
        blend: "multiply",
      },
      {
        name: "Low Contrast Linen",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/low-contrast-linen.png')",
        color: "transparent",
        blend: "overlay",
      },
      {
        name: "Scribble Light",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/scribble-light.png')",
        color: "transparent",
        blend: "multiply",
      },
      {
        name: "Brushed Alum",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/brushed-alum.png')",
        color: "transparent",
        blend: "overlay",
      },
    ];
  }

  if (theme === "tone2") {
    return [
      ...base,
      {
        name: "Confetti",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/confetti.png')",
        color: "#ffe4ee",
        blend: "screen",
      },
      {
        name: "Hearts",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/hearts.png')",
        color: "#ffd6e7",
        blend: "soft-light",
      },
      {
        name: "Polka Dots",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/polka-dots.png')",
        color: "#fff0f6",
        blend: "soft-light",
      },
    ];
  }

  if (theme === "tone3") {
    return [
      ...base,
      {
        name: "Carbon Fibre",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')",
        color: "#e3c29b",
        blend: "multiply",
      },
      {
        name: "Asfalt Dark",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')",
        color: "#d6b98f",
        blend: "overlay",
      },
      {
        name: "Cubes",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/cubes.png')",
        color: "#fff4e6",
        blend: "overlay",
      },
    ];
  }

  // tone4
  return [
    ...base,
    {
      name: "Bubbles",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/bubbles.png')",
      color: "#0d0d0d",
      blend: "screen",
    },
    {
      name: "Skulls",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/skulls.png')",
      color: "#1a1a1a",
      blend: "screen",
    },
    {
      name: "Clouds",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/clouds.png')",
      color: "#111827",
      blend: "screen",
    },
  ];
}

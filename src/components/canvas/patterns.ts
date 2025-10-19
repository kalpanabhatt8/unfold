// pattern.ts
import type { Theme } from "./canvas-board";

export type Pattern = {
  name: string;
  style: (theme: Theme) => string;  // always a function
  color?: string;
  blend?: string;
  size?: string;
  tintable?: boolean;
};


/** Theme aware ink */
function pickGridColor(theme: Theme): string {
  const colors: Record<Theme, string> = {
    neutral: "rgba(0,0,0,0.15)",
    kawaii: "rgba(255,182,193,0.25)",
    retro:  "rgba(74,50,31,0.25)",
    anime:  "rgba(245, 245, 245,0.15)",
  };
  return colors[theme];
}

/** Dot grid */
export function generateDotGridTexture(
  theme: Theme,
  spacing = 20,
  radius = 1,
  color?: string
): string {
  if (typeof document === "undefined") {
    // SSR fallback: transparent or empty
    return "none";
  }

  const dotColor = color ?? pickGridColor(theme);
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
  color?: string
): string {
  if (typeof document === "undefined") {
    return "none"; // SSR safe fallback
  }

  const ink = color ?? pickGridColor(theme);
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
      style: (t: Theme) => generateLineGridTexture(t, 30, 1),
      color: "transparent",
      blend: "multiply",
      size: "30px 30px",
    },
    {
      name: "Dot Grid",
      style: (t: Theme) => generateDotGridTexture(t, 30, 2),
      color: "transparent",
      blend: "overlay",
      size: "30px 30px",
    },
    {
      name: "Paper",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/light-paper-fibers.png')",
      color: "transparent",
      blend: "normal",
    },
    {
      name: "Tiny Grid",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/tiny-grid.png')",
      color: "transparent",
      blend: "multiply",
    },
    {
      name: "Neutral",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/ps-neutral.png')",
      color: "transparent",
      blend: "overlay",
    },
    {
      name: "Neutral Grid",
      style: () =>
        "url('https://www.transparenttextures.com/patterns/grid.png')",
      color: "transparent",
      blend: "normal",
    },
  ];
}

/** Build presets per theme (everything centralized here) */
export function getThemeTexturePresets(theme: Theme): Pattern[] {
  const base = getUniversalPatterns(theme);

  if (theme === "neutral") {
    return [
      ...base,
      {
        name: "Subtle Grey",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/subtle-grey.png')",
        color: "transparent",
        blend: "multiply",
      },
      {
        name: "Light Paper Fibers",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/light-paper-fibers.png')",
        color: "transparent",
        blend: "multiply",
      },
      {
        name: "Concrete Wall",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/concrete-wall.png')",
        color: "transparent",
        blend: "overlay",
      },
      {
        name: "Beige Paper",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/beige-paper.png')",
        color: "transparent",
        blend: "multiply",
      },
      {
        name: "Fresh Snow",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/fresh-snow.png')",
        color: "transparent",
        blend: "normal",
      },
      {
        name: "Low Contrast Linen",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/low-contrast-linen.png')",
        color: "transparent",
        blend: "overlay",
      },
      {
        name: "Graphy (Light)",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/graphy-light.png')",
        color: "transparent",
        blend: "multiply",
      },
      {
        name: "Scribble Light",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/scribble-light.png')",
        color: "transparent",
        blend: "multiply",
      },
      {
        name: "Washi",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/washi.png')",
        color: "transparent",
        blend: "overlay",
      },
      {
        name: "Brushed Alum",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/brushed-alum.png')",
        color: "transparent",
        blend: "overlay",
      },
      {
        name: "Clean Gray Paper",
        style: () =>
          "url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')",
        color: "transparent",
        blend: "multiply",
      },
    ];
  }

  if (theme === "kawaii") {
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

  if (theme === "retro") {
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

  // anime
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

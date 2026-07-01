/** Default when --journal-cover-spine-inset-bottom is unset. */
export const COVER_SHAPE_SPINE_INSET_RATIO = 0;
export const COVER_SHAPE_SPINE_RADIUS_PX = 8;

export type CoverSpineInsetRatios = {
  top: number;
  bottom: number;
};

export type CoverSpineCornerRadii = {
  top: number;
  bottom: number;
};

function clampCornerRadius(w: number, h: number, cornerRadiusPx: number): number {
  return Math.min(cornerRadiusPx, w * 0.45, h * 0.12);
}

function clampSpineInset(h: number, spineInsetPx: number): number {
  return Math.min(spineInsetPx, h * 0.2);
}

function offsetFromCorner(
  cornerX: number,
  cornerY: number,
  towardX: number,
  towardY: number,
  distance: number
): [number, number] {
  const dx = towardX - cornerX;
  const dy = towardY - cornerY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [cornerX, cornerY];
  return [
    cornerX + (dx / len) * distance,
    cornerY + (dy / len) * distance,
  ];
}

function clampSpineCornerRadius(
  requested: number,
  pairedRadius: number,
  spineTop: number,
  spineBottom: number,
  h: number,
  edgeLen: number
): number {
  const spineLen = h - spineTop - spineBottom;
  if (spineLen <= 1) return 0;
  const maxWithPair = Math.max(0, spineLen - pairedRadius - 0.5);
  return Math.max(
    0,
    Math.min(requested, maxWithPair, spineLen / 2 - 0.5, edgeLen * 0.45)
  );
}

function spineArc(radius: number, endX: number, endY: number): string {
  return radius > 0
    ? `A ${radius},${radius} 0 0 1 ${endX},${endY}`
    : `L ${endX},${endY}`;
}

/** Outer edge left, spine right; circular arcs in pixel space. */
export function buildLeftCoverPath(
  w: number,
  h: number,
  spineInsetTopPx: number,
  spineInsetBottomPx: number,
  cornerRadiusPx: number,
  spineCornerRadii: CoverSpineCornerRadii
): string {
  const r = clampCornerRadius(w, h, cornerRadiusPx);
  const spineTop = clampSpineInset(h, spineInsetTopPx);
  const spineBottom = clampSpineInset(h, spineInsetBottomPx);
  const topEdgeLen = Math.hypot(w - r, spineTop);
  const bottomEdgeLen = Math.hypot(w - r, spineBottom);

  const srTop = clampSpineCornerRadius(
    spineCornerRadii.top,
    spineCornerRadii.bottom,
    spineTop,
    spineBottom,
    h,
    topEdgeLen
  );
  const srBottom = clampSpineCornerRadius(
    spineCornerRadii.bottom,
    srTop,
    spineTop,
    spineBottom,
    h,
    bottomEdgeLen
  );

  const [topEdgeEndX, topEdgeEndY] = offsetFromCorner(w, spineTop, r, 0, srTop);
  const [bottomEdgeStartX, bottomEdgeStartY] = offsetFromCorner(
    w,
    h - spineBottom,
    r,
    h,
    srBottom
  );

  const spineTopY = spineTop + srTop;
  const spineBottomY = h - spineBottom - srBottom;

  return [
    `M ${r},0`,
    srTop > 0 ? `L ${topEdgeEndX},${topEdgeEndY}` : `L ${w},${spineTop}`,
    spineArc(srTop, w, spineTopY),
    `L ${w},${spineBottomY}`,
    spineArc(srBottom, bottomEdgeStartX, bottomEdgeStartY),
    `L ${r},${h}`,
    `A ${r},${r} 0 0 1 0,${h - r}`,
    `L 0,${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    "Z",
  ].join(" ");
}

/** Spine left, outer edge right; circular arcs in pixel space. */
export function buildRightCoverPath(
  w: number,
  h: number,
  spineInsetTopPx: number,
  spineInsetBottomPx: number,
  cornerRadiusPx: number,
  spineCornerRadii: CoverSpineCornerRadii
): string {
  const r = clampCornerRadius(w, h, cornerRadiusPx);
  const spineTop = clampSpineInset(h, spineInsetTopPx);
  const spineBottom = clampSpineInset(h, spineInsetBottomPx);
  const topEdgeLen = Math.hypot(w - r, spineTop);
  const bottomEdgeLen = Math.hypot(w - r, spineBottom);

  const srTop = clampSpineCornerRadius(
    spineCornerRadii.top,
    spineCornerRadii.bottom,
    spineTop,
    spineBottom,
    h,
    topEdgeLen
  );
  const srBottom = clampSpineCornerRadius(
    spineCornerRadii.bottom,
    srTop,
    spineTop,
    spineBottom,
    h,
    bottomEdgeLen
  );

  const [topEdgeStartX, topEdgeStartY] = offsetFromCorner(0, spineTop, w - r, 0, srTop);
  const [bottomEdgeEndX, bottomEdgeEndY] = offsetFromCorner(
    0,
    h - spineBottom,
    w - r,
    h,
    srBottom
  );

  const spineTopY = spineTop + srTop;
  const spineBottomY = h - spineBottom - srBottom;

  return [
    `M 0,${spineTopY}`,
    spineArc(srTop, topEdgeStartX, topEdgeStartY),
    `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`,
    `L ${w},${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    srBottom > 0 ? `L ${bottomEdgeEndX},${bottomEdgeEndY}` : `L 0,${h - spineBottom}`,
    spineArc(srBottom, 0, spineBottomY),
    "Z",
  ].join(" ");
}

export function readCoverCornerRadiusPx(bookEl: HTMLElement | null): number {
  if (!bookEl) return 30;
  const style = getComputedStyle(bookEl);
  const explicit = parseFloat(
    style.getPropertyValue("--journal-cover-outer-radius")
  );
  if (Number.isFinite(explicit)) return explicit;

  const pageRadius =
    parseFloat(style.getPropertyValue("--journal-radius-page")) || 14;
  const bleed = parseFloat(style.getPropertyValue("--journal-cover-bleed")) || 16;
  const bleedY =
    parseFloat(style.getPropertyValue("--journal-cover-bleed-y")) || 8;
  return pageRadius + Math.max(bleed, bleedY);
}

function readCssPx(
  style: CSSStyleDeclaration,
  name: string,
  fallback: number
): number {
  const value = parseFloat(style.getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/** Per-cover spine corners: left uses *-tl/*-bl; right uses *-tr/*-br. */
export function readCoverSpineCornerRadii(
  bookEl: HTMLElement | null,
  side: "left" | "right"
): CoverSpineCornerRadii {
  if (!bookEl) {
    return { top: COVER_SHAPE_SPINE_RADIUS_PX, bottom: COVER_SHAPE_SPINE_RADIUS_PX };
  }

  const style = getComputedStyle(bookEl);
  const fallback = readCssPx(
    style,
    "--journal-cover-spine-radius",
    COVER_SHAPE_SPINE_RADIUS_PX
  );

  if (side === "left") {
    return {
      top: readCssPx(style, "--journal-cover-spine-radius-tl", fallback),
      bottom: readCssPx(style, "--journal-cover-spine-radius-bl", fallback),
    };
  }

  return {
    top: readCssPx(style, "--journal-cover-spine-radius-tr", fallback),
    bottom: readCssPx(style, "--journal-cover-spine-radius-br", fallback),
  };
}

export function readCoverSpineInsetRatios(
  bookEl: HTMLElement | null
): CoverSpineInsetRatios {
  if (!bookEl) {
    return { top: 0, bottom: COVER_SHAPE_SPINE_INSET_RATIO };
  }

  const style = getComputedStyle(bookEl);
  const legacy = parseFloat(style.getPropertyValue("--journal-cover-spine-inset"));
  const top = parseFloat(style.getPropertyValue("--journal-cover-spine-inset-top"));
  const bottom = parseFloat(
    style.getPropertyValue("--journal-cover-spine-inset-bottom")
  );

  return {
    top: Number.isFinite(top) ? top : 0,
    bottom: Number.isFinite(bottom)
      ? bottom
      : Number.isFinite(legacy)
        ? legacy
        : COVER_SHAPE_SPINE_INSET_RATIO,
  };
}

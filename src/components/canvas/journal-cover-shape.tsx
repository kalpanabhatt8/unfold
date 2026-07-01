"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildLeftCoverPath,
  buildRightCoverPath,
  readCoverCornerRadiusPx,
  readCoverSpineCornerRadii,
  readCoverSpineInsetRatios,
} from "@/lib/journal-cover-path";

type JournalCoverShapeProps = {
  side: "left" | "right";
};

export function JournalCoverShape({ side }: JournalCoverShapeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState("");
  const [viewBox, setViewBox] = useState("0 0 1 1");

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const update = () => {
      const w = svg.clientWidth;
      const h = svg.clientHeight;
      if (w <= 0 || h <= 0) return;

      const book = svg.closest(".journal-book");
      const cornerRadius = readCoverCornerRadiusPx(book as HTMLElement | null);
      const { top: spineInsetTopRatio, bottom: spineInsetBottomRatio } =
        readCoverSpineInsetRatios(book as HTMLElement | null);
      const spineInsetTopPx = h * spineInsetTopRatio;
      const spineInsetBottomPx = h * spineInsetBottomRatio;
      const spineCornerRadii = readCoverSpineCornerRadii(
        book as HTMLElement | null,
        side
      );
      const d =
        side === "left"
          ? buildLeftCoverPath(
              w,
              h,
              spineInsetTopPx,
              spineInsetBottomPx,
              cornerRadius,
              spineCornerRadii
            )
          : buildRightCoverPath(
              w,
              h,
              spineInsetTopPx,
              spineInsetBottomPx,
              cornerRadius,
              spineCornerRadii
            );

      setPath(d);
      setViewBox(`0 0 ${w} ${h}`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [side]);

  return (
    <svg
      ref={svgRef}
      className={`journal-book__cover journal-book__cover--${side}`}
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-hidden
    >
      {path ? <path d={path} /> : null}
    </svg>
  );
}

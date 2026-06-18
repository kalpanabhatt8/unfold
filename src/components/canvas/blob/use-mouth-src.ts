"use client";

import React from "react";
import type { BlobEmotion } from "./types";
import { resolveMouthSrc } from "./emotions";

const NEUTRAL_MOUTH = resolveMouthSrc("neutral");
const OUT_MS = 160;
const IN_MS = 220;

function needsNeutralBridge(from: string, to: string): boolean {
  if (from === to) return false;
  if (from === NEUTRAL_MOUTH || to === NEUTRAL_MOUTH) return false;
  return true;
}

/** Crossfade mouth assets through neutral so expressions feel like one mouth changing. */
export function useMouthSrc(emotion: BlobEmotion): string {
  const target = resolveMouthSrc(emotion);
  const [displayed, setDisplayed] = React.useState(target);
  const displayedRef = React.useRef(displayed);

  React.useEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);

  React.useEffect(() => {
    const from = displayedRef.current;
    if (from === target) return;

    let cancelled = false;
    const timers: number[] = [];

    const run = () => {
      if (!needsNeutralBridge(from, target)) {
        setDisplayed(target);
        return;
      }
      setDisplayed(NEUTRAL_MOUTH);
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setDisplayed(target);
        }, OUT_MS + IN_MS)
      );
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [target]);

  return displayed;
}

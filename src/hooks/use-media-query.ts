"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Defaults to `false` during SSR and the
 * first client render so server HTML matches hydration (sync in useEffect).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

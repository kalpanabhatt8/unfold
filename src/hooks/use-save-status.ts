"use client";

/**
 * Canvas header save label — only after the user edits the current entry.
 *
 * Hidden until the first edit in this mount; then "saving" while the local
 * mirror is in flight, a brief "saved" when it completes, then hidden again.
 * Ignores cloud sync entirely.
 */

import { useEffect, useRef, useState } from "react";

const SAVED_HOLD_MS = 2_000;

export type SaveStatusLabel = "saving" | "saved" | null;

export function useSaveStatus(
  localSaving: boolean,
  hasEdited: boolean,
): SaveStatusLabel {
  const [showSaved, setShowSaved] = useState(false);
  const wasSavingRef = useRef(false);

  useEffect(() => {
    if (localSaving) {
      wasSavingRef.current = true;
      setShowSaved(false);
      return;
    }

    if (wasSavingRef.current && hasEdited) {
      wasSavingRef.current = false;
      setShowSaved(true);
      const timer = window.setTimeout(() => setShowSaved(false), SAVED_HOLD_MS);
      return () => window.clearTimeout(timer);
    }
  }, [localSaving, hasEdited]);

  if (!hasEdited && !showSaved) return null;
  if (localSaving) return "saving";
  if (showSaved) return "saved";
  return null;
}

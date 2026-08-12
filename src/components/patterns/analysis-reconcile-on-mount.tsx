"use client";

import { useEffect } from "react";
import { reconcileAnalyses } from "@/lib/patterns/entry-completion";

/**
 * Dashboard-shell mount: auto-seal idle drafts, then retry sealed entries
 * missing analysis. Gated by durable attempt store (fail fast-path or
 * ATTEMPT_STALE_MS) so this cannot double-spend on an in-flight first attempt.
 * Patterns nav is not required.
 */
export function AnalysisReconcileOnMount() {
  useEffect(() => {
    void reconcileAnalyses();
  }, []);

  return null;
}

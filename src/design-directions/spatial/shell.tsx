"use client";

import type { ReactNode } from "react";
import "./spatial.css";

/** Placeholder - replaced by the Spatial direction build. */
export function SpatialShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh min-h-0 w-full max-w-[100vw] overflow-hidden bg-(--app-bg)">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

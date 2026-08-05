"use client";

import "./app-loader.css";

/**
 * Full-viewport, Notion-style waiting state - small centered spinner, no copy.
 * Use while auth resolves or the app hands off to the dashboard.
 */
export function AppLoader() {
  return (
    <div className="app-loader" role="status" aria-live="polite" aria-busy="true">
      <span className="app-loader__spinner" aria-hidden />
      <span className="app-loader__label">Loading</span>
    </div>
  );
}

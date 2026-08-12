"use client";

import Link from "next/link";
import { CTA, LANDING_FOOTER } from "./story";

export function LandingEndCta({ className = "" }: { className?: string }) {
  return (
    <div className={`lp-end-cta ${className}`}>
      <p className="lp-end-cta__whisper">{CTA.whisper}</p>
      <div className="lp-end-cta__row">
        <Link href={CTA.href} className="chrome-cta">
          {CTA.primary}
        </Link>
      </div>
    </div>
  );
}

/** Bottom-of-canvas closer: soft note left, X right - same column as content above. */
export function LandingEndNote({ className = "" }: { className?: string }) {
  const xHref = LANDING_FOOTER.x.href.trim();
  return (
    <footer className={`lp-live__end-note ${className}`.trim()}>
      <p className="lp-live__end-note-text">{LANDING_FOOTER.note}</p>
      {xHref ? (
        <a
          href={xHref}
          className="lp-live__end-note-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {LANDING_FOOTER.x.label}
        </a>
      ) : (
        <span className="lp-live__end-note-link" aria-hidden>
          {LANDING_FOOTER.x.label}
        </span>
      )}
    </footer>
  );
}

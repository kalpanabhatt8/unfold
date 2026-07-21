"use client";

import Link from "next/link";
import { BRAND, CTA } from "./story";

type LandingChromeProps = {
  variant?: "light" | "rose" | "cream";
  /** Show CTA in the corner (default true). */
  showCta?: boolean;
};

export function LandingChrome({
  variant = "cream",
  showCta = true,
}: LandingChromeProps) {
  return (
    <header className={`lp-chrome lp-chrome--${variant}`} data-lp-chrome>
      <Link href="/" className="lp-chrome__brand logo-font" aria-label="Unfold home">
        <span className="mr-[0.03em]">U</span>NFOLD
      </Link>
      {showCta ? (
        <div className="lp-chrome__actions">
          <Link href={CTA.header.primaryHref} className="lp-chrome__cta">
            {CTA.header.primary}
          </Link>
        </div>
      ) : null}
    </header>
  );
}

export function LandingEndCta({ className = "" }: { className?: string }) {
  return (
    <div className={`lp-end-cta ${className}`}>
      <p className="lp-end-cta__whisper">{CTA.whisper}</p>
      <div className="lp-end-cta__row">
        <Link href={CTA.href} className="lp-chrome__cta lp-chrome__cta--lg">
          {CTA.primary}
        </Link>
      </div>
    </div>
  );
}

export { BRAND };

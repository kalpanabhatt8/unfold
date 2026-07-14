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
      <Link href="/" className="lp-chrome__brand logo-font" aria-label="Keeps home">
        <span className="mr-[0.03em]">K</span>EEPS
      </Link>
      {showCta ? (
        <div className="lp-chrome__actions">
          <Link href="/sign-in" className="lp-chrome__ghost">
            {CTA.secondary}
          </Link>
          <Link href="/dashboard" className="lp-chrome__cta">
            {CTA.primary}
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
        <Link href="/dashboard" className="lp-chrome__cta lp-chrome__cta--lg">
          {CTA.primary}
        </Link>
        <Link href="/sign-in" className="lp-chrome__ghost">
          {CTA.secondary}
        </Link>
      </div>
    </div>
  );
}

export { BRAND };

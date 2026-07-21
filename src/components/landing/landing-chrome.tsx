"use client";

import Link from "next/link";
import { CTA } from "./story";

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
